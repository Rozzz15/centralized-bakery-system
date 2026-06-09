import type {
  DOSItem, ProductRecipe, InventoryItem, BufferStockEntry,
  RecipeDemand, BatchCalculation, OutputAllocation, ProductionPlan,
} from "../types";

/**
 * Step 1: Aggregate DOS items by recipe.
 * Groups multiple products that share the same recipe and sums their demand.
 */
export function aggregateRecipeDemand(
  dosItems: DOSItem[],
  recipes: ProductRecipe[]
): RecipeDemand[] {
  const demandMap = new Map<string, RecipeDemand>();

  dosItems.forEach(dos => {
    const directRecipe = recipes.find(r => r.productName === dos.product);

    // Collect all recipes for this DOS item: direct + linked
    const allRecipes: ProductRecipe[] = [];
    if (directRecipe && directRecipe.ingredients.length > 0) {
      allRecipes.push(directRecipe);
    }
    // Follow linked recipes
    (directRecipe?.linkedIngredients ?? [])
      .map(name => recipes.find(r => r.productName === name))
      .filter((r): r is ProductRecipe => r !== undefined && r.productName !== dos.product)
      .forEach(r => {
        if (!allRecipes.some(x => x.productName === r.productName)) {
          allRecipes.push(r);
        }
      });

    allRecipes.forEach(recipe => {
      const recipeName = recipe.productName;
      if (!demandMap.has(recipeName)) {
        demandMap.set(recipeName, {
          recipeName,
          recipeYield: recipe.yield ?? 1,
          demandedBy: [],
          totalDemand: 0,
        });
      }

      const demand = demandMap.get(recipeName)!;
      const existingEntry = demand.demandedBy.find(d => d.productName === dos.product);
      if (existingEntry) {
        existingEntry.qty += dos.qty;
      } else {
        demand.demandedBy.push({ productName: dos.product, qty: dos.qty });
      }
      demand.totalDemand += dos.qty;
    });
  });

  return Array.from(demandMap.values());
}

/**
 * Check existing buffer stock for a recipe and return the available amount.
 */
export function getAvailableBuffer(
  recipeName: string,
  bufferStock: BufferStockEntry[]
): number {
  return bufferStock
    .filter(b => b.recipeName === recipeName && b.status === "available" && b.qty > 0)
    .reduce((sum, b) => sum + b.qty, 0);
}

/**
 * Step 2: Calculate batches needed for a recipe demand, considering buffer stock.
 * Applies yield logic: ceil(netDemand / yield) = batches
 */
export function calculateBatches(
  demand: RecipeDemand,
  recipe: ProductRecipe,
  inventory: InventoryItem[],
  existingBuffer: BufferStockEntry[]
): BatchCalculation {
  const bufferAvailable = getAvailableBuffer(demand.recipeName, existingBuffer);
  const netDemand = Math.max(0, demand.totalDemand - bufferAvailable);
  const yieldPerBatch = demand.recipeYield || 1;
  const batchesNeeded = netDemand > 0 ? Math.ceil(netDemand / yieldPerBatch) : 0;
  const expectedOutput = batchesNeeded * yieldPerBatch;

  const scaleIngredients = (items: { inventoryId: string; name: string; qtyPerBatch: number; unit: string }[]) =>
    items.map(item => ({
      ...item,
      totalQty: item.qtyPerBatch * batchesNeeded,
    }));

  return {
    recipeName: demand.recipeName,
    totalDemand: demand.totalDemand,
    recipeYield: yieldPerBatch,
    batchesNeeded,
    expectedOutput,
    bufferFromPrevious: bufferAvailable,
    netDemand,
    requiredIngredients: scaleIngredients(recipe.ingredients),
    requiredPackaging: scaleIngredients(recipe.packagingMaterials ?? []),
    requiredDeco: scaleIngredients(recipe.decorationSupplies ?? []),
  };
}

/**
 * Step 3: Allocate produced output back to individual products.
 * Any excess becomes buffer stock.
 */
export function allocateOutput(
  batch: BatchCalculation,
  demands: RecipeDemand["demandedBy"]
): OutputAllocation {
  let remaining = batch.expectedOutput;
  const allocations: OutputAllocation["allocations"] = [];

  // Sort demands: fulfill smallest first to maximize distribution
  const sorted = [...demands].sort((a, b) => a.qty - b.qty);

  sorted.forEach((d, i) => {
    const allocated = Math.min(d.qty, remaining);
    allocations.push({
      productName: d.productName,
      demandQty: d.qty,
      allocatedQty: allocated,
      priority: i + 1,
    });
    remaining -= allocated;
  });

  return {
    recipeName: batch.recipeName,
    producedQty: batch.expectedOutput,
    allocations,
    bufferStock: remaining,
  };
}

/**
 * Create buffer stock entries from output allocation excess.
 */
export function createBufferStockEntries(
  allocation: OutputAllocation,
  batchRef: string,
  date: string
): BufferStockEntry[] {
  if (allocation.bufferStock <= 0) return [];

  return [
    {
      id: `BUF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipeName: allocation.recipeName,
      qty: allocation.bufferStock,
      unit: "pcs",
      source: "production-plan",
      batchRef,
      dateCreated: date,
      status: "available" as const,
    },
  ];
}

/**
 * Consume buffer stock for a recipe (marks as used).
 */
export function consumeBufferStock(
  recipeName: string,
  qtyToConsume: number,
  bufferStock: BufferStockEntry[],
  usedIn: string
): { updated: BufferStockEntry[]; consumed: number } {
  let remaining = qtyToConsume;
  const updated = bufferStock.map(b => {
    if (remaining <= 0 || b.recipeName !== recipeName || b.status !== "available" || b.qty <= 0) return b;
    const take = Math.min(b.qty, remaining);
    remaining -= take;
    return {
      ...b,
      qty: b.qty - take,
      status: b.qty - take <= 0 ? "used" as const : "available" as const,
      usedIn: usedIn || b.usedIn,
    };
  });
  return { updated, consumed: qtyToConsume - remaining };
}

/**
 * Build a complete ProductionPlan from DOS items.
 */
export function buildProductionPlan(
  dosItems: DOSItem[],
  recipes: ProductRecipe[],
  inventory: InventoryItem[],
  existingBuffer: BufferStockEntry[],
  createdBy: string
): Omit<ProductionPlan, "id" | "createdAt"> {
  const recipeDemands = aggregateRecipeDemand(dosItems, recipes);

  const batchCalculations = recipeDemands.map(demand => {
    const recipe = recipes.find(r => r.productName === demand.recipeName)!;
    return calculateBatches(demand, recipe, inventory, existingBuffer);
  });

  const outputAllocations = batchCalculations.map((batch, i) =>
    allocateOutput(batch, recipeDemands[i].demandedBy)
  );

  const date = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
  const batchRef = `PP-${Date.now()}`;

  const bufferStockCreated = outputAllocations.flatMap(a =>
    createBufferStockEntries(a, batchRef, date)
  );

  return {
    date,
    dosItems,
    recipeDemands,
    batchCalculations,
    outputAllocations,
    bufferStockCreated,
    bufferStockUsed: [],
    status: "draft",
    createdBy,
  };
}

/**
 * Sum total ingredients needed across all batch calculations.
 */
export function sumIngredients(batches: BatchCalculation[]) {
  const map = new Map<string, { name: string; totalQty: number; unit: string; inventoryId: string }>();
  batches.forEach(b => {
    b.requiredIngredients.forEach(ing => {
      const existing = map.get(ing.inventoryId);
      if (existing) {
        existing.totalQty += ing.totalQty;
      } else {
        map.set(ing.inventoryId, { name: ing.name, totalQty: ing.totalQty, unit: ing.unit, inventoryId: ing.inventoryId });
      }
    });
  });
  return Array.from(map.values());
}

/**
 * Sum total packaging needed across all batch calculations.
 */
export function sumPackaging(batches: BatchCalculation[]) {
  const map = new Map<string, { name: string; totalQty: number; unit: string; inventoryId: string }>();
  batches.forEach(b => {
    b.requiredPackaging.forEach(p => {
      const existing = map.get(p.inventoryId);
      if (existing) {
        existing.totalQty += p.totalQty;
      } else {
        map.set(p.inventoryId, { name: p.name, totalQty: p.totalQty, unit: p.unit, inventoryId: p.inventoryId });
      }
    });
  });
  return Array.from(map.values());
}

/**
 * Sum total decoration supplies needed across all batch calculations.
 */
export function sumDecoSupplies(batches: BatchCalculation[]) {
  const map = new Map<string, { name: string; totalQty: number; unit: string; inventoryId: string }>();
  batches.forEach(b => {
    b.requiredDeco.forEach(d => {
      const existing = map.get(d.inventoryId);
      if (existing) {
        existing.totalQty += d.totalQty;
      } else {
        map.set(d.inventoryId, { name: d.name, totalQty: d.totalQty, unit: d.unit, inventoryId: d.inventoryId });
      }
    });
  });
  return Array.from(map.values());
}

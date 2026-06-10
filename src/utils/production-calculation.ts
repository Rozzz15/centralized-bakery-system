import type {
  DOSItem, ProductRecipe, InventoryItem,
  RecipeDemand, BatchCalculation, OutputAllocation, ProductionPlan,
} from "../types";

export function aggregateRecipeDemand(
  dosItems: DOSItem[],
  recipes: ProductRecipe[]
): RecipeDemand[] {
  const demandMap = new Map<string, RecipeDemand>();

  dosItems.forEach(dos => {
    const directRecipe = recipes.find(r => r.productName === dos.product);

    const allRecipes: ProductRecipe[] = [];
    if (directRecipe && directRecipe.ingredients.length > 0) {
      allRecipes.push(directRecipe);
    }
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

export function calculateBatches(
  demand: RecipeDemand,
  recipe: ProductRecipe,
  inventory: InventoryItem[],
): BatchCalculation {
  const netDemand = demand.totalDemand;
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
    netDemand,
    requiredIngredients: scaleIngredients(recipe.ingredients),
    requiredPackaging: scaleIngredients(recipe.packagingMaterials ?? []),
    requiredDeco: scaleIngredients(recipe.decorationSupplies ?? []),
  };
}

export function allocateOutput(
  batch: BatchCalculation,
  demands: RecipeDemand["demandedBy"]
): OutputAllocation {
  let remaining = batch.expectedOutput;
  const allocations: OutputAllocation["allocations"] = [];

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
  };
}

export function buildProductionPlan(
  dosItems: DOSItem[],
  recipes: ProductRecipe[],
  inventory: InventoryItem[],
  createdBy: string
): Omit<ProductionPlan, "id" | "createdAt"> {
  const recipeDemands = aggregateRecipeDemand(dosItems, recipes);

  const batchCalculations = recipeDemands.map(demand => {
    const recipe = recipes.find(r => r.productName === demand.recipeName)!;
    return calculateBatches(demand, recipe, inventory);
  });

  const outputAllocations = batchCalculations.map((batch, i) =>
    allocateOutput(batch, recipeDemands[i].demandedBy)
  );

  const date = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];

  return {
    date,
    dosItems,
    recipeDemands,
    batchCalculations,
    outputAllocations,
    status: "draft",
    createdBy,
  };
}

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

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ProductionTask, DOSItem, BakerIngredientRequest, ProductRecipe, RecipeIngredient, FreezerItem, FreezerHistory, InventoryItem, ProductPricing, StockTransaction } from "../types";
import * as db from "../lib/db";

type Props = {
  production: ProductionTask[];
  dosItems: DOSItem[];
  onCompleteTask: (taskId: string) => void;
  activeTab: string;
  productCatalog: string[];
  recipes: ProductRecipe[];
  newDOSIds?: Set<string>;
  onMarkDOSSeen?: (ids: string[]) => void;
  freezerItems?: FreezerItem[];
  onUpdateFreezer?: (cb: FreezerItem[] | ((prev: FreezerItem[]) => FreezerItem[])) => void;
  freezerHistory?: FreezerHistory[];
  inventory?: InventoryItem[];
  onUpdateInventory?: (cb: InventoryItem[] | ((prev: InventoryItem[]) => InventoryItem[])) => void;
  onUpdateDOS?: (cb: DOSItem[] | ((prev: DOSItem[]) => DOSItem[])) => void;
  productPricing?: ProductPricing[];
  onStockTransaction?: (tx: StockTransaction) => void;
};

const steps = [
  { id: "dos", label: "📋 DOS Review" },
  { id: "acknowledge", label: "✅ Acknowledge Task" },
  { id: "record", label: "🏭 Record Actual Production" },
  { id: "complete", label: "✅ Complete Production" },
];

export default function BakerDashboard({ production, dosItems, onCompleteTask, activeTab, productCatalog, recipes, newDOSIds, onMarkDOSSeen, freezerItems = [], onUpdateFreezer, freezerHistory = [], inventory = [], onUpdateInventory, onUpdateDOS, productPricing = [], onStockTransaction }: Props) {
  const [step, setStep] = useState(0);
  const [startedRecipes, setStartedRecipes] = useState<Set<string>>(new Set());
  const [startingRecipe, setStartingRecipe] = useState<string | null>(null);
  const [actualProduction, setActualProduction] = useState<Record<string, number>>({});
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [additionalIngredients, setAdditionalIngredients] = useState<Record<string, { name: string; qty: number; unit: string; sourceType: "freezer" | "inventory"; sourceId: string }[]>>({});
  const [selectedFillings, setSelectedFillings] = useState<Record<string, { name: string; qty: number }[]>>({});
  const [fillingPickerName, setFillingPickerName] = useState("");
  const [fillingPickerQty, setFillingPickerQty] = useState("");
  const [showIngredientPicker, setShowIngredientPicker] = useState(false);
  const [ingredientPickerSearch, setIngredientPickerSearch] = useState("");
  const [pickQuantities, setPickQuantities] = useState<Record<string, number>>({});
  const [ingredientReqs, setIngredientReqs] = useState<BakerIngredientRequest[]>([]);
  const [saveDestination, setSaveDestination] = useState<"baker-freezer" | "deco-inventory">("baker-freezer");
  const [sent, setSent] = useState(false);
  const [expandedDOS, setExpandedDOS] = useState<Set<string>>(new Set());
  const toggleDOS = (id: string) => setExpandedDOS(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [expandedSched, setExpandedSched] = useState<Set<string>>(new Set());
  const toggleSched = (date: string) => setExpandedSched(prev => { const n = new Set(prev); if (n.has(date)) n.delete(date); else n.add(date); return n; });

  // Filling state
  const [fillingName, setFillingName] = useState("");
  const [fillingQty, setFillingQty] = useState("");
  const [fillingSearch, setFillingSearch] = useState("");

  // Freezer state
  const [showAddFreezer, setShowAddFreezer] = useState(false);
  const [showEditFreezer, setShowEditFreezer] = useState(false);
  const [editingFreezerItem, setEditingFreezerItem] = useState<FreezerItem | null>(null);
  const [newProduct, setNewProduct] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("pcs");
  const [newBatch, setNewBatch] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [showAddBakedProduct, setShowAddBakedProduct] = useState(false);
  const [addBakedProduct, setAddBakedProduct] = useState("");
  const [addBakedSize, setAddBakedSize] = useState("");
  const [addBakedQty, setAddBakedQty] = useState("");
  const [freezerSearch, setFreezerSearch] = useState("");
  const [freezerTab, setFreezerTab] = useState<"baked-products" | "my-inventory" | "deco-production-recipe" | "deco-inventory">("baked-products");

  // Conversion-to-Product state
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertProduct, setConvertProduct] = useState<string | null>(null);
  const [convertTargetProduct, setConvertTargetProduct] = useState("");
  const [convertQty, setConvertQty] = useState<number>(0);
  const [converting, setConverting] = useState(false);
  const [convertAddedIngredients, setConvertAddedIngredients] = useState<{ name: string; qty: number; unit: string; sourceId: string }[]>([]);
  const [convertSelectedFilling, setConvertSelectedFilling] = useState("");
  const [convertFillingQty, setConvertFillingQty] = useState<number>(0);
  const [convertSize, setConvertSize] = useState("");
  const [showConvertIngredientPicker, setShowConvertIngredientPicker] = useState(false);
  const [convertIngredientSearch, setConvertIngredientSearch] = useState("");
  const [convertPickQuantities, setConvertPickQuantities] = useState<Record<string, number>>({});
  const [convertMode, setConvertMode] = useState<"product" | "deco">("product");

  // Bake selection flow state
  const [bakerBakeQty, setBakerBakeQty] = useState<Record<string, number>>({});
  const [selectedForBaking, setSelectedForBaking] = useState<Set<string>>(new Set());
  const [withdrawnQtys, setWithdrawnQtys] = useState<Record<string, Record<string, number>>>({});
  const [modalSearch, setModalSearch] = useState("");
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [productCategoryMap, setProductCategoryMap] = useState<Record<string, string>>({});
  const [showAddInventory, setShowAddInventory] = useState(false);
  const [addInvProduct, setAddInvProduct] = useState("");
  const [addInvQty, setAddInvQty] = useState(0);
  const [addInvCategory, setAddInvCategory] = useState("ingredients");

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    db.fetchBakerIngredientRequests().then(setIngredientReqs).catch(() => {});
  }, []);

  useEffect(() => {
    db.fetchProductCategories().then(map => setProductCategoryMap(map)).catch(() => {});
  }, []);

  useEffect(() => {
    if (step === 0 && bakerDOS.length > 0 && newDOSIds && onMarkDOSSeen) {
      const unseen = bakerDOS.filter(d => newDOSIds.has(d.id));
      if (unseen.length > 0) onMarkDOSSeen(unseen.map(d => d.id));
    }
  }, [step]);

  const todayStr = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
  const todayDOS = dosItems.filter(d => {
    if (d.status === "scheduled" && d.scheduledDate && d.scheduledDate > todayStr) return false;
    if (d.scheduledDate) return d.scheduledDate === todayStr;
    const ts = d.id.match(/DOS-(\d+)/)?.[1];
    if (!ts) return true;
    const itemDate = new Date(Number(ts)).toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    return itemDate === todayStr;
  });
  // Compute Deco Production Recipe items for the step wizard
  // Also include items assembled from Advanced Premix by the baker
  const decoProductionItems = freezerItems.filter(i => 
    i.status === "stored" && i.qty > 0 && (
      i.producedBy === "deco" ||
      (i.producedBy === "baker" && i.notes === "Production Recipe (Assembled)")
    )
  );

  // Shared helpers for recipe matching
  const getBaseName = (name: string) =>
    name.toLowerCase().replace(/[\s]*[\(\*\d].*$/, '').trim();
  const findRecipe = (productName: string) => {
    const pn = productName.toLowerCase();
    const exact = recipes.filter(r => r.productName.toLowerCase() === pn);
    const withLinks = exact.find(r => (r.linkedIngredients ?? []).length > 0);
    if (withLinks) return withLinks;
    if (exact.length > 0) return exact[0];
    return recipes.find(r => r.linkedIngredients?.some(l => l.toLowerCase() === pn)) ??
      recipes.find(r => getBaseName(r.productName) === getBaseName(productName));
  };

  // Recursively collect ingredients from a recipe and all its linked sub-recipes
  const getRecipeIngredients = (recipe: ProductRecipe | undefined, visited = new Set<string>()): RecipeIngredient[] => {
    if (!recipe || visited.has(recipe.productName.toLowerCase())) return [];
    visited.add(recipe.productName.toLowerCase());
    const all: RecipeIngredient[] = [...recipe.ingredients];
    (recipe.linkedIngredients ?? []).forEach(linkedName => {
      const subRecipe = recipes.find(r => r.productName.toLowerCase() === linkedName.toLowerCase());
      if (subRecipe) {
        all.push(...getRecipeIngredients(subRecipe, visited));
      }
    });
    return all;
  };

  const bakerDOS = todayDOS.filter(d => (d.roles ?? []).includes("baker"));
  const decoProductSet = new Set(decoProductionItems.map(i => i.productName));
  // Total DOS qty per product (for display)
  const dosQtyMap = new Map<string, number>();
  bakerDOS.forEach(d => { dosQtyMap.set(d.product, (dosQtyMap.get(d.product) || 0) + d.qty); });
  // Already baked qty per product (from freezer items — survives refresh)
  const bakedQtyMap = new Map<string, number>();
  freezerItems.filter(i => i.producedBy === "baker" && i.status === "stored" && i.notes !== "Production Recipe (Assembled)").forEach(i => {
    bakedQtyMap.set(i.productName, (bakedQtyMap.get(i.productName) || 0) + i.qty);
  });
  // Actual Deco production output per product
  const decoOutputMap = new Map<string, number>();
  const decoCompletedProducts = new Set<string>();
  // Check both completed deco DOS and completed deco production tasks
  dosItems.filter(d => d.roles?.includes("deco")).forEach(d => {
    if (d.status === "completed") {
      const recipe = findRecipe(d.product);
      const recipeName = recipe?.productName || d.product;
      decoCompletedProducts.add(recipeName);
      recipe?.linkedIngredients?.forEach(l => decoCompletedProducts.add(l));
    }
  });
  production.filter(p => p.assignedTo === "deco" && p.status === "completed").forEach(p => {
    const recipe = findRecipe(p.product);
    const recipeName = recipe?.productName || p.product;
    decoCompletedProducts.add(recipeName);
    recipe?.linkedIngredients?.forEach(l => decoCompletedProducts.add(l));
  });
  decoProductionItems.forEach(i => {
    // Baker-made pre-mixes (Production Recipe Assembled) are always ready;
    // Deco-made items only count if Deco completed their DOS for this product
    if (i.producedBy === "baker" || decoCompletedProducts.has(i.productName)) {
      const addOutput = (name: string) => decoOutputMap.set(name, (decoOutputMap.get(name) || 0) + i.qty);
      addOutput(i.productName);
      // Also map under linked recipe names so display name matches (e.g. "Streusel Toppings")
      const linkedNames = recipes.find(r => r.productName.toLowerCase() === i.productName.toLowerCase())?.linkedIngredients ?? [];
      linkedNames.filter(l => l.toLowerCase() !== i.productName.toLowerCase()).forEach(l => addOutput(l));
    }
  });

  // Show all today's DOS products for the baker
  // UI handles Complete / No Stock / Normal states visually
  const myTasks = (() => {
    const seen = new Set<string>();
    return bakerDOS
      .filter(d => {
        if (seen.has(d.product)) return false;
        seen.add(d.product);
        return true;
      })
      .map((d, idx) => {
        const decoQty = decoProductionItems
          .filter(i => i.productName === d.product)
          .reduce((s, i) => s + i.qty, 0);
        return {
          id: `TASK-${d.product.replace(/[^a-zA-Z0-9]/g, "-")}`,
          product: d.product,
          target: decoQty,
          completed: 0,
          assignedTo: "baker" as const,
          status: "pending" as const,
        };
      });
  })();
  const tomorrowStr = (() => { const t = new Date(); t.setDate(t.getDate() + 1); return t.toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0]; })();
  const allBakerTasks = production.filter(p => p.assignedTo === "baker");
  const bakerScheduled = dosItems.filter(d => d.status === "scheduled" && d.scheduledDate === tomorrowStr && allBakerTasks.some(t => t.product === d.product));
  const releasedReqs = ingredientReqs.filter(r => r.status === "released");

  let bakerScheduledSection = null as React.ReactNode;
  if (bakerScheduled.length > 0) {
    const byDate = new Map<string, DOSItem[]>();
    bakerScheduled.forEach(i => { const d = i.scheduledDate || "unknown"; if (!byDate.has(d)) byDate.set(d, []); byDate.get(d)!.push(i); });
    bakerScheduledSection = (
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[15px] font-semibold text-zinc-700">Scheduled DOS</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 font-mono">{bakerScheduled.length} item{bakerScheduled.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="space-y-2">
          {[...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => {
            const isOpen = expandedSched.has(date);
            const fmtDate = (d: string) => { try { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" }); } catch { return d; } };
            return (
              <div key={date} className="rounded-2xl border border-zinc-200 overflow-hidden">
                <button onClick={() => toggleSched(date)} className="w-full flex items-center justify-between bg-zinc-50 px-4 py-2 hover:bg-zinc-100 transition-colors text-left">
                  <span className="text-[13px] font-medium text-zinc-800">{fmtDate(date)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500 font-mono">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                    <span className="text-zinc-400 text-[12px]">{isOpen ? "▾" : "▸"}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="divide-y divide-zinc-100">
                    {items.map(item => (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                        <span className="font-medium text-zinc-900">{item.product}</span>
                        <span className="text-zinc-500 font-mono ml-auto">{item.qty}pcs</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const handleSubmitRequest = (id: string) => {
    setIngredientReqs(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, status: "pending-approval" as const } : r);
      db.replaceBakerIngredientRequests(updated).catch(console.error);
      return updated;
    });
  };
  const handleCancelRequest = (id: string) => {
    setIngredientReqs(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, status: "cancelled" as const } : r);
      db.replaceBakerIngredientRequests(updated).catch(console.error);
      return updated;
    });
  };
  const handleSendToKitchen = () => {
    myTasks.forEach(t => {
      const prodTasks = production.filter(p => p.product === t.product && p.assignedTo === "baker");
      prodTasks.forEach(pt => onCompleteTask(pt.id));
    });
    setSent(true);
  };

  const handleStartRecipe = async (productName: string) => {
    setStartingRecipe(productName);
    try {
      const dosToStart = bakerDOS.filter(d => d.product === productName);
      await Promise.all(dosToStart.map(d => db.updateDOS(d.id, { status: "in-progress" })));
      setStartedRecipes(prev => new Set([...prev, productName]));
    } catch (err) {
      console.error("Failed to start recipe:", err);
      alert("Failed to start task. Please try again.");
    } finally {
      setStartingRecipe(null);
    }
  };

  // Refetch freezer items from DB when freezer tab becomes active
  useEffect(() => {
    if (activeTab === "freezer") {
      db.fetchFreezerItems().then(items => onUpdateFreezer?.(items)).catch(console.error);
    }
  }, [activeTab]);

  /* ── Conversion Tab ── */
  if (activeTab === "conversion") {
    const decoProductionItems = freezerItems.filter(i =>
      i.status === "stored" && i.qty > 0 && i.producedBy === "deco" && i.notes?.startsWith("Production Recipe")
    );
    const grouped = new Map<string, { items: FreezerItem[]; totalQty: number }>();
    decoProductionItems.forEach(i => {
      if (!grouped.has(i.productName)) grouped.set(i.productName, { items: [], totalQty: 0 });
      const g = grouped.get(i.productName)!;
      g.items.push(i);
      g.totalQty += i.qty;
    });

    const handleConvert = async () => {
      if (!convertProduct || convertQty <= 0 || !convertTargetProduct) return;
      setConverting(true);
      try {
        const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];

        const group = grouped.get(convertProduct);
        if (!group) return;
        const sortedItems = [...group.items].sort(
          (a, b) => (a.dateProduced || "").localeCompare(b.dateProduced || "")
        );

        let toDeduct = convertQty;
        const updatedDecoItems: FreezerItem[] = [];
        const newHistory: FreezerHistory[] = [];

        const refLabel = convertMode === "deco" ? "Sent to Deco" : "baking";
        for (const item of sortedItems) {
          if (toDeduct <= 0) break;
          const deduct = Math.min(toDeduct, item.qty);
          updatedDecoItems.push({ ...item, qty: item.qty - deduct });
          toDeduct -= deduct;
          newHistory.push({
            id: `FH-${Date.now()}-CNV-${Math.random().toString(36).slice(2, 6)}`,
            productName: convertProduct,
            producedBy: "baker",
            qtyChanged: -deduct,
            action: "deducted",
            reference: `Used ${deduct} pcs from ${convertProduct} premix for ${refLabel}`,
            timestamp: new Date().toISOString(),
          });
        }

        // Deduct filling from inventory
        if (convertSelectedFilling && convertFillingQty > 0) {
          const fillingInvItem = inventory.find(i =>
            i.name === convertSelectedFilling &&
            (!i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("baker"))
          );
          if (fillingInvItem) {
            const deduct = Math.min(convertFillingQty, fillingInvItem.onHand);
            if (deduct > 0) {
              onUpdateInventory?.(prev => prev.map(i => i.id === fillingInvItem.id ? { ...i, onHand: Math.max(0, i.onHand - deduct) } : i));
              db.updateInventoryItem(fillingInvItem.id, { onHand: Math.max(0, fillingInvItem.onHand - deduct), group: fillingInvItem.group }).catch(console.error);
              onStockTransaction?.({ id: `STX-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, type: "out", itemName: convertSelectedFilling, itemId: fillingInvItem.id, qty: deduct, unit: fillingInvItem.unit, reference: `Conversion: ${convertTargetProduct}`, timestamp: new Date().toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), target: "baker", group: fillingInvItem.group, role: "baker" });
              newHistory.push({
                id: `FH-${Date.now()}-FILL-${Math.random().toString(36).slice(2, 6)}`,
                productName: convertSelectedFilling,
                producedBy: "baker",
                qtyChanged: -deduct,
                action: "deducted",
                reference: `Used ${deduct} of ${convertSelectedFilling} filling for ${convertTargetProduct}`,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }

        if (convertMode === "deco") {
          // Send to Deco — add to inventory with source "came-from-baker"
          const newItemId = `INV-${Date.now()}-DECO-${convertTargetProduct.replace(/[^a-zA-Z0-9]/g, "")}`;
          const newInvItem: InventoryItem = {
            id: newItemId,
            name: convertTargetProduct,
            sku: "",
            onHand: convertQty,
            unit: "pcs",
            threshold: 0,
            cost: 0,
            supplier: "",
            lastIn: new Date().toISOString(),
            category: "dry",
            group: "ingredients",
            source: "came-from-baker",
            accessRoles: ["deco"],
            size: convertSize || undefined,
          };
          onUpdateInventory?.((prev: InventoryItem[]) => [...prev, newInvItem]);
          db.upsertInventoryItem(newInvItem).catch(console.error);

          newHistory.push({
            id: `FH-${Date.now()}-SND-${Math.random().toString(36).slice(2, 6)}`,
            productName: convertTargetProduct,
            producedBy: "baker",
            qtyChanged: convertQty,
            action: "added",
            reference: `Sent ${convertQty} pcs of ${convertTargetProduct} to Deco Inventory`,
            timestamp: new Date().toISOString(),
          });

          onUpdateFreezer?.((prev: FreezerItem[]) => {
            const updated = new Map(prev.map(i => [i.id, i]));
            updatedDecoItems.forEach(i => updated.set(i.id, i));
            return [...updated.values()];
          });

          await db.upsertFreezerItems(updatedDecoItems).catch(console.error);
          newHistory.forEach(h => db.insertFreezerHistory(h).catch(console.error));

          const ingredientMsg = convertAddedIngredients.length > 0 ? ` + ${convertAddedIngredients.length} ingredient(s)` : "";
          const fillingMsg = convertSelectedFilling ? ` + ${convertFillingQty} ${convertSelectedFilling} filling` : "";
          const sizeMsg = convertSize ? ` (${convertSize})` : "";
          showToast(`Sent ${convertQty} pcs of ${convertTargetProduct}${sizeMsg} from ${convertProduct} premix${ingredientMsg}${fillingMsg} to Deco Inventory.`, "success");
        } else {
          // Convert to Product — add to baker freezer as baked product
          const newItem: FreezerItem = {
            id: `FRZ-${Date.now()}-CNV-${convertTargetProduct.replace(/[^a-zA-Z0-9]/g, "")}`,
            productName: convertTargetProduct,
            qty: convertQty,
            unit: "pcs",
            batchRef: `BAKE-${Date.now()}`,
            producedBy: "baker",
            dateProduced: today,
            status: "stored",
            notes: `Baked — Converted from ${convertProduct} premix${convertSelectedFilling ? ` + ${convertSelectedFilling} filling` : ""}`,
            size: convertSize || undefined,
          };

          newHistory.push({
            id: `FH-${Date.now()}-CNV-${Math.random().toString(36).slice(2, 6)}`,
            productName: convertTargetProduct,
            producedBy: "baker",
            qtyChanged: convertQty,
            action: "added",
            reference: `Baked ${convertQty} pcs from ${convertProduct} premix${convertSelectedFilling ? ` + ${convertSelectedFilling} filling` : ""}`,
            timestamp: new Date().toISOString(),
          });

          onUpdateFreezer?.((prev: FreezerItem[]) => {
            const updated = new Map(prev.map(i => [i.id, i]));
            updatedDecoItems.forEach(i => updated.set(i.id, i));
            updated.set(newItem.id, newItem);
            return [...updated.values()];
          });

          await db.upsertFreezerItems([...updatedDecoItems, newItem]).catch(console.error);
          newHistory.forEach(h => db.insertFreezerHistory(h).catch(console.error));

          const ingredientMsg = convertAddedIngredients.length > 0 ? ` + ${convertAddedIngredients.length} ingredient(s)` : "";
          const fillingMsg = convertSelectedFilling ? ` + ${convertFillingQty} ${convertSelectedFilling} filling` : "";
          const sizeMsg = convertSize ? ` (${convertSize})` : "";
          showToast(`Converted ${convertQty} pcs of ${convertTargetProduct}${sizeMsg} from ${convertProduct} premix${ingredientMsg}${fillingMsg}. Saved to Baked Products.`, "success");
        }

        setShowConvertModal(false);
        setConvertQty(0);
        setConvertAddedIngredients([]);
        setConvertSelectedFilling("");
        setConvertFillingQty(0);
        setConvertSize("");
        setConvertMode("product");
      } catch (err) {
        console.error("Conversion failed:", err);
        showToast("Failed to convert. Please try again.", "error");
      } finally {
        setConverting(false);
      }
    };

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-[24px] font-semibold">Conversion</h1>
          <p className="mt-1 text-[13px] text-zinc-600">Deco Production Recipe items available for baking. Convert to Product or Send to Deco Inventory.</p>
        </div>

        {decoProductionItems.length === 0 ? (
          <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-8 text-center shadow-sm">
            <p className="text-[14px] text-zinc-500">No Deco Production Recipe items in freezer.</p>
            <p className="text-[12px] text-zinc-400 mt-1">Items appear here once Deco produces Advanced Premix.</p>
          </div>
        ) : (
          <div className="rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm overflow-hidden">
            {[...grouped.entries()].map(([productName, g], idx) => {
              const dosDemand = dosQtyMap.get(productName) || 0;
              const canCover = g.totalQty >= dosDemand;
              return (
                <div key={productName} className={`${idx > 0 ? 'border-t border-[#E8E0D5]' : ''}`}>
                  <div className="px-5 py-4 space-y-3">
                    <div className="grid grid-cols-10 items-center gap-2">
                      <div className="col-span-4">
                        <div className="text-[14px] font-semibold text-zinc-900">{productName}</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">{g.items.length} batch{g.items.length !== 1 ? 'es' : ''}</div>
                      </div>
                      <div className="col-span-2 text-right">
                        <div className="text-[18px] font-bold text-zinc-800 font-mono">{g.totalQty}</div>
                        <div className="text-[10px] text-zinc-400">pcs available</div>
                      </div>
                      <div className="col-span-4 text-right">
                        {canCover ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-medium text-emerald-700">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Sufficient
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-medium text-amber-700">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Shortage
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setConvertMode("deco"); const r = findRecipe(productName); setConvertProduct(productName); setConvertTargetProduct(r?.productName || productName); setConvertQty(g.totalQty); setConvertAddedIngredients([]); setConvertSelectedFilling(""); setConvertFillingQty(0); setShowConvertModal(true); }}
                        className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
                      >
                        Send to Deco
                      </button>
                      <button
                        onClick={() => { setConvertMode("product"); const r = findRecipe(productName); setConvertProduct(productName); setConvertTargetProduct(r?.productName || productName); setConvertQty(g.totalQty); setConvertAddedIngredients([]); setConvertSelectedFilling(""); setConvertFillingQty(0); setShowConvertModal(true); }}
                        className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-zinc-800 transition-colors shadow-sm"
                      >
                        Convert to Product
                      </button>
                    </div>
                  </div>
                  {g.items.length > 0 && (
                    <div className="px-5 pb-4 space-y-1">
                      {g.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-[12px]">
                          <div className="flex items-center gap-3">
                            <span className="text-zinc-500 font-mono">{item.batchRef}</span>
                            <span className="text-zinc-300">·</span>
                            <span className="text-zinc-400">{item.dateProduced}</span>
                          </div>
                          <span className="font-mono font-semibold text-zinc-700">{item.qty} pcs</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Conversion Modal */}
        {showConvertModal && convertProduct && createPortal((
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowConvertModal(false); setConvertAddedIngredients([]); setConvertSelectedFilling(""); setConvertFillingQty(0); setConvertSize(""); setConvertMode("product"); }}>
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[18px] font-semibold">{convertMode === "deco" ? "Send to Deco" : "Use as Product"}</h2>
                <span className="text-[12px] text-zinc-400 font-mono bg-zinc-50 rounded-lg px-2 py-1">{convertProduct} premix</span>
              </div>
              <p className="text-[13px] text-zinc-500 mb-4">{convertMode === "deco" ? "Send premix to Deco Inventory for decoration use." : "Convert premix into a finished baked product."}</p>

              <div className="space-y-4">
                {/* Product Dropdown + Sizing */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Target Product</label>
                    <select
                      value={convertTargetProduct}
                      onChange={e => {
                        const val = e.target.value;
                        setConvertTargetProduct(val);
                        const dosSizes = dosItems.filter(d => d.product === val && d.size).map(d => d.size!);
                        const defaultSize = dosSizes.length > 0 ? dosSizes.sort((a, b) => dosSizes.filter(v => v === b).length - dosSizes.filter(v => v === a).length)[0] : "";
                        setConvertSize(defaultSize);
                      }}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400"
                    >
                      <option value="">Select product...</option>
                    {productCatalog.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Sizing</label>
                    <select
                      value={convertSize}
                      onChange={e => setConvertSize(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400"
                      disabled={!convertTargetProduct}
                    >
                      <option value="">No size</option>
                      {["Small","Regular","Large","6x1","6x2","6x3","8x1","8x2","8x3","10x1","10x2","10x3","12x1","12x2","14x1","14x2","16x1","Sheet"].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-zinc-50 p-3">
                    <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Available Premix</div>
                    <div className="text-[18px] font-bold text-zinc-800 font-mono">{grouped.get(convertProduct)?.totalQty ?? 0}</div>
                    <div className="text-[10px] text-zinc-400">pcs</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3">
                    <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">DOS Demand</div>
                    <div className="text-[18px] font-bold text-zinc-800 font-mono">{dosQtyMap.get(convertProduct) || 0}</div>
                    <div className="text-[10px] text-zinc-400">pcs</div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Qty to Produce</label>
                  <input
                    type="number"
                    min={1}
                    max={grouped.get(convertProduct)?.totalQty ?? 0}
                    value={convertQty || ""}
                    onChange={e => setConvertQty(Math.min(Number(e.target.value) || 0, grouped.get(convertProduct)?.totalQty ?? 0))}
                    placeholder="0"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[15px] font-mono font-semibold outline-none focus:border-zinc-400"
                  />
                </div>

                {/* Additional Ingredients */}
                <div className="rounded-xl border border-zinc-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Additional Ingredients</span>
                    <button
                      onClick={() => { setShowConvertIngredientPicker(true); setConvertIngredientSearch(""); setConvertPickQuantities({}); }}
                      className="rounded-lg bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-zinc-800 transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                  {convertAddedIngredients.length === 0 ? (
                    <div className="px-4 py-3 text-[12px] text-zinc-400 text-center">No additional ingredients added.</div>
                  ) : (
                    <div className="divide-y divide-zinc-100">
                      {convertAddedIngredients.map((ing, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2">
                          <span className="text-[13px] text-zinc-700">{ing.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-zinc-500 font-mono">{ing.qty} {ing.unit}</span>
                            <button
                              onClick={() => {
                                const removed = convertAddedIngredients[i];
                                const invItem = inventory.find(inv => inv.id === removed.sourceId);
                                const oldOnHand = invItem?.onHand ?? 0;
                                onUpdateInventory?.(prev => prev.map(inv => inv.id === removed.sourceId ? { ...inv, onHand: inv.onHand + removed.qty } : inv));
                                db.updateInventoryItem(removed.sourceId, { onHand: oldOnHand + removed.qty, group: invItem?.group ?? "ingredients" }).catch(console.error);
                                setConvertAddedIngredients(prev => prev.filter((_, idx) => idx !== i));
                              }}
                              className="text-red-400 text-[12px] hover:text-red-600"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Filling Selection */}
                <div className="rounded-xl border border-zinc-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Filling</span>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    {(() => {
                      const fillingRecipes = recipes.filter(r => r.group === "filling");
                      const bakerInv = inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("baker"));
                      const fillingOptions = fillingRecipes.map(fr => {
                        const invItem = bakerInv.find(i => i.name === fr.productName);
                        return { name: fr.productName, qty: invItem ? Math.max(0, invItem.onHand) : 0, unit: invItem?.unit || "pcs" };
                      }).filter(f => f.qty > 0);
                      if (fillingOptions.length === 0) {
                        return <div className="text-[12px] text-zinc-400 text-center">No fillings available in My Inventory.</div>;
                      }
                      const maxFillingQty = convertSelectedFilling ? (fillingOptions.find(fo => fo.name === convertSelectedFilling)?.qty ?? 0) : 0;
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={convertSelectedFilling}
                              onChange={e => {
                                setConvertSelectedFilling(e.target.value);
                                const f = fillingOptions.find(fo => fo.name === e.target.value);
                                setConvertFillingQty(f?.qty ?? 0);
                              }}
                              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-zinc-400"
                            >
                              <option value="">No filling</option>
                              {fillingOptions.map(fo => (
                                <option key={fo.name} value={fo.name}>{fo.name} ({fo.qty} {fo.unit} available)</option>
                              ))}
                            </select>
                            <div>
                              <input
                                type="number"
                                min={1}
                                max={maxFillingQty}
                                disabled={!convertSelectedFilling}
                                value={convertSelectedFilling && convertFillingQty > 0 ? convertFillingQty : ""}
                                onChange={e => setConvertFillingQty(Math.min(Number(e.target.value) || 0, maxFillingQty))}
                                placeholder={convertSelectedFilling ? "Qty to use" : "Select filling first"}
                                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] font-mono outline-none focus:border-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setShowConvertModal(false); setConvertQty(0); setConvertAddedIngredients([]); setConvertSelectedFilling(""); setConvertFillingQty(0); setConvertSize(""); setConvertMode("product"); }} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">
                    Cancel
                  </button>
                  <button onClick={handleConvert} disabled={converting || convertQty <= 0 || !convertTargetProduct} className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 disabled:opacity-40">
                    {converting ? (convertMode === "deco" ? "Sending..." : "Converting...") : (convertMode === "deco" ? "Send to Deco" : "Convert to Product")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ), document.body)}

        {/* Ingredient Picker for Conversion */}
        {showConvertIngredientPicker && convertProduct && createPortal((() => {
          const bakerAccessInventory = inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("baker"));
          const pickerItems = bakerAccessInventory.filter(i => i.group === "ingredients").map(i => ({ id: i.id, name: i.name, qty: i.onHand, unit: i.unit }));
          const searchLower = convertIngredientSearch.toLowerCase();
          const filtered = pickerItems.filter(i => i.name.toLowerCase().includes(searchLower));
          const addedIds = new Set(convertAddedIngredients.map(i => i.sourceId));
          return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="fixed inset-0 bg-black/40" onClick={() => setShowConvertIngredientPicker(false)} />
              <div className="relative bg-white border border-zinc-200 rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                  <h3 className="text-[16px] font-semibold text-zinc-900">Add Ingredient</h3>
                  <button onClick={() => setShowConvertIngredientPicker(false)} className="rounded-lg p-1 hover:bg-zinc-100 transition-colors">
                    <span className="text-zinc-400 text-[18px]">✕</span>
                  </button>
                </div>
                <div className="p-5 space-y-3">
                  <input type="text" value={convertIngredientSearch} onChange={e => setConvertIngredientSearch(e.target.value)} placeholder="Search ingredients..." className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-[13px] outline-none focus:border-zinc-400" />
                  {filtered.length === 0 ? (
                    <div className="text-center py-8"><p className="text-[13px] text-zinc-400">No ingredients found.</p></div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {filtered.map(item => {
                        const isAdded = addedIds.has(item.id);
                        const pickQty = convertPickQuantities[item.id] ?? 0;
                        return (
                          <div key={item.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2.5">
                            <div>
                              <div className="text-[13px] text-zinc-800 font-medium">{item.name}</div>
                              <div className="text-[11px] text-zinc-400 font-mono mt-0.5">On Hand: {item.qty} {item.unit}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isAdded ? (
                                <span className="text-[11px] text-emerald-600 font-semibold">Added</span>
                              ) : (
                                <>
                                  <input type="number" min={0} max={item.qty} value={pickQty > 0 ? pickQty : ""} onChange={e => setConvertPickQuantities(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))} placeholder="Qty" className="w-16 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[12px] font-mono text-center outline-none focus:border-zinc-400" />
                                  <button onClick={() => {
                                    const qty = convertPickQuantities[item.id] ?? 0;
                                    if (qty <= 0 || qty > item.qty) return;
                                    onUpdateInventory?.(prev => prev.map(i => i.id === item.id ? { ...i, onHand: Math.max(0, i.onHand - qty) } : i));
                                    const invItem = inventory.find(inv => inv.id === item.id);
                                    db.updateInventoryItem(item.id, { onHand: Math.max(0, item.qty - qty), group: invItem?.group ?? "ingredients" }).catch(console.error);
                                    onStockTransaction?.({ id: `STX-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, type: "out", itemName: item.name, itemId: item.id, qty, unit: item.unit, reference: `Conversion: additional ingredient`, timestamp: new Date().toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), target: "baker", group: invItem?.group ?? "ingredients", role: "baker" });
                                    setConvertAddedIngredients(prev => [...prev, { name: item.name, qty, unit: item.unit, sourceId: item.id }]);
                                    setConvertPickQuantities(prev => ({ ...prev, [item.id]: 0 }));
                                  }} disabled={!convertPickQuantities[item.id] || convertPickQuantities[item.id] <= 0} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-800 disabled:opacity-30 transition-all">
                                    Add
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })(        ), document.body)}

        {/* Toast Notification */}
        {toast && createPortal((
          <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }} onClick={() => setToast(null)}>
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
              <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full mx-auto ${toast.type === "success" ? "bg-emerald-100" : "bg-red-100"}`}>
                <span className={`text-[28px] ${toast.type === "success" ? "text-emerald-600" : "text-red-600"}`}>{toast.type === "success" ? "✓" : "✗"}</span>
              </div>
              <h3 className="text-[16px] font-semibold text-zinc-900">{toast.type === "success" ? "Success" : "Error"}</h3>
              <p className="mt-1.5 text-center text-[13px] leading-relaxed text-zinc-500">{toast.message}</p>
              <button onClick={() => setToast(null)} className="mt-5 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-colors">Got it</button>
            </div>
          </div>
        ), document.body)}
      </div>
    );
  }

  /* ── Filling Tab ── */
  if (activeTab === "filling") {
    const fillings = freezerItems.filter(i => i.notes === "Filling" && i.status === "stored").sort((a, b) => b.id.localeCompare(a.id));
    const filtered = fillingSearch ? fillings.filter(i => i.productName.toLowerCase().includes(fillingSearch.toLowerCase())) : fillings;

    const handleAddFilling = () => {
      if (!fillingName.trim() || !fillingQty) return;
      const batchQty = Number(fillingQty);
      const recipe = recipes.find(r => r.productName === fillingName.trim());
      if (!recipe) { alert("No recipe found for this filling."); return; }

      // Deduct ingredients from inventory
      let workingInv = inventory;
      const deductions: string[] = [];
      recipe.ingredients.forEach(ing => {
        const match = ing.inventoryId
          ? workingInv.find(i => i.id === ing.inventoryId)
          : workingInv.find(i => i.name.toLowerCase() === ing.name.toLowerCase());
        if (!match) { deductions.push(`${ing.name} (not in inventory — skipped)`); return; }
        const idx = workingInv.findIndex(i => i.id === match.id);
        const needed = ing.qtyPerBatch * batchQty;
        const before = workingInv[idx].onHand;
        workingInv = workingInv.map((it, i) => i === idx ? { ...it, onHand: Math.max(0, before - needed) } : it);
        const actual = before - workingInv[idx].onHand;
        deductions.push(`${ing.name} -${actual}${ing.unit}`);
      });
      const changedItems = workingInv.filter(item => {
        const orig = inventory.find(o => o.id === item.id);
        return orig && Math.abs(orig.onHand - item.onHand) > 0.0001;
      });
      if (changedItems.length > 0) {
        onUpdateInventory?.(workingInv);
        db.upsertInventory(changedItems).catch(err => console.error("Failed to deduct ingredients:", err));
        changedItems.forEach(item => {
          const orig = inventory.find(o => o.id === item.id);
          if (orig && orig.onHand > item.onHand) {
            onStockTransaction?.({ id: `STX-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, type: "out", itemName: item.name, itemId: item.id, qty: orig.onHand - item.onHand, unit: item.unit, reference: `Filling: ${fillingName.trim()} ×${batchQty}`, timestamp: new Date().toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), target: "baker", group: item.group, role: "baker" });
          }
        });
      }

      // Save filling to freezer — always create a new entry
      const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
      const item: FreezerItem = {
        id: `FRZ-${Date.now()}`,
        productName: fillingName.trim(),
        qty: batchQty,
        unit: "batches",
        batchRef: `BATCH-${Date.now()}`,
        producedBy: "baker",
        dateProduced: today,
        status: "stored",
        notes: "Filling",
      };
      onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, item]);
      db.upsertFreezerItems([item]).catch(console.error);

      // Add to My Inventory (or increment existing)
      const existingInv = inventory.find(i => i.name === fillingName.trim() && i.group === "ingredients");
      if (existingInv) {
        db.updateInventoryItem(existingInv.id, { onHand: existingInv.onHand + batchQty, group: "ingredients" }).catch(console.error);
        onUpdateInventory?.(prev => prev.map(i => i.id === existingInv.id ? { ...i, onHand: i.onHand + batchQty } : i));
      } else {
        const newInv: InventoryItem = {
          id: `INV-${Date.now()}`,
          name: fillingName.trim(),
          onHand: batchQty,
          unit: "batches",
          sku: `FILL-${Date.now()}`,
          threshold: 0,
          cost: 0,
          supplier: "",
          lastIn: "",
          category: "produce",
          group: "ingredients",
          accessRoles: ["baker"],
        };
        onUpdateInventory?.(prev => [...prev, newInv]);
        db.upsertInventoryItem(newInv).catch(console.error);
      }

      setFillingName(""); setFillingQty("");
    };

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-8 shadow-lg">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-[36px] font-bold tracking-tight text-white">Filling History</h1>
              <p className="mt-2 text-[15px] text-zinc-400">All filling batches produced, sorted by newest first.</p>
            </div>
            {fillings.length > 0 && (
              <div className="shrink-0 rounded-2xl bg-white/10 px-6 py-4 text-center border border-white/10">
                <div className="text-[12px] text-zinc-400 uppercase font-semibold tracking-wider">Total Batches</div>
                <div className="text-[32px] font-bold text-white mt-1" style={{ fontFamily: "Fragment Mono, monospace" }}>{fillings.reduce((s, f) => s + f.qty, 0)}</div>
                <div className="text-[12px] text-zinc-500 mt-1">{fillings.length} filling{fillings.length > 1 ? "s" : ""}</div>
              </div>
            )}
          </div>
        </div>

        {/* Add Filling Form */}
        <div className="rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-8 shadow-lg">
          <h2 className="text-[20px] font-bold text-white mb-5">New Filling Batch</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[13px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 block">Filling Name</label>
              <input value={fillingName} onChange={e => setFillingName(e.target.value)} placeholder="e.g. Vanilla Custard" list="filling-list" className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-[15px] text-white placeholder:text-zinc-500 outline-none focus:border-amber-500 transition-colors" />
              <datalist id="filling-list">
                {recipes.filter(r => r.group === "filling").map(r => <option key={r.productName} value={r.productName} />)}
              </datalist>
            </div>
            <div>
              <label className="text-[13px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 block">Qty Produced</label>
              <input type="number" min={1} value={fillingQty} onChange={e => setFillingQty(e.target.value)} placeholder="0" className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-[15px] text-white placeholder:text-zinc-500 outline-none focus:border-amber-500 transition-colors" />
            </div>
            <div className="flex items-end">
              <button onClick={handleAddFilling} disabled={!fillingName.trim() || !fillingQty} className="w-full rounded-2xl bg-white px-6 py-3.5 text-[15px] font-bold text-zinc-900 hover:bg-zinc-100 hover:shadow-xl disabled:opacity-40 transition-all active:scale-[0.98]">Create Filling</button>
            </div>
          </div>
        </div>

        {/* Fillings List */}
        <div className="rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-700">
            <h2 className="text-[20px] font-bold text-white">Filling Batches History</h2>
            <div className="relative max-w-[240px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[15px]">⌕</span>
              <input value={fillingSearch} onChange={e => setFillingSearch(e.target.value)} placeholder="Search..." className="w-full rounded-xl border border-zinc-700 bg-zinc-800 pl-9 pr-4 py-2.5 text-[14px] text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-800 border-b border-zinc-700">
                <tr className="text-[13px] uppercase tracking-wider text-zinc-300 font-semibold">
                  <th className="px-8 py-4">Filling</th>
                  <th className="px-8 py-4 text-right">Qty</th>
                  <th className="px-8 py-4">Date</th>
                  <th className="px-8 py-4">Batch</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-8 py-16 text-center text-[15px] text-zinc-500">No filling history yet.</td></tr>
                ) : filtered.map(f => (
                  <tr key={f.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-8 py-4"><div className="text-[15px] font-semibold text-zinc-100">{f.productName}</div></td>
                    <td className="px-8 py-4 text-[15px] text-right font-mono font-bold text-zinc-200">{f.qty}</td>
                    <td className="px-8 py-4 text-[13px] text-zinc-400">{f.dateProduced ? new Date(f.dateProduced + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                    <td className="px-8 py-4 text-[13px] text-zinc-400 font-mono">{f.batchRef || "—"}</td>
                    <td className="px-8 py-4 text-right">
                      <button onClick={() => { if (confirm(`Delete ${f.productName} batch?`)) { const updated = freezerItems.filter(x => x.id !== f.id); onUpdateFreezer?.(updated); db.deleteFreezerItem(f.id).catch(console.error); } }} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-100 transition-all">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  /* ── Freezer Tab ── */
  if (activeTab === "freezer") {
    const bakerItems = freezerItems.filter(i => i.producedBy === "baker" && i.status === "stored" && i.notes !== "Production Recipe (Assembled)" && i.notes !== "Filling");
    const bakerAccessInventory = inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("baker"))
      .sort((a, b) => {
        const aIsFilling = recipes.some(r => r.productName === a.name && r.group === "filling");
        const bIsFilling = recipes.some(r => r.productName === b.name && r.group === "filling");
        if (aIsFilling && !bIsFilling) return -1;
        if (!aIsFilling && bIsFilling) return 1;
        return a.name.localeCompare(b.name);
      });
    const decoItems = freezerItems.filter(i =>
      i.status === "stored" && i.qty > 0 && i.producedBy === "deco" && i.notes?.startsWith("Production Recipe")
    );

    const decoInventoryItems = inventory.filter(i => i.source === "came-from-baker" && i.accessRoles?.includes("deco"));
    const tabItems = freezerTab === "baked-products" ? bakerItems : freezerTab === "my-inventory" ? bakerAccessInventory : freezerTab === "deco-inventory" ? decoInventoryItems as unknown as FreezerItem[] : decoItems;
    const filtered = tabItems.filter(i => !freezerSearch || (("name" in i ? (i as unknown as InventoryItem).name : (i as FreezerItem).productName).toLowerCase().includes(freezerSearch.toLowerCase())));

    const handleAdd = () => {
      if (!newProduct.trim() || !newQty) return;
      const item: FreezerItem = {
        id: `FRZ-${Date.now()}`,
        productName: newProduct.trim(),
        qty: Number(newQty),
        unit: newUnit,
        batchRef: newBatch.trim(),
        producedBy: "baker",
        dateProduced: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0],
        status: "stored",
        notes: newNotes.trim(),
      };
      onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, item]);
      db.upsertFreezerItems([item]).catch(console.error);
      setShowAddFreezer(false);
      setNewProduct(""); setNewQty(""); setNewBatch(""); setNewNotes("");
    };

    const canEdit = (item: FreezerItem) => item.producedBy === "baker";

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-3xl bg-white p-8 shadow-lg border border-zinc-200">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-[36px] font-bold tracking-tight text-zinc-900">Freezer</h1>
              <p className="mt-2 text-[15px] text-zinc-500">Browse all freezer stocks by category.</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 rounded-2xl bg-zinc-100 p-1.5">
          <button onClick={() => setFreezerTab("baked-products")} className={`flex-1 rounded-xl py-3 text-[14px] font-semibold transition-all ${freezerTab === "baked-products" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>Baked Products</button>
          <button onClick={() => setFreezerTab("my-inventory")} className={`flex-1 rounded-xl py-3 text-[14px] font-semibold transition-all ${freezerTab === "my-inventory" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>My Inventory</button>
          <button onClick={() => setFreezerTab("deco-production-recipe")} className={`flex-1 rounded-xl py-3 text-[14px] font-semibold transition-all ${freezerTab === "deco-production-recipe" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>Deco Production Recipe</button>
          <button onClick={() => setFreezerTab("deco-inventory")} className={`flex-1 rounded-xl py-3 text-[14px] font-semibold transition-all ${freezerTab === "deco-inventory" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>Deco Inventory</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button onClick={() => setFreezerTab("baked-products")} className={`rounded-2xl border p-5 text-left transition-all hover:shadow-md ${freezerTab === "baked-products" ? "bg-amber-50 border-amber-300" : "bg-white border-zinc-200 hover:border-zinc-300"}`}><div className="text-[12px] text-zinc-400 uppercase tracking-wider font-semibold">Baked Products</div><div className="text-[28px] font-bold text-zinc-900 mt-2">{bakerItems.length}</div></button>
          <button onClick={() => setFreezerTab("my-inventory")} className={`rounded-2xl border p-5 text-left transition-all hover:shadow-md ${freezerTab === "my-inventory" ? "bg-amber-50 border-amber-300" : "bg-white border-zinc-200 hover:border-zinc-300"}`}><div className="text-[12px] text-zinc-400 uppercase tracking-wider font-semibold">My Inventory</div><div className="text-[28px] font-bold text-zinc-900 mt-2">{bakerAccessInventory.length}</div></button>
          <button onClick={() => setFreezerTab("deco-production-recipe")} className={`rounded-2xl border p-5 text-left transition-all hover:shadow-md ${freezerTab === "deco-production-recipe" ? "bg-amber-50 border-amber-300" : "bg-white border-zinc-200 hover:border-zinc-300"}`}><div className="text-[12px] text-zinc-400 uppercase tracking-wider font-semibold">Deco Production Recipe</div><div className="text-[28px] font-bold text-zinc-900 mt-2">{decoItems.length}</div></button>
          <button onClick={() => setFreezerTab("deco-inventory")} className={`rounded-2xl border p-5 text-left transition-all hover:shadow-md ${freezerTab === "deco-inventory" ? "bg-amber-50 border-amber-300" : "bg-white border-zinc-200 hover:border-zinc-300"}`}><div className="text-[12px] text-zinc-400 uppercase tracking-wider font-semibold">Deco Inventory</div><div className="text-[28px] font-bold text-zinc-900 mt-2">{decoInventoryItems.length}</div></button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-[300px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[15px]">⌕</span>
            <input value={freezerSearch} onChange={e => setFreezerSearch(e.target.value)} placeholder="Search products..." className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-4 py-3 text-[15px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 transition-colors" />
          </div>
        </div>

        <div className="rounded-3xl bg-white shadow-lg border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr className="text-[13px] uppercase tracking-wider text-zinc-500 font-semibold">
                  <th className="px-8 py-4">Product</th>
                  {(freezerTab === "baked-products" || freezerTab === "deco-inventory") && <th className="px-8 py-4">Size</th>}
                  <th className="px-8 py-4 text-right">Qty</th>
                  {freezerTab !== "my-inventory" && freezerTab !== "deco-inventory" && <th className="px-8 py-4">Batch</th>}
                   <th className="px-8 py-4">{freezerTab === "my-inventory" || freezerTab === "deco-inventory" ? "Category" : "Date"}</th>
                  <th className="px-8 py-4">Section</th>
                  <th className="px-8 py-4 text-right">
                    {freezerTab === "my-inventory" && (
                      <button onClick={() => { setAddInvProduct(""); setAddInvQty(0); setAddInvCategory("ingredients"); db.fetchProductCategories().then(map => setProductCategoryMap(map)).catch(() => {}); setShowAddInventory(true); }} className="rounded-2xl bg-zinc-900 px-5 py-3 text-[15px] font-bold text-white hover:bg-zinc-800 hover:shadow-xl transition-all active:scale-[0.98]">+ Add Product</button>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={freezerTab === "my-inventory" || freezerTab === "deco-inventory" ? 6 : 7} className="px-8 py-16 text-center text-[15px] text-zinc-500">No items in this section.</td></tr>
                ) : freezerTab === "baked-products" ? (() => {
                  const grouped = new Map<string, { items: FreezerItem[]; totalQty: number }>();
                  (filtered as FreezerItem[]).forEach(f => {
                    const fSize = f.size || f.notes?.match(/ \| Size: (.+)$/)?.[1] || "";
                    const key = fSize ? `${f.productName}||${fSize}` : f.productName;
                    if (!grouped.has(key)) grouped.set(key, { items: [], totalQty: 0 });
                    const g = grouped.get(key)!;
                    g.items.push(f);
                    g.totalQty += f.qty;
                  });
                  return [...grouped.entries()].map(([key, g]) => {
                    const item = g.items[0];
                    const sizeFromNotes = item.notes?.match(/ \| Size: (.+)$/)?.[1];
                    const size = item.size || sizeFromNotes || "";
                    return (
                    <tr key={key} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-8 py-4">
                        <div className="text-[15px] font-semibold text-zinc-900">{item.productName}</div>
                      </td>
                      <td className="px-8 py-4 text-[14px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{size || "—"}</td>
                      <td className="px-8 py-4 text-[15px] text-right font-mono font-bold text-zinc-700">{g.totalQty} pcs</td>
                      <td className="px-8 py-4 text-[13px] text-zinc-500">{g.items.length} batch{g.items.length > 1 ? "es" : ""}</td>
                      <td className="px-8 py-4 text-[13px] text-zinc-500">{g.items[0]?.dateProduced || "—"}</td>
                      <td className="px-8 py-4"><span className="rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-[12px] font-semibold">Baker</span></td>
                      <td className="px-8 py-4 text-right">
                        <button onClick={() => { if (confirm(`Delete ALL batches of ${g.items[0].productName}?`)) { const ids = new Set(g.items.map(x => x.id)); const updated = freezerItems.filter(f => !ids.has(f.id)); onUpdateFreezer?.(updated); ids.forEach(id => db.deleteFreezerItem(id).catch(console.error)); } }} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-100 transition-all">Del All</button>
                      </td>
                    </tr>
                  );});
                })() : freezerTab === "deco-production-recipe" ? (() => {
                  const decoGrouped = new Map<string, { items: FreezerItem[]; totalQty: number }>();
                  (filtered as FreezerItem[]).forEach(f => {
                    if (!decoGrouped.has(f.productName)) decoGrouped.set(f.productName, { items: [], totalQty: 0 });
                    const g = decoGrouped.get(f.productName)!;
                    g.items.push(f);
                    g.totalQty += f.qty;
                  });
                  return [...decoGrouped.entries()].map(([productName, g]) => {
                    return (
                      <tr key={productName} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-8 py-4">
                          <div className="text-[15px] font-semibold text-zinc-900">{productName}</div>
                          <div className="text-[12px] text-zinc-500 mt-1 flex flex-wrap gap-1.5">
                            {(() => {
                              const bySource = new Map<string, { label: string; total: number }>();
                              g.items.forEach(f => {
                                const key = f.notes === "Production Recipe (Assembled)" ? "assembled" : "deco";
                                if (!bySource.has(key)) bySource.set(key, { label: key === "assembled" ? "Assembled" : "Deco PR", total: 0 });
                                bySource.get(key)!.total += f.qty;
                              });
                              return [...bySource.entries()].map(([key, s]) => (
                                <span key={key} className="inline-flex items-center gap-1">
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${key === "assembled" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                                    {s.label}
                                  </span>
                                  <span className="font-mono text-zinc-500">{s.total} pcs</span>
                                </span>
                              ));
                            })()}
                          </div>
                        </td>
                        <td className="px-8 py-4 text-[15px] text-right font-mono font-bold text-zinc-700">{g.totalQty} pcs</td>
                        <td className="px-8 py-4 text-[13px] text-zinc-500 font-mono">{g.items.map(f => f.batchRef).filter(Boolean).join(", ")}</td>
                        <td className="px-8 py-4 text-[13px] text-zinc-500">{g.items.map(f => f.dateProduced).filter((v, i, a) => a.indexOf(v) === i).join(", ")}</td>
                        <td className="px-8 py-4">
                          <span className="rounded-full bg-zinc-100 text-zinc-600 px-3 py-1 text-[12px] font-semibold">
                            {g.items.length} batch{g.items.length > 1 ? "es" : ""}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-right">
                          {g.items.some(item => canEdit(item)) ? (
                            <button onClick={() => { if (confirm(`Delete ALL batches of ${productName}?`)) { const ids = new Set(g.items.map(x => x.id)); const updated = freezerItems.filter(f => !ids.has(f.id)); onUpdateFreezer?.(updated); ids.forEach(id => db.deleteFreezerItem(id).catch(console.error)); } }} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-100 transition-all">Del All</button>
                          ) : (
                            <span className="text-[13px] text-zinc-500">View only</span>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })() : filtered.filter(item => {
                  if (freezerTab === "my-inventory") {
                    const inv = item as unknown as InventoryItem;
                    const isFilling = recipes.some(r => r.productName === inv.name && r.group === "filling");
                    if (isFilling && inv.onHand <= 0) return false;
                  }
                  return true;
                }).map(item => {
                  if (freezerTab === "my-inventory" || freezerTab === "deco-inventory") {
                    const inv = item as unknown as InventoryItem;
                    const isFilling = recipes.some(r => r.productName === inv.name && r.group === "filling");
                    return (
                      <tr key={inv.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-8 py-4"><div className="text-[15px] font-semibold text-zinc-900">{inv.name}</div></td>
                        {freezerTab === "deco-inventory" && <td className="px-8 py-4 text-[14px] text-zinc-500 font-mono">{inv.size || "—"}</td>}
                        <td className="px-8 py-4 text-[15px] text-right font-mono font-bold text-zinc-700">{inv.onHand} {inv.unit}</td>
                        <td className="px-8 py-4 text-[13px] text-zinc-500">{isFilling ? "Filling" : inv.group === "ingredients" ? "Ingredient" : inv.group === "packaging-materials" ? "Packaging" : inv.group === "decoration-supplies" ? "Decoration" : "Operational"}</td>
                        <td className="px-8 py-4"><span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${isFilling ? "bg-violet-100 text-violet-700" : "bg-zinc-100 text-zinc-600"}`}>{isFilling ? "Filling" : inv.group}</span></td>
                        <td className="px-8 py-4 text-right">
                          {freezerTab === "deco-inventory" ? (
                            <button onClick={() => { if (confirm(`Delete ${inv.name} from Deco Inventory?`)) { onUpdateInventory?.((prev: InventoryItem[]) => prev.filter(i => i.id !== inv.id)); db.deleteInventoryItem(inv.id, inv.group).catch(console.error); } }} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-100 transition-all">Del</button>
                          ) : (
                            <span className="text-[13px] text-zinc-500">View only</span>
                          )}
                        </td>
                      </tr>
                    );
                  }
                  const frz = item as FreezerItem;
                  return (
                    <tr key={frz.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-8 py-4"><div className="text-[15px] font-semibold text-zinc-900">{frz.productName}</div>{frz.notes && <div className="text-[12px] text-zinc-500 mt-0.5">{frz.notes}</div>}</td>
                      <td className="px-8 py-4 text-[15px] text-right font-mono font-bold text-zinc-700">{frz.qty} {frz.unit}</td>
                      <td className="px-8 py-4 text-[13px] text-zinc-500 font-mono">{frz.batchRef || "—"}</td>
                      <td className="px-8 py-4 text-[13px] text-zinc-500">{frz.dateProduced}</td>
                      <td className="px-8 py-4"><span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${frz.producedBy === "baker" ? "bg-amber-100 text-amber-700" : frz.producedBy === "deco" ? "bg-rose-100 text-rose-700" : "bg-zinc-100 text-zinc-600"}`}>{frz.producedBy === "baker" ? "Baker" : frz.producedBy === "deco" ? "Deco" : frz.producedBy}</span></td>
                      <td className="px-8 py-4 text-right">
                        {canEdit(frz) ? (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => { setEditingFreezerItem(frz); setShowEditFreezer(true); }} className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all">Edit</button>
                            <button onClick={() => { if (confirm(`Delete ${frz.productName}?`)) { const updated = freezerItems.filter(f => f.id !== frz.id); onUpdateFreezer?.(updated); db.deleteFreezerItem(frz.id).catch(console.error); } }} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-100 transition-all">Del</button>
                          </div>
                        ) : (
                          <span className="text-[13px] text-zinc-500">View only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {showAddFreezer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddFreezer(false)}>
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-[18px] font-semibold mb-4">Add to Freezer</h2>
              <div className="space-y-3">
                <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Product</label>
                   <select value={newProduct} onChange={e => setNewProduct(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400">
                    <option value="">Select product...</option>
                    {productCatalog.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Quantity</label><input type="number" min="1" value={newQty} onChange={e => setNewQty(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400" /></div>
                  <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Unit</label>
                    <select value={newUnit} onChange={e => setNewUnit(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400">
                      <option value="pcs">pcs</option><option value="packs">packs</option><option value="boxes">boxes</option><option value="kg">kg</option>
                    </select>
                  </div>
                </div>
                <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Batch Ref</label><input value={newBatch} onChange={e => setNewBatch(e.target.value)} placeholder="e.g. BATCH-001" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400" /></div>
                <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Notes</label><input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Optional" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400" /></div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowAddFreezer(false)} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={handleAdd} className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800">Add to Freezer</button>
              </div>
            </div>
          </div>
        )}

        {showAddBakedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddBakedProduct(false)}>
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-[18px] font-semibold mb-4">Add to Baked Products</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Product</label>
                  <select value={addBakedProduct} onChange={e => setAddBakedProduct(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400">
                    <option value="">Select product...</option>
                    {productCatalog.filter(p => productCategoryMap[p] === "Freezer Baker").map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Size</label>
                  <select value={addBakedSize} onChange={e => setAddBakedSize(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400">
                    <option value="">No size</option>
                    {["Small","Regular","Large","6x1","6x2","6x3","8x1","8x2","8x3","10x1","10x2","10x3","12x1","12x2","14x1","14x2","16x1","Sheet"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Qty</label>
                  <input type="number" min="1" value={addBakedQty} onChange={e => setAddBakedQty(e.target.value)} placeholder="0" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] font-mono outline-none focus:border-zinc-400" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowAddBakedProduct(false)} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button disabled={!addBakedProduct || !addBakedQty} onClick={() => {
                  const item: FreezerItem = {
                    id: `FRZ-${Date.now()}`,
                    productName: addBakedProduct.trim(),
                    qty: Number(addBakedQty),
                    unit: "pcs",
                    batchRef: `BATCH-${Date.now()}`,
                    producedBy: "baker",
                    dateProduced: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0],
                    status: "stored",
                    notes: addBakedSize ? `Size: ${addBakedSize}` : "",
                    size: addBakedSize || undefined,
                  };
                  onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, item]);
                  db.upsertFreezerItems([item]).catch(console.error);
                  setShowAddBakedProduct(false);
                  setAddBakedProduct(""); setAddBakedSize(""); setAddBakedQty("");
                }} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-[13px] font-medium text-white hover:bg-rose-700 disabled:opacity-40">Add Item</button>
              </div>
            </div>
          </div>
        )}

        {showEditFreezer && editingFreezerItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowEditFreezer(false)}>
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-[18px] font-semibold mb-4">Edit Product</h2>
              <div className="space-y-3">
                <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Product</label>
                  <select value={editingFreezerItem.productName} onChange={e => setEditingFreezerItem({ ...editingFreezerItem, productName: e.target.value })} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400">
                    {productCatalog.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Quantity</label><input type="number" min="1" value={editingFreezerItem.qty} onChange={e => setEditingFreezerItem({ ...editingFreezerItem, qty: Number(e.target.value) || 1 })} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400" /></div>
                  <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Unit</label>
                    <select value={editingFreezerItem.unit} onChange={e => setEditingFreezerItem({ ...editingFreezerItem, unit: e.target.value })} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400">
                      <option value="pcs">pcs</option><option value="packs">packs</option><option value="boxes">boxes</option><option value="kg">kg</option>
                    </select>
                  </div>
                </div>
                <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Batch Ref</label><input value={editingFreezerItem.batchRef} onChange={e => setEditingFreezerItem({ ...editingFreezerItem, batchRef: e.target.value })} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400" /></div>
                <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Notes</label><input value={editingFreezerItem.notes || ""} onChange={e => setEditingFreezerItem({ ...editingFreezerItem, notes: e.target.value })} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400" /></div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowEditFreezer(false)} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={() => {
                  const updated = freezerItems.map(f => f.id === editingFreezerItem.id ? editingFreezerItem : f);
                  onUpdateFreezer?.(updated);
                  db.upsertFreezerItems(updated).catch(console.error);
                  setShowEditFreezer(false);
                }} className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {showAddInventory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddInventory(false)}>
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-[18px] font-semibold mb-4">Add to My Inventory</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Product</label>
                  <select value={addInvProduct} onChange={e => setAddInvProduct(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400">
                    <option value="">Select product...</option>
                    {productCatalog.filter(p => productCategoryMap[p] === "Freezer Baker").map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Group</label>
                  <select value={addInvCategory} onChange={e => setAddInvCategory(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400">
                    <option value="ingredients">Ingredients</option>
                    <option value="packaging-materials">Packaging Materials</option>
                    <option value="decoration-supplies">Decoration Supplies</option>
                    <option value="operational-supplies">Operational Supplies</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Qty</label>
                  <input type="number" min={1} value={addInvQty || ""} onChange={e => setAddInvQty(Number(e.target.value) || 0)} placeholder="0" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] font-mono outline-none focus:border-zinc-400" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowAddInventory(false)} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button disabled={!addInvProduct || addInvQty <= 0} onClick={() => {
                  const newItem: InventoryItem = {
                    id: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    name: addInvProduct,
                    sku: `BAKER-${Date.now()}`,
                    unit: "pcs",
                    onHand: addInvQty,
                    threshold: 0,
                    cost: 0,
                    supplier: "",
                    lastIn: new Date().toISOString(),
                    category: "dry",
                    group: addInvCategory as "ingredients" | "packaging-materials" | "decoration-supplies" | "operational-supplies",
                    accessRoles: ["baker"],
                  };
                  onUpdateInventory?.((prev: InventoryItem[]) => [...prev, newItem]);
                  db.upsertInventory([newItem]).then(() => {
                    showToast("Item added to inventory");
                  }).catch(err => {
                    console.error(err);
                    showToast("Failed to save: " + (err.message || "Unknown error"), "error");
                    onUpdateInventory?.((prev: InventoryItem[]) => prev.filter(i => i.id !== newItem.id));
                  });
                  setShowAddInventory(false);
                }} className="flex-1 rounded-xl bg-amber-600 py-2.5 text-[13px] font-medium text-white hover:bg-amber-700 disabled:opacity-40">Add Item</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Main Dashboard (Step Wizard) ── */
  if (activeTab !== "dashboard") return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-8 shadow-lg">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[36px] font-bold tracking-tight text-white">Baker Workstation</h1>
            <p className="mt-2 text-[15px] text-zinc-400">Today's baking orders grouped by recipe.</p>
          </div>
          {bakerDOS.length > 0 && (
            <div className="shrink-0 rounded-2xl bg-white/10 px-6 py-4 text-center border border-white/10">
              <div className="text-[12px] text-zinc-400 uppercase font-semibold tracking-wider">Baker Total</div>
              <div className="text-[32px] font-bold text-white mt-1" style={{ fontFamily: "Fragment Mono, monospace" }}>{bakerDOS.reduce((s, d) => s + d.qty, 0)}</div>
              <div className="text-[12px] text-zinc-500 mt-1">{bakerDOS.length} item{bakerDOS.length > 1 ? "s" : ""}</div>
            </div>
          )}
        </div>
      </div>

      {/* Step Navigation */}
      <div className="relative">
        {/* Progress bar track */}
        <div className="absolute top-[14px] left-0 right-0 h-[2px] bg-zinc-800 rounded-full" />
        <div
          className="absolute top-[14px] left-0 h-[2px] bg-gradient-to-r from-amber-400 to-white rounded-full transition-all duration-500"
          style={{ width: `${(step / (steps.length - 1)) * 100}%` }}
        />
        <div className="relative flex items-center justify-between">
          {steps.map((s, i) => {
            const isActive = step === i;
            const isPast = step > i;
            return (
              <div key={s.id} className="flex flex-col items-center">
                <button
                  onClick={() => setStep(i)}
                  className={`flex items-center justify-center w-9 h-9 rounded-full text-[12px] font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-white text-zinc-900 shadow-[0_0_0_3px_rgba(255,255,255,0.15)] scale-110'
                      : isPast
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-zinc-800/50 text-zinc-600 border border-zinc-700/50'
                  }`}
                >
                  {isPast ? '✓' : i + 1}
                </button>
                <span className={`mt-2 text-[11px] font-medium tracking-wide text-center transition-colors duration-300 ${
                  isActive ? 'text-white' : isPast ? 'text-zinc-400' : 'text-zinc-600'
                }`}>
                  {s.label.replace(/^[^\s]+\s/, '')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {step === 0 && (
      <div className="space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(() => {
            const all = bakerDOS.length;
            const pending = bakerDOS.filter(d => d.status === "pending").length;
            const inProgress = bakerDOS.filter(d => d.status === "in-progress").length;
            const completed = bakerDOS.filter(d => d.status === "completed").length;
            return [
              { label: "Total Items", value: all, color: "text-blue-700", bg: "bg-blue-50 border-blue-200", labelColor: "text-blue-500" },
              { label: "Pending", value: pending, color: "text-amber-700", bg: "bg-amber-50 border-amber-200", labelColor: "text-amber-500" },
              { label: "In Progress", value: inProgress, color: "text-orange-700", bg: "bg-orange-50 border-orange-200", labelColor: "text-orange-500" },
              { label: "Completed", value: completed, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", labelColor: "text-emerald-500" },
            ].map((stat, i) => (
              <div key={i} className={`rounded-2xl border ${stat.bg} p-5 text-left shadow-sm`}>
                <div className={`text-[13px] ${stat.labelColor} uppercase tracking-wider font-semibold`}>{stat.label}</div>
                <div className={`text-[32px] font-bold mt-2 ${stat.color}`}>{stat.value}</div>
              </div>
            ));
          })()}
        </div>

        {bakerDOS.length === 0 ? (
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-10 text-center"><p className="text-[14px] text-zinc-400">No baking orders yet.</p><p className="text-[12px] text-zinc-500 mt-1">Wait for Admin to create a DOS.</p></div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
            <div className="px-6 py-5 border-b border-zinc-700 bg-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[18px] font-bold text-white" style={{ fontFamily: "Instrument Sans, system-ui" }}>Today's DOS • {new Date().toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" })}</h2>
                  <p className="text-[13px] text-zinc-400 mt-1">Daily Order Sales — auto-generates production tasks</p>
                </div>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700 bg-zinc-800 text-left text-[13px] font-semibold text-zinc-300 uppercase tracking-wider">
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4 text-right">Demand</th>
                  <th className="px-6 py-4 text-right">Batches</th>
                  <th className="px-6 py-4 text-right">Yield</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                const grouped = new Map<string, { dos: DOSItem[]; totalQty: number }>();
                bakerDOS.forEach(d => {
                  if (!grouped.has(d.product)) grouped.set(d.product, { dos: [], totalQty: 0 });
                  const g = grouped.get(d.product)!;
                  g.dos.push(d);
                  g.totalQty += d.qty;
                });
                const productRecipeLookup = (name: string) => {
                  const pn = name.toLowerCase();
                  const exact = recipes.filter(r => r.productName.toLowerCase() === pn);
                  const withLinks = exact.find(r => (r.linkedIngredients ?? []).length > 0);
                  return withLinks ?? exact[0] ?? undefined;
                };
                return [...grouped.entries()].map(([productName, group]) => {
                  const recipe = findRecipe(productName);
                  const linkedName = recipe?.linkedIngredients?.find(l => l.toLowerCase() !== productName.toLowerCase());
                  const linkedRecipe = linkedName ? productRecipeLookup(linkedName) : undefined;
                  const displayRecipe = linkedRecipe || recipe;
                  const hasYield = !!(displayRecipe?.yield && displayRecipe.yield > 0);
                  const yieldPerBatch = displayRecipe?.yield ?? 1;
                  const requiredBatches = Math.ceil(group.totalQty / yieldPerBatch);
                  const recipeDisplayName = displayRecipe?.productName || productName;
                  const actualDecoOutput = decoOutputMap.get(recipeDisplayName) || 0;
                  const actualExcess = actualDecoOutput > 0 ? Math.max(0, actualDecoOutput - group.totalQty) : 0;
                  const itemStatus = group.dos.every(d => d.status === "completed") ? "completed" : group.dos.some(d => d.status === "in-progress") ? "in-progress" : actualDecoOutput > 0 ? "ready" : "pending";
                  return (
                    <tr key={productName} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-semibold text-zinc-100">{recipeDisplayName}</span>
                          {recipeDisplayName !== productName && (
                            <span className="text-[11px] text-zinc-500 shrink-0">→ {productName}{group.dos.some(d => d.size) ? ` (${[...new Set(group.dos.map(d => d.size).filter(Boolean))].join(", ")})` : ""}</span>
                          )}
                        </div>
                        {(group.dos.some(d => d.flavor || d.size)) && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {[...new Set(group.dos.map(d => d.flavor).filter(Boolean))].map(f => (
                              <span key={f} className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[11px] font-medium text-zinc-200">{f}</span>
                            ))}
                            {[...new Set(group.dos.map(d => d.size).filter(Boolean))].map(s => (
                              <span key={s} className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[11px] font-medium text-zinc-200">{s}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-[17px] text-zinc-200">{group.totalQty}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-[17px] text-zinc-200">{hasYield ? requiredBatches : "—"}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-[17px] text-amber-300">{hasYield ? yieldPerBatch : "—"}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                          itemStatus === "completed" ? "bg-emerald-900/40 text-emerald-300" :
                          itemStatus === "in-progress" ? "bg-amber-900/40 text-amber-300" :
                          itemStatus === "ready" ? "bg-blue-900/40 text-blue-300" :
                          "bg-zinc-800 text-zinc-400"
                        }`}>
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                            itemStatus === "completed" ? "bg-emerald-500" :
                            itemStatus === "in-progress" ? "bg-amber-500 animate-pulse" :
                            itemStatus === "ready" ? "bg-blue-500" :
                            "bg-zinc-500"
                          }`} />
                          {itemStatus === "completed" ? "Completed" : itemStatus === "in-progress" ? "In Progress" : itemStatus === "ready" ? "Ready" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  );
                });
              })()}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-center space-y-3 mt-4">
          <div className="text-[13px] text-zinc-500">Baker: {bakerDOS.length} items</div>
          <button onClick={() => setStep(1)} className="w-full rounded-2xl border border-zinc-700 bg-white px-8 py-3.5 text-[15px] font-bold text-zinc-900 hover:bg-zinc-100 hover:shadow-xl transition-all active:scale-[0.98]">
            Next →
          </button>
        </div>
      </div>
      )}

      {step === 1 && (
        <div className="rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-8 shadow-lg">
          <div className="flex items-center gap-4 mb-6">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-900/40 text-amber-300 text-[20px] font-bold">1</span>
            <div>
              <h2 className="text-[28px] font-bold text-white tracking-tight">STEP 1 — ACKNOWLEDGE TASK</h2>
              <p className="text-[14px] text-zinc-400 mt-1">Click a recipe to view details and start task</p>
            </div>
          </div>

          {(() => {
            const grouped = new Map<string, { dos: DOSItem[]; totalQty: number }>();
            bakerDOS.forEach(d => {
              if (!grouped.has(d.product)) grouped.set(d.product, { dos: [], totalQty: 0 });
              const g = grouped.get(d.product)!;
              g.dos.push(d);
              g.totalQty += d.qty;
            });
            return (
              <>
                <div className="rounded-2xl border border-zinc-700 overflow-hidden mb-5">
                    {[...grouped.entries()].map(([productName, group], idx) => {
                    const recipe = findRecipe(productName);
                    const linkedName = recipe?.linkedIngredients?.find(l => l.toLowerCase() !== productName.toLowerCase());
                    const linkedRecipe = linkedName ? recipes.find(r => r.productName.toLowerCase() === linkedName.toLowerCase()) : undefined;
                    const displayRecipe = linkedRecipe || recipe;
                    const hasYield = !!(displayRecipe?.yield && displayRecipe.yield > 0);
                    const yieldPerBatch = displayRecipe?.yield ?? 1;
                    const requiredBatches = Math.ceil(group.totalQty / yieldPerBatch);
                    const recipeDisplayName = displayRecipe?.productName || productName;
                    const isStarted = startedRecipes.has(productName);
                    const actualDecoOutput = decoOutputMap.get(recipeDisplayName) || 0;
                    const actualExcess = actualDecoOutput > 0 ? Math.max(0, actualDecoOutput - group.totalQty) : 0;
                    const sizeLabel = group.dos.some(d => d.size) ? ` (${[...new Set(group.dos.map(d => d.size).filter(Boolean))].join(", ")})` : "";
                    return (
                      <div
                        key={productName}
                        onClick={() => setSelectedRecipe(productName)}
                        className={`grid grid-cols-12 items-center gap-3 px-5 py-4 hover:bg-zinc-800/40 cursor-pointer transition-colors ${idx > 0 ? 'border-t border-zinc-700' : ''}`}
                      >
                        <div className="col-span-8">
                          <div className="flex items-center gap-2">
                            <span className={`text-[16px] font-bold truncate ${isStarted ? 'text-emerald-300' : 'text-zinc-100'}`}>Recipe: {recipeDisplayName}</span>
                            {recipeDisplayName !== productName && <span className="text-[12px] text-zinc-500">→ {productName}{sizeLabel}</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 mt-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12px] text-zinc-400 uppercase tracking-wider font-semibold">Demand</span>
                              <span className="text-[17px] font-bold text-zinc-100 font-mono">{group.totalQty}<span className="text-[12px] font-medium text-zinc-500 ml-0.5">pcs</span></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12px] text-zinc-400 uppercase tracking-wider font-semibold">Batches</span>
                              <span className="text-[17px] font-bold text-zinc-100 font-mono">{requiredBatches}</span>
                            </div>
                            {hasYield && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[12px] text-zinc-400 uppercase tracking-wider font-semibold">Yield</span>
                                <span className="text-[17px] font-bold text-amber-300 font-mono">{yieldPerBatch}<span className="text-[12px] font-medium text-amber-600 ml-0.5">pcs</span></span>
                              </div>
                            )}
                            {hasYield && actualDecoOutput > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[12px] text-zinc-400 uppercase tracking-wider font-semibold">Deco Output</span>
                                <span className="text-[17px] font-bold text-emerald-300 font-mono">{actualDecoOutput}<span className="text-[12px] font-medium text-emerald-600 ml-0.5">pcs</span></span>
                                {actualExcess > 0 && <span className="text-[11px] text-amber-400/70 ml-1">+{actualExcess} excess</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="col-span-4 flex items-center justify-end">
                          {isStarted ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold bg-emerald-900/40 text-emerald-300">
                              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                              In Progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold bg-blue-900/40 text-blue-300">
                              <span className="inline-block h-2 w-2 rounded-full bg-blue-500"></span>
                              Ready
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between rounded-xl bg-zinc-800/50 px-5 py-3 mb-5">
                  <span className="text-[13px] text-zinc-400">{grouped.size} recipe{grouped.size !== 1 ? 's' : ''} · {bakerDOS.reduce((s, d) => s + d.qty, 0)} pcs total</span>
                  <span className="text-[13px] text-emerald-400 font-semibold">{startedRecipes.size}/{grouped.size} started</span>
                </div>

                <button
                  onClick={() => setStep(2)}
                  className="w-full rounded-2xl bg-white px-6 py-4 text-[16px] font-bold text-zinc-900 hover:bg-zinc-100 hover:shadow-xl transition-all active:scale-[0.98]"
                >
                  Next → Record Production
                </button>

                <div className="mt-4 text-center">
                  <button onClick={() => setStep(0)} className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors">
                    ← Back to DOS Review
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {step === 2 && (
        <div className="rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-8 shadow-lg">
          <div className="flex items-center gap-4 mb-6">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-900/40 text-amber-300 text-[20px] font-bold">2</span>
            <div>
              <h2 className="text-[28px] font-bold text-white tracking-tight">STEP 2 — RECORD ACTUAL PRODUCTION</h2>
              <p className="text-[14px] text-zinc-400 mt-1">Enter how many pieces were actually produced for each recipe</p>
            </div>
          </div>

          {(() => {
            const grouped = new Map<string, { dos: DOSItem[]; totalQty: number }>();
            bakerDOS.forEach(d => {
              if (!grouped.has(d.product)) grouped.set(d.product, { dos: [], totalQty: 0 });
              const g = grouped.get(d.product)!;
              g.dos.push(d);
              g.totalQty += d.qty;
            });
            return [...grouped.entries()].filter(([productName]) => startedRecipes.has(productName)).map(([productName, group]) => {
              const recipe = findRecipe(productName);
              const hasYield = !!(recipe?.yield && recipe.yield > 0);
              const yieldPerBatch = recipe?.yield ?? 1;
              const requiredBatches = Math.ceil(group.totalQty / yieldPerBatch);
              const expectedOutput = requiredBatches * yieldPerBatch;
              const recipeDisplayName = recipe?.productName || productName;
              const hasActual = actualProduction[productName] !== undefined;
              const actual = hasActual ? actualProduction[productName]! : 0;
              const linkedNames = recipe?.linkedIngredients ?? [];
              const decoStock = freezerItems.filter(i =>
                i.producedBy === "deco" && i.notes?.startsWith("Production Recipe") && i.qty > 0 &&
                (i.productName === productName || i.productName === recipeDisplayName || linkedNames.some(l => l.toLowerCase() === i.productName.toLowerCase()))
              );
              const decoAvailable = decoStock.reduce((sum, i) => sum + i.qty, 0);
              const maxBakerInput = decoAvailable;
              return (
                <div key={productName} className="rounded-2xl border border-zinc-700 bg-zinc-800/30 p-5 mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[16px] font-bold text-zinc-100 truncate">{recipeDisplayName}</span>
                        {recipe && <span className="text-[12px] text-zinc-500">→ {productName}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[13px]">
                        <span className="text-zinc-400">DOS Demand: <span className="font-mono font-semibold text-zinc-100">{group.totalQty}</span> pcs</span>
                        {hasYield && expectedOutput <= maxBakerInput && (
                          <>
                            <span className="text-zinc-600">·</span>
                            <span className="text-amber-300">Expected: {expectedOutput} pcs</span>
                          </>
                        )}
                      </div>
                    </div>
                    {group.dos.some(d => d.size) && (
                      <span className="rounded-xl bg-amber-500/20 border border-amber-500/40 px-4 py-1.5 text-[14px] font-bold text-amber-300 shrink-0 ml-3">
                        {[...new Set(group.dos.map(d => d.size).filter(Boolean))].join(", ")}
                      </span>
                    )}
                  </div>

                  <div className="rounded-xl bg-zinc-900/50 p-4 mb-4">
                    <label className="text-[13px] text-zinc-400 block mb-2">
                      How many pieces will you produce?
                      {decoAvailable > 0 && (
                        <span className="text-zinc-500 ml-1">(Deco has {decoAvailable} — max {maxBakerInput})</span>
                      )}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={actualProduction[productName] !== undefined ? String(actualProduction[productName]) : ''}
                        placeholder={`${maxBakerInput}`}
                        onChange={e => {
                          const raw = e.target.value;
                          if (raw === '') {
                            const { [productName]: _, ...rest } = actualProduction;
                            setActualProduction(rest);
                          } else {
                            const val = parseInt(raw) || 0;
                            setActualProduction(prev => ({ ...prev, [productName]: Math.min(val, maxBakerInput) }));
                          }
                        }}
                        className="w-32 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-[17px] font-mono font-bold text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                      <span className="text-[14px] text-zinc-500">pcs</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 text-[13px]">
                    <div className="rounded-xl bg-zinc-900/50 p-3 text-center">
                      <div className="text-zinc-400 uppercase tracking-wider font-semibold mb-1">Orders</div>
                      <div className="font-mono font-bold text-zinc-100 text-[17px]">{group.totalQty}</div>
                    </div>
                    <div className="rounded-xl bg-zinc-900/50 p-3 text-center">
                      <div className="text-zinc-400 uppercase tracking-wider font-semibold mb-1">Deco Has</div>
                      <div className={`font-mono font-bold text-[17px] ${decoAvailable > 0 ? 'text-emerald-300' : 'text-zinc-600'}`}>
                        {decoAvailable > 0 ? decoAvailable : '—'}
                      </div>
                    </div>
                    <div className="rounded-xl bg-zinc-900/50 p-3 text-center">
                      <div className="text-zinc-400 uppercase tracking-wider font-semibold mb-1">I Make</div>
                      <div className="font-mono font-bold text-amber-300 text-[17px]">{hasActual ? actual : '—'}</div>
                    </div>
                    <div className="rounded-xl bg-zinc-900/50 p-3 text-center">
                      <div className="text-zinc-400 uppercase tracking-wider font-semibold mb-1">Deco Left</div>
                      <div className={`font-mono font-bold text-[17px] ${hasActual ? (decoAvailable - actual > 0 ? 'text-emerald-300' : decoAvailable - actual === 0 ? 'text-zinc-500' : 'text-red-400') : 'text-zinc-600'}`}>
                        {hasActual ? decoAvailable - actual : decoAvailable}
                      </div>
                    </div>
                  </div>
                </div>
              );
            });
          })()}

          <div className="mt-6 text-center">
            <button onClick={() => setStep(3)} className="w-full rounded-2xl bg-white px-6 py-4 text-[16px] font-bold text-zinc-900 hover:bg-zinc-100 hover:shadow-xl transition-all active:scale-[0.98]">
              Next → Complete Production
            </button>
          </div>

          <div className="mt-4 text-center">
            <button onClick={() => setStep(1)} className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors">
              ← Back to Acknowledge
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-8 shadow-lg">
          <div className="flex items-center gap-4 mb-6">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-900/40 text-emerald-300 text-[20px] font-bold">3</span>
            <div>
              <h2 className="text-[28px] font-bold text-white tracking-tight">STEP 3 — COMPLETE PRODUCTION</h2>
              <p className="text-[14px] text-zinc-400 mt-1">Review allocation and save to freezer stock</p>
            </div>
          </div>

          {(() => {
            const grouped = new Map<string, { dos: DOSItem[]; totalQty: number }>();
            bakerDOS.forEach(d => {
              if (!grouped.has(d.product)) grouped.set(d.product, { dos: [], totalQty: 0 });
              const g = grouped.get(d.product)!;
              g.dos.push(d);
              g.totalQty += d.qty;
            });
            return [...grouped.entries()].filter(([productName]) => startedRecipes.has(productName)).map(([productName, group]) => {
              const recipe = findRecipe(productName);
              const recipeDisplayName = recipe?.productName || productName;
              const bakerProduced = actualProduction[productName] ?? 0;
              const demand = group.totalQty;
              const bakerUsed = Math.min(bakerProduced, demand);
              const bakerRemaining = bakerProduced - bakerUsed;
              const notMade = Math.max(0, demand - bakerProduced);
              return (
                <div key={productName} className="rounded-2xl border border-zinc-700 bg-zinc-800/30 p-5 mb-4 last:mb-0">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[16px] font-bold text-zinc-100 truncate">{recipeDisplayName}</span>
                    {recipe && <span className="text-[12px] text-zinc-500">→ {productName}</span>}
                  </div>

                  <div className="rounded-xl bg-zinc-900/50 p-4 mb-4">
                    <div className="text-[13px] text-zinc-400 uppercase tracking-wider font-semibold mb-3">Orders Allocation</div>
                    {bakerUsed > 0 && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[14px] text-zinc-400">I Made</span>
                        <span className="font-mono font-bold text-amber-300 text-[17px]">{bakerUsed} pcs</span>
                      </div>
                    )}
                    {notMade > 0 && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[14px] text-zinc-400">Not Made</span>
                        <span className="font-mono font-bold text-zinc-500 text-[17px]">{notMade} pcs</span>
                      </div>
                    )}
                    {bakerUsed === 0 && notMade === 0 && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[14px] text-red-400/70">Nothing produced</span>
                        <span className="font-mono font-bold text-red-400 text-[17px]">0 pcs</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2.5 border-t border-zinc-700">
                      <span className="text-[14px] text-zinc-400 font-medium">Orders</span>
                      <span className="font-mono font-bold text-zinc-100 text-[17px]">{demand} pcs</span>
                    </div>
                  </div>

                  {bakerRemaining > 0 && (
                    <div className="rounded-xl bg-zinc-900/50 p-4 mb-3">
                      <div className="text-[13px] text-zinc-400 uppercase tracking-wider font-semibold mb-2">My Extra</div>
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] text-zinc-400">{recipeDisplayName}</span>
                        <span className="font-mono font-bold text-amber-300 text-[17px]">{bakerRemaining} pcs</span>
                      </div>
                    </div>
                  )}

                  {bakerProduced < demand && (
                    <div className="rounded-xl bg-red-950/30 border border-red-900/30 p-4">
                      <div className="text-[13px] text-red-400/70 uppercase tracking-wider font-semibold mb-2">Short on Orders</div>
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] text-red-300/80">I made {bakerUsed} of {demand} — short {demand - bakerProduced}</span>
                        <span className="font-mono font-bold text-red-400 text-[17px]">-{demand - bakerProduced} pcs</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            });
          })()}

          {/* Destination Picker */}
          <div className="mb-5 mt-6">
            <div className="text-[13px] text-zinc-400 uppercase tracking-wider font-semibold mb-3">Save Destination</div>
            <div className="flex gap-3">
              <button onClick={() => setSaveDestination("baker-freezer")}
                className={`flex-1 rounded-xl border px-5 py-4 text-[14px] font-medium transition-all ${saveDestination === "baker-freezer" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600"}`}>
                <div className="font-bold mb-1">Baker Freezer</div>
                <div className="text-[11px] opacity-70">Baked Products</div>
              </button>
              <button onClick={() => setSaveDestination("deco-inventory")}
                className={`flex-1 rounded-xl border px-5 py-4 text-[14px] font-medium transition-all ${saveDestination === "deco-inventory" ? "border-amber-500 bg-amber-500/10 text-amber-400" : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600"}`}>
                <div className="font-bold mb-1">Deco Inventory</div>
                <div className="text-[11px] opacity-70">Came from Baker</div>
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
              const grouped = new Map<string, { dos: DOSItem[]; totalQty: number }>();
              bakerDOS.forEach(d => {
                if (!grouped.has(d.product)) grouped.set(d.product, { dos: [], totalQty: 0 });
                grouped.get(d.product)!.dos.push(d);
              });

              const newFreezerItems: FreezerItem[] = [];
              const updatedDecoItems: FreezerItem[] = [];
              const newHistory: FreezerHistory[] = [];

              [...grouped.entries()].forEach(([productName, group]) => {
                const recipe = findRecipe(productName);
                const linkedName = recipe?.linkedIngredients?.find(l => l.toLowerCase() !== productName.toLowerCase());
                const linkedRecipe = linkedName ? recipes.find(r => r.productName.toLowerCase() === linkedName.toLowerCase()) : undefined;
                const displayRecipe = linkedRecipe || recipe;
                const recipeDisplayName = displayRecipe?.productName || productName;
                const dosSize = [...new Set(group.dos.map(d => d.size).filter(Boolean))].join(", ") || undefined;
                const bakerProduced = actualProduction[productName] ?? 0;
                const demand = group.totalQty;
                const bakerUsed = Math.min(bakerProduced, demand);
                const bakerRemaining = bakerProduced - bakerUsed;

                if (bakerProduced > 0) {
                  let toDeduct = bakerProduced;
                  const linkedNames = recipe?.linkedIngredients ?? [];
                  const decoItems = freezerItems
                    .filter(i =>
                      i.producedBy === "deco" && i.notes?.startsWith("Production Recipe") && i.qty > 0 &&
                      (i.productName === productName || i.productName === recipeDisplayName || linkedNames.some(l => l.toLowerCase() === i.productName.toLowerCase()))
                    )
                    .sort((a, b) => (a.dateProduced || "").localeCompare(b.dateProduced || ""));
                  for (const item of decoItems) {
                    if (toDeduct <= 0) break;
                    const deduct = Math.min(toDeduct, item.qty);
                    const updated = { ...item, qty: item.qty - deduct };
                    updatedDecoItems.push(updated);
                    toDeduct -= deduct;
                    newHistory.push({
                      id: `FH-${Date.now()}-DEDUCT-${Math.random().toString(36).slice(2, 6)}`,
                      productName,
                      producedBy: "baker",
                      qtyChanged: -deduct,
                      action: "deducted",
                      reference: `Used ${deduct} pcs from Deco stock for baking`,
                      timestamp: new Date().toISOString(),
                    });
                  }
                }

                if (bakerUsed > 0) {
                  newFreezerItems.push({
                    id: `FRZ-${Date.now()}-${recipeDisplayName.replace(/[^a-zA0-9]/g, "")}`,
                    productName: recipeDisplayName,
                    qty: bakerUsed,
                    unit: "pcs",
                    batchRef: `BAKE-${Date.now()}`,
                    producedBy: "baker",
                    dateProduced: today,
                    status: "stored",
                    notes: `Baked — Allocated for DOS`,
                    size: dosSize,
                    dosProductName: productName,
                  } as any);
                  newHistory.push({
                    id: `FH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    productName: recipeDisplayName,
                    producedBy: "baker",
                    qtyChanged: bakerUsed,
                    action: "added",
                    reference: `Baked ${bakerUsed} pcs for ${demand} DOS demand`,
                    timestamp: new Date().toISOString(),
                  });
                }

                if (bakerRemaining > 0) {
                  newFreezerItems.push({
                    id: `FRZ-${Date.now()}-STOCK-${recipeDisplayName.replace(/[^a-zA0-9]/g, "")}`,
                    productName: recipeDisplayName,
                    qty: bakerRemaining,
                    unit: "pcs",
                    batchRef: `BAKE-STOCK-${Date.now()}`,
                    producedBy: "baker",
                    dateProduced: today,
                    status: "stored",
                    notes: `Baked — Available Stock`,
                    size: dosSize,
                    dosProductName: productName,
                  } as any);
                  newHistory.push({
                    id: `FH-${Date.now()}-STOCK-${Math.random().toString(36).slice(2, 6)}`,
                    productName: recipeDisplayName,
                    producedBy: "baker",
                    qtyChanged: bakerRemaining,
                    action: "added",
                    reference: `Available stock ${bakerRemaining} pcs after DOS allocation`,
                    timestamp: new Date().toISOString(),
                  });
                }
              });

              onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, ...newFreezerItems]);
              db.upsertFreezerItems(newFreezerItems).catch(console.error);

              if (updatedDecoItems.length > 0) {
                onUpdateFreezer?.((prev: FreezerItem[]) => {
                  const updated = new Map(prev.map(i => [i.id, i]));
                  updatedDecoItems.forEach(i => updated.set(i.id, i));
                  return [...updated.values()];
                });
                db.upsertFreezerItems(updatedDecoItems).catch(console.error);
              }

              newHistory.forEach(h => db.insertFreezerHistory(h).catch(console.error));

              const productsBaked = [...grouped.keys()].filter(p => (actualProduction[p] ?? 0) > 0);
              const dosToComplete = bakerDOS.filter(d => productsBaked.includes(d.product) && d.status === "in-progress");
              if (dosToComplete.length > 0) {
                Promise.all(dosToComplete.map(d => db.updateDOS(d.id, { status: "completed" }))).catch(console.error);
                onUpdateDOS?.(prev => prev.map(d => dosToComplete.find(c => c.id === d.id) ? { ...d, status: "completed" as const } : d));
              }

              if (saveDestination === "deco-inventory" && newFreezerItems.length > 0) {
                const decoInvItems: InventoryItem[] = newFreezerItems.map(fi => ({
                  id: `INV-DECO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  name: (fi as any).dosProductName || fi.productName,
                  sku: `DECO-BAKE-${Date.now()}`,
                  unit: fi.unit,
                  onHand: fi.qty,
                  threshold: 0,
                  cost: 0,
                  supplier: "",
                  lastIn: new Date().toISOString(),
                  category: "dry",
                  group: "ingredients",
                  accessRoles: ["deco"],
                  source: "came-from-baker",
                  size: fi.size,
                }));
                onUpdateInventory?.((prev: InventoryItem[]) => [...prev, ...decoInvItems]);
                db.upsertInventory(decoInvItems).catch(console.error);
              }

              // Reset and go back to DOS Review
              setStep(0);
              setStartedRecipes(new Set());
              setActualProduction({});
              setSaveDestination("baker-freezer");
            }}
            className="w-full rounded-2xl bg-emerald-600 px-6 py-4 text-[16px] font-bold text-white hover:bg-emerald-500 hover:shadow-xl transition-all active:scale-[0.98] mb-4"
          >
            {saveDestination === "deco-inventory" ? "Complete & Send to Deco Inventory" : "Complete & Save to Freezer"}
          </button>

          <div className="mt-2 text-center">
            <button onClick={() => setStep(2)} className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors">
              ← Back to Record Production
            </button>
          </div>
        </div>
      )}

      {bakerScheduledSection}

      {/* Recipe Detail Modal */}
      {selectedRecipe && createPortal((() => {
        const grouped = new Map<string, { dos: DOSItem[]; totalQty: number }>();
        bakerDOS.forEach(d => {
          if (!grouped.has(d.product)) grouped.set(d.product, { dos: [], totalQty: 0 });
          const g = grouped.get(d.product)!;
          g.dos.push(d);
          g.totalQty += d.qty;
        });
        const group = grouped.get(selectedRecipe);
        if (!group) return null;
        const recipe = findRecipe(selectedRecipe);
        const linkedName = recipe?.linkedIngredients?.find(l => l.toLowerCase() !== selectedRecipe.toLowerCase());
        const linkedRecipe = linkedName ? recipes.find(r => r.productName.toLowerCase() === linkedName.toLowerCase()) : undefined;
        const displayRecipe = linkedRecipe || recipe;
        const hasYield = !!(displayRecipe?.yield && displayRecipe.yield > 0);
        const yieldPerBatch = displayRecipe?.yield ?? 1;
        const requiredBatches = Math.ceil(group.totalQty / yieldPerBatch);
        const recipeDisplayName = displayRecipe?.productName || selectedRecipe;
        const actualDecoOutput = decoOutputMap.get(recipeDisplayName) || 0;
        const actualExcess = actualDecoOutput > 0 ? Math.max(0, actualDecoOutput - group.totalQty) : 0;
        const isStarted = startedRecipes.has(selectedRecipe);
        const isStarting = startingRecipe === selectedRecipe;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedRecipe(null)} />
            <div className="relative bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-800">
                <div className="flex items-center gap-4">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-900/40 text-amber-300 text-[20px] font-bold">R</span>
                  <div>
                    <h3 className="text-[24px] font-bold text-white">{recipeDisplayName}</h3>
                    {displayRecipe && displayRecipe.productName !== selectedRecipe && <p className="text-[13px] text-zinc-500 mt-0.5">DOS Product: {selectedRecipe}</p>}
                  </div>
                </div>
                <button onClick={() => setSelectedRecipe(null)} className="rounded-xl p-2 hover:bg-zinc-800 transition-colors">
                  <span className="text-zinc-400 text-[22px]">✕</span>
                </button>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="rounded-2xl bg-zinc-800/50 p-4 text-center">
                    <div className="text-[12px] text-zinc-400 mb-1.5 uppercase tracking-wider font-semibold">DOS Demand</div>
                    <div className="text-[32px] font-bold text-white font-mono">{group.totalQty}</div>
                    <div className="text-[12px] text-zinc-500">pcs</div>
                  </div>
                  <div className="rounded-2xl bg-zinc-800/50 p-4 text-center">
                    <div className="text-[12px] text-zinc-400 mb-1.5 uppercase tracking-wider font-semibold">Deco Output</div>
                    <div className="text-[32px] font-bold text-emerald-400 font-mono">{actualDecoOutput || '—'}</div>
                    <div className="text-[12px] text-zinc-500">pcs</div>
                  </div>
                  <div className="rounded-2xl bg-zinc-800/50 p-4 text-center">
                    <div className="text-[12px] text-zinc-400 mb-1.5 uppercase tracking-wider font-semibold">Excess</div>
                    <div className={`text-[32px] font-bold font-mono ${actualExcess > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>{actualExcess}</div>
                    <div className="text-[12px] text-zinc-500">pcs</div>
                  </div>
                </div>
                <div className="rounded-2xl bg-zinc-800/30 border border-zinc-700 p-5 mb-6">
                  <div className="text-[13px] text-zinc-400 mb-3 uppercase tracking-wider font-semibold">Batch Calculation</div>
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] text-zinc-400">Batch</span>
                      <span className="text-[20px] font-bold text-white font-mono">{requiredBatches}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] text-zinc-400">Yield</span>
                      <span className="text-[20px] font-bold text-amber-400 font-mono">{hasYield ? `${yieldPerBatch} pcs` : 'N/A'}</span>
                    </div>
                  </div>
                </div>
                {/* Additional Ingredients Used */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[13px] text-zinc-400 uppercase tracking-wider font-semibold">Additional Ingredients Used</div>
                    <button
                      onClick={() => { setShowIngredientPicker(true); setIngredientPickerSearch(""); setPickQuantities({}); }}
                      className="rounded-xl bg-amber-600/20 px-4 py-2 text-[13px] font-semibold text-amber-400 hover:bg-amber-600/30 transition-all"
                    >
                      + Add from Inventory
                    </button>
                  </div>
                  {(!additionalIngredients[selectedRecipe] || additionalIngredients[selectedRecipe].length === 0) ? (
                    <div className="rounded-xl bg-zinc-800/20 px-4 py-3 text-center">
                      <span className="text-[13px] text-zinc-500">No additional ingredients added.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {additionalIngredients[selectedRecipe].map((ing, i) => (
                        <div key={i} className="flex items-center justify-between rounded-xl bg-zinc-800/30 px-4 py-3">
                          <span className="text-[14px] text-zinc-300">{ing.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] text-zinc-400 font-mono">{ing.qty} {ing.unit}</span>
                            <button
                              onClick={() => {
                                const removed = additionalIngredients[selectedRecipe][i];
                                if (removed.sourceType === "inventory") {
                                  onUpdateInventory?.(prev => prev.map(inv => inv.id === removed.sourceId ? { ...inv, onHand: inv.onHand + removed.qty } : inv));
                                  db.updateInventoryItem(removed.sourceId, { onHand: (inventory.find(inv => inv.id === removed.sourceId)?.onHand ?? 0) + removed.qty, group: "ingredients" }).catch(console.error);
                                }
                                setAdditionalIngredients(prev => ({
                                  ...prev,
                                  [selectedRecipe]: prev[selectedRecipe].filter((_, idx) => idx !== i),
                                }));
                              }}
                              className="rounded-lg px-2 py-1 text-[12px] text-red-400 hover:bg-red-900/30 transition-all"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Fillings */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[13px] text-zinc-400 uppercase tracking-wider font-semibold">Fillings</div>
                  </div>
                  {(() => {
                    const fillingRecipes = recipes.filter(r => r.group === "filling");
                    const bakerInv = inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("baker"));
                    const fillingOptions = fillingRecipes.map(fr => {
                      const invItem = bakerInv.find(i => i.name === fr.productName);
                      return { name: fr.productName, qty: invItem ? Math.max(0, invItem.onHand) : 0, unit: invItem?.unit || "pcs", id: invItem?.id || "" };
                    }).filter(f => f.qty > 0);
                    const currentFillings = selectedFillings[selectedRecipe] || [];
                    const addedNames = new Set(currentFillings.map(f => f.name.toLowerCase()));
                    const available = fillingOptions.filter(f => !addedNames.has(f.name.toLowerCase()));
                    return (
                      <div className="space-y-2.5">
                        {currentFillings.map((f, i) => (
                          <div key={i} className="flex items-center justify-between rounded-xl bg-zinc-800/30 px-4 py-3">
                            <span className="text-[14px] text-zinc-300">{f.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] text-zinc-400 font-mono">{f.qty} pcs</span>
                              <button onClick={() => {
                                const invItem = bakerInv.find(inv => inv.name === f.name);
                                if (invItem) {
                                  onUpdateInventory?.(prev => prev.map(inv => inv.id === invItem.id ? { ...inv, onHand: inv.onHand + f.qty } : inv));
                                  db.updateInventoryItem(invItem.id, { onHand: invItem.onHand + f.qty, group: invItem.group }).catch(console.error);
                                } else {
                                  const newItem: InventoryItem = { id: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: f.name, sku: "", unit: "batches", onHand: f.qty, threshold: 0, cost: 0, supplier: "", lastIn: new Date().toISOString(), category: "dry", group: "ingredients", accessRoles: ["baker"] };
                                  onUpdateInventory?.(prev => [...prev, newItem]);
                                  db.upsertInventory([newItem]).catch(console.error);
                                }
                                const frzItem = freezerItems.find(frz => frz.productName === f.name && frz.notes === "Filling");
                                if (frzItem) {
                                  onUpdateFreezer?.((prev: FreezerItem[]) => prev.map(frz => frz.id === frzItem.id ? { ...frz, qty: frz.qty + f.qty } : frz));
                                  db.upsertFreezerItems([{ ...frzItem, qty: frzItem.qty + f.qty }]).catch(console.error);
                                }
                                setSelectedFillings(prev => ({ ...prev, [selectedRecipe]: prev[selectedRecipe].filter((_, idx) => idx !== i) }));
                              }} className="rounded-lg px-2 py-1 text-[12px] text-red-400 hover:bg-red-900/30 transition-all">✕</button>
                            </div>
                          </div>
                        ))}
                        {available.length > 0 && (
                          <div className="flex items-center gap-3">
                            <select className="flex-1 rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-[14px] text-white focus:outline-none focus:border-amber-500"
                              value={fillingPickerName} onChange={e => { setFillingPickerName(e.target.value); setFillingPickerQty(""); }}>
                              <option value="">Select filling...</option>
                              {available.map(fo => (
                                <option key={fo.name} value={fo.name}>{fo.name} ({fo.qty} {fo.unit})</option>
                              ))}
                            </select>
                            <input type="number" min={1} placeholder="Qty" value={fillingPickerQty} onChange={e => setFillingPickerQty(e.target.value)}
                              className="w-24 rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-[14px] font-mono text-white text-center focus:outline-none focus:border-amber-500" />
                            <button onClick={() => {
                              const qty = parseInt(fillingPickerQty || "0");
                              if (!fillingPickerName || qty <= 0) return;
                              const option = fillingOptions.find(fo => fo.name === fillingPickerName);
                              if (!option) return;
                              if (qty > option.qty) { alert(`Only ${option.qty} ${option.unit} available.`); return; }
                              const invItem = bakerInv.find(inv => inv.name === fillingPickerName);
                              if (invItem) {
                                const newOnHand = invItem.onHand - qty;
                                if (newOnHand <= 0) {
                                  onUpdateInventory?.(prev => prev.filter(inv => inv.id !== invItem.id));
                                  db.deleteInventoryItem(invItem.id).catch(console.error);
                                } else {
                                  onUpdateInventory?.(prev => prev.map(inv => inv.id === invItem.id ? { ...inv, onHand: newOnHand } : inv));
                                  db.updateInventoryItem(invItem.id, { onHand: newOnHand, group: invItem.group }).catch(console.error);
                                }
                                onStockTransaction?.({ id: `STX-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, type: "out", itemName: fillingPickerName, itemId: invItem.id, qty, unit: invItem.unit, reference: `Baking: ${selectedRecipe} filling`, timestamp: new Date().toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), target: "baker", group: invItem.group, role: "baker" });
                              }
                              const frzItem = freezerItems.find(frz => frz.productName === fillingPickerName && frz.notes === "Filling");
                              if (frzItem) {
                                const newQty = frzItem.qty - qty;
                                if (newQty <= 0) {
                                  onUpdateFreezer?.((prev: FreezerItem[]) => prev.filter(frz => !(frz.productName === fillingPickerName && frz.notes === "Filling")));
                                  db.deleteFreezerItem(frzItem.id).catch(console.error);
                                } else {
                                  onUpdateFreezer?.((prev: FreezerItem[]) => prev.map(frz => frz.id === frzItem.id ? { ...frz, qty: newQty } : frz));
                                  db.upsertFreezerItems([{ ...frzItem, qty: newQty }]).catch(console.error);
                                }
                              }
                              setSelectedFillings(prev => ({ ...prev, [selectedRecipe]: [...(prev[selectedRecipe] || []), { name: fillingPickerName, qty }] }));
                              setFillingPickerName("");
                              setFillingPickerQty("");
                            }} className="rounded-xl bg-amber-600/20 px-4 py-2.5 text-[13px] font-semibold text-amber-400 hover:bg-amber-600/30 transition-all">+ Add</button>
                          </div>
                        )}
                        {available.length === 0 && currentFillings.length === 0 && (
                          <div className="rounded-xl bg-zinc-800/20 px-4 py-3 text-center">
                            <span className="text-[13px] text-zinc-500">No fillings available.</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                {recipe && recipe.notes && (
                  <div className="mb-6">
                    <div className="text-[13px] text-zinc-400 mb-2 uppercase tracking-wider font-semibold">Notes</div>
                    <div className="text-[14px] text-zinc-400 rounded-xl bg-zinc-800/30 px-4 py-3">{recipe.notes}</div>
                  </div>
                )}
                <div className="mb-6">
                  <div className="text-[13px] text-zinc-400 mb-3 uppercase tracking-wider font-semibold">DOS Items ({group.dos.length})</div>
                  <div className="space-y-2">
                    {group.dos.map((d, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl bg-zinc-800/30 px-4 py-3">
                        <span className="text-[13px] text-zinc-400 font-mono">{d.id}</span>
                        <span className="text-[14px] text-white font-bold font-mono">{d.qty} pcs</span>
                      </div>
                    ))}
                  </div>
                </div>
                {!isStarted ? (
                  <button
                    onClick={() => handleStartRecipe(selectedRecipe)}
                    disabled={isStarting}
                    className="w-full rounded-2xl bg-emerald-600 px-6 py-4 text-[16px] font-bold text-white hover:bg-emerald-500 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  >
                    {isStarting ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Starting...
                      </span>
                    ) : (
                      'Start Task'
                    )}
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-900/30 border border-emerald-800/50 px-6 py-4">
                    <span className="text-emerald-400 text-[20px]">✓</span>
                    <span className="text-[16px] font-semibold text-emerald-300">Task Started — In Progress</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })(), document.body)}
      {showIngredientPicker && selectedRecipe && createPortal((() => {
    const bakerAccessInventory = inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("baker"))
      .sort((a, b) => {
        const aIsFilling = recipes.some(r => r.productName === a.name && r.group === "filling");
        const bIsFilling = recipes.some(r => r.productName === b.name && r.group === "filling");
        if (aIsFilling && !bIsFilling) return -1;
        if (!aIsFilling && bIsFilling) return 1;
        return a.name.localeCompare(b.name);
      });
        const pickerItems = bakerAccessInventory
          .filter(i => i.group === "ingredients")
          .map(i => ({ id: i.id, name: i.name, qty: i.onHand, unit: i.unit, sourceType: "inventory" as const }));
        const searchLower = ingredientPickerSearch.toLowerCase();
        const filtered = pickerItems.filter(i => i.name.toLowerCase().includes(searchLower));
        const addedIds = new Set((additionalIngredients[selectedRecipe] || []).map(i => `${i.sourceType}-${i.sourceId}`));
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowIngredientPicker(false)} />
            <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <h3 className="text-[16px] font-bold text-white">Add Ingredient</h3>
                <button onClick={() => setShowIngredientPicker(false)} className="rounded-lg p-1.5 hover:bg-zinc-800 transition-colors">
                  <span className="text-zinc-400 text-[18px]">✕</span>
                </button>
              </div>
              <div className="p-5 space-y-4">
                <input
                  type="text"
                  value={ingredientPickerSearch}
                  onChange={e => setIngredientPickerSearch(e.target.value)}
                  placeholder="Search ingredients..."
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-[13px] text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
                {filtered.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[13px] text-zinc-500">No items found.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {filtered.map(item => {
                      const isAdded = addedIds.has(`${item.sourceType}-${item.id}`);
                      const pickQty = pickQuantities[item.id] ?? 0;
                      return (
                        <div key={`${item.sourceType}-${item.id}`} className="flex items-center justify-between rounded-lg bg-zinc-800/30 px-3 py-2.5">
                          <div>
                            <div className="text-[13px] text-zinc-200 font-medium">{item.name}</div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] font-mono text-zinc-400">
                                On Hand: <span className="font-bold text-zinc-200">{item.qty}</span> {item.unit}
                              </span>
                              {pickQty > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-900/30 px-2 py-0.5 text-[11px] font-mono text-amber-400">
                                  After: <span className="font-bold text-amber-300">{Math.max(0, item.qty - pickQty)}</span> {item.unit}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isAdded ? (
                              <span className="text-[11px] text-emerald-400 font-semibold">Added</span>
                            ) : (
                              <>
                                <input
                                  type="number"
                                  min={0}
                                  max={item.qty}
                                  value={pickQty > 0 ? pickQty : ""}
                                  onChange={e => setPickQuantities(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                                  placeholder="Qty"
                                  className="w-16 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-[12px] font-mono text-white text-center focus:outline-none focus:border-amber-500"
                                />
                                <button
                                  onClick={() => {
                                    const qty = pickQuantities[item.id] ?? 0;
                                    if (qty <= 0) return;
                                    if (qty > item.qty) { alert(`Only ${item.qty} ${item.unit} available.`); return; }
                                    // Immediately deduct from inventory
                                    const newOnHand = Math.max(0, item.qty - qty);
                                    onUpdateInventory?.(prev => prev.map(i => i.id === item.id ? { ...i, onHand: newOnHand } : i));
                                    db.updateInventoryItem(item.id, { onHand: newOnHand, group: "ingredients" }).catch(console.error);
                                    onStockTransaction?.({ id: `STX-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, type: "out", itemName: item.name, itemId: item.id, qty, unit: item.unit, reference: `Baking: ${selectedRecipe} additional`, timestamp: new Date().toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), target: "baker", group: "ingredients", role: "baker" });
                                    setAdditionalIngredients(prev => ({
                                      ...prev,
                                      [selectedRecipe]: [...(prev[selectedRecipe] || []), { name: item.name, qty, unit: item.unit, sourceType: item.sourceType, sourceId: item.id }],
                                    }));
                                    setPickQuantities(prev => ({ ...prev, [item.id]: 0 }));
                                  }}
                                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-30 transition-all"
                                  disabled={!pickQuantities[item.id] || pickQuantities[item.id] <= 0}
                                >
                                  Add
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );

}

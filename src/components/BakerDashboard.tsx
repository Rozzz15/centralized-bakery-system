import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ProductionTask, DOSItem, BakerIngredientRequest, ProductRecipe, FreezerItem, FreezerHistory, InventoryItem } from "../types";
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
};

const steps = [
  { id: "dos", label: "📋 DOS Review" },
  { id: "acknowledge", label: "✅ Acknowledge Task" },
  { id: "record", label: "🏭 Record Actual Production" },
  { id: "complete", label: "✅ Complete Production" },
];

export default function BakerDashboard({ production, dosItems, onCompleteTask, activeTab, productCatalog, recipes, newDOSIds, onMarkDOSSeen, freezerItems = [], onUpdateFreezer, freezerHistory = [], inventory = [], onUpdateInventory }: Props) {
  const [step, setStep] = useState(0);
  const [startedRecipes, setStartedRecipes] = useState<Set<string>>(new Set());
  const [startingRecipe, setStartingRecipe] = useState<string | null>(null);
  const [actualProduction, setActualProduction] = useState<Record<string, number>>({});
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [additionalIngredients, setAdditionalIngredients] = useState<Record<string, { name: string; qty: number; unit: string; sourceType: "freezer" | "inventory"; sourceId: string }[]>>({});
  const [showIngredientPicker, setShowIngredientPicker] = useState(false);
  const [ingredientPickerSearch, setIngredientPickerSearch] = useState("");
  const [pickQuantities, setPickQuantities] = useState<Record<string, number>>({});
  const [ingredientReqs, setIngredientReqs] = useState<BakerIngredientRequest[]>([]);
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
  const [freezerSearch, setFreezerSearch] = useState("");
  const [freezerTab, setFreezerTab] = useState<"baked-products" | "my-inventory" | "deco-production-recipe">("baked-products");

  // Bake selection flow state
  const [bakerBakeQty, setBakerBakeQty] = useState<Record<string, number>>({});
  const [selectedForBaking, setSelectedForBaking] = useState<Set<string>>(new Set());
  const [withdrawnQtys, setWithdrawnQtys] = useState<Record<string, Record<string, number>>>({});
  const [modalSearch, setModalSearch] = useState("");
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  useEffect(() => {
    db.fetchBakerIngredientRequests().then(setIngredientReqs).catch(() => {});
  }, []);

  useEffect(() => {
    if (step === 0 && bakerDOS.length > 0 && newDOSIds && onMarkDOSSeen) {
      const unseen = bakerDOS.filter(d => newDOSIds.has(d.id));
      if (unseen.length > 0) onMarkDOSSeen(unseen.map(d => d.id));
    }
  }, [step]);

  const todayDOS = dosItems.filter(d => {
    if (d.status === "scheduled") return false;
    // Include items that were activated from scheduled (scheduledDate is still set but status !== "scheduled")
    if (d.scheduledDate && d.scheduledDate <= new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0]) return true;
    const ts = d.id.match(/DOS-(\d+)/)?.[1];
    if (!ts) return false;
    const itemDate = new Date(Number(ts)).toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    return itemDate === new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
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
  const findRecipe = (productName: string) =>
    recipes.find(r =>
      r.productName.toLowerCase() === productName.toLowerCase() ||
      r.linkedIngredients?.some(l => l.toLowerCase() === productName.toLowerCase()) ||
      getBaseName(r.productName) === getBaseName(productName)
    );

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
  // Actual Deco production output per product (only if Deco has completed their DOS)
  const decoOutputMap = new Map<string, number>();
  const decoCompletedProducts = new Set<string>();
  dosItems.filter(d => d.roles?.includes("deco")).forEach(d => {
    if (d.status === "completed") {
      const recipe = findRecipe(d.product);
      const recipeName = recipe?.productName || d.product;
      decoCompletedProducts.add(recipeName);
    }
  });
  decoProductionItems.forEach(i => {
    // Only count Deco output if Deco has completed their DOS for this product
    if (decoCompletedProducts.has(i.productName)) {
      decoOutputMap.set(i.productName, (decoOutputMap.get(i.productName) || 0) + i.qty);
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

  /* ── Conversion Tab ── */
  if (activeTab === "conversion") {
    const decoProductionItems = freezerItems.filter(i =>
      i.status === "stored" && i.qty > 0 && (
        i.producedBy === "deco" ||
        (i.producedBy === "baker" && i.notes === "Production Recipe (Assembled)")
      )
    );
    const grouped = new Map<string, { items: FreezerItem[]; totalQty: number }>();
    decoProductionItems.forEach(i => {
      if (!grouped.has(i.productName)) grouped.set(i.productName, { items: [], totalQty: 0 });
      const g = grouped.get(i.productName)!;
      g.items.push(i);
      g.totalQty += i.qty;
    });

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-[24px] font-semibold">Conversion</h1>
          <p className="mt-1 text-[13px] text-zinc-600">Deco Production Recipe items available for baking. Stock is consumed when you complete production.</p>
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
                  <div className="grid grid-cols-12 items-center gap-2 px-5 py-4">
                    <div className="col-span-5">
                      <div className="text-[14px] font-semibold text-zinc-900">{productName}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{g.items.length} batch{g.items.length !== 1 ? 'es' : ''}</div>
                    </div>
                    <div className="col-span-3 text-right">
                      <div className="text-[18px] font-bold text-zinc-800 font-mono">{g.totalQty}</div>
                      <div className="text-[10px] text-zinc-400">pcs available</div>
                    </div>
                    <div className="col-span-2 text-right">
                      <div className="text-[13px] text-zinc-500 font-mono">{dosDemand} pcs</div>
                      <div className="text-[10px] text-zinc-400">DOS demand</div>
                    </div>
                    <div className="col-span-2 text-right">
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
      </div>
    );
  }

  /* ── Filling Tab ── */
  if (activeTab === "filling") {
    const fillings = freezerItems.filter(i => i.notes === "Filling" && i.status === "stored");
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
      }

      // Save filling to freezer — merge with existing today's batch if same productName
      const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
      const existing = freezerItems.find(f => f.productName === fillingName.trim() && f.dateProduced === today && f.notes === "Filling");
      if (existing) {
        const updated = freezerItems.map(f => f.id === existing.id ? { ...f, qty: f.qty + batchQty } : f);
        onUpdateFreezer?.(updated);
        db.upsertFreezerItems(updated.filter(f => f.id === existing.id)).catch(console.error);
      } else {
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
      }

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
      <div className="space-y-5">
        <div><h1 className="text-[24px] font-semibold">Filling</h1><p className="mt-1 text-[13px] text-zinc-600">Record filling batches produced.</p></div>

        {/* Add Filling Form */}
        <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
          <h2 className="text-[15px] font-semibold mb-4">New Filling Batch</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Filling Name</label>
              <input value={fillingName} onChange={e => setFillingName(e.target.value)} placeholder="e.g. Vanilla Custard" list="filling-list" className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400" />
              <datalist id="filling-list">
                {recipes.filter(r => r.group === "filling").map(r => <option key={r.productName} value={r.productName} />)}
              </datalist>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Qty Produced</label>
              <input type="number" min={1} value={fillingQty} onChange={e => setFillingQty(e.target.value)} placeholder="0" className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400" />
            </div>
            <div className="flex items-end">
              <button onClick={handleAddFilling} disabled={!fillingName.trim() || !fillingQty} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 disabled:opacity-40">Create Filling</button>
            </div>
          </div>
        </div>

        {/* Fillings List */}
        <div className="rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
            <h2 className="text-[15px] font-semibold">Filling Batches</h2>
            <div className="relative max-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px]">⌕</span>
              <input value={fillingSearch} onChange={e => setFillingSearch(e.target.value)} placeholder="Search..." className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-1.5 text-[13px] focus:outline-none focus:border-zinc-400" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3">Filling</th>
                  <th className="px-5 py-3 text-right">Qty</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Batch</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-[13px] text-zinc-400">No fillings recorded yet.</td></tr>
                ) : filtered.map(f => (
                  <tr key={f.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-5 py-3.5"><div className="text-[13px] font-medium text-zinc-900">{f.productName}</div></td>
                    <td className="px-5 py-3.5 text-[13px] text-right font-mono">{f.qty}</td>
                    <td className="px-5 py-3.5 text-[12px] text-zinc-500">{f.dateProduced}</td>
                    <td className="px-5 py-3.5 text-[12px] text-zinc-500 font-mono">{f.batchRef || "—"}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => { if (confirm(`Delete ${f.productName} batch?`)) { const updated = freezerItems.filter(x => x.id !== f.id); onUpdateFreezer?.(updated); db.deleteFreezerItem(f.id).catch(console.error); } }} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Delete</button>
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
    const decoItems = freezerItems.filter(i => i.status === "stored" && i.qty > 0 && (
      i.producedBy === "deco" ||
      (i.producedBy === "baker" && i.notes === "Production Recipe (Assembled)")
    ));

    const tabItems = freezerTab === "baked-products" ? bakerItems : freezerTab === "my-inventory" ? bakerAccessInventory : decoItems;
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
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div><h1 className="text-[24px] font-semibold">Freezer</h1><p className="mt-1 text-[13px] text-zinc-600">Browse all freezer stocks by category.</p></div>
          <button onClick={() => setShowAddFreezer(true)} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Add Product</button>
        </div>

        <div className="flex gap-1.5 rounded-xl bg-zinc-100 p-1">
          <button onClick={() => setFreezerTab("baked-products")} className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all ${freezerTab === "baked-products" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>Baked Products</button>
          <button onClick={() => setFreezerTab("my-inventory")} className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all ${freezerTab === "my-inventory" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>My Inventory</button>
          <button onClick={() => setFreezerTab("deco-production-recipe")} className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all ${freezerTab === "deco-production-recipe" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>Deco Production Recipe</button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Baked Products</div><div className="text-[24px] font-semibold mt-1">{bakerItems.length}</div></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">My Inventory</div><div className="text-[24px] font-semibold mt-1">{bakerAccessInventory.length}</div></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Deco Cakes</div><div className="text-[24px] font-semibold mt-1">{decoItems.length}</div></div>
        </div>

        <div className="relative max-w-[280px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px]">⌕</span>
          <input value={freezerSearch} onChange={e => setFreezerSearch(e.target.value)} placeholder="Search products..." className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-2.5 text-[13px] focus:outline-none focus:border-zinc-400" />
        </div>

        <div className="rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr className="text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3 text-right">Qty</th>
                  {freezerTab !== "my-inventory" && <th className="px-5 py-3">Batch</th>}
                  <th className="px-5 py-3">{freezerTab === "my-inventory" ? "Category" : "Date"}</th>
                  <th className="px-5 py-3">Section</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={freezerTab === "my-inventory" ? 5 : 6} className="px-5 py-12 text-center text-[13px] text-zinc-400">No items in this section.</td></tr>
                ) : freezerTab === "baked-products" ? (() => {
                  const grouped = new Map<string, { items: FreezerItem[]; totalQty: number }>();
                  (filtered as FreezerItem[]).forEach(f => {
                    if (!grouped.has(f.productName)) grouped.set(f.productName, { items: [], totalQty: 0 });
                    const g = grouped.get(f.productName)!;
                    g.items.push(f);
                    g.totalQty += f.qty;
                  });
                  return [...grouped.entries()].map(([productName, g]) => (
                    <tr key={productName} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-5 py-3.5"><div className="text-[13px] font-medium text-zinc-900">{productName}</div></td>
                      <td className="px-5 py-3.5 text-[13px] text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{g.totalQty} pcs</td>
                      <td className="px-5 py-3.5 text-[12px] text-zinc-600">{g.items.length} batch{g.items.length > 1 ? "es" : ""}</td>
                      <td className="px-5 py-3.5 text-[12px] text-zinc-500">{g.items[0]?.dateProduced || "—"}</td>
                      <td className="px-5 py-3.5"><span className="rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-medium">Baker</span></td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => { if (confirm(`Delete ALL batches of ${productName}?`)) { const ids = new Set(g.items.map(x => x.id)); const updated = freezerItems.filter(f => !ids.has(f.id)); onUpdateFreezer?.(updated); ids.forEach(id => db.deleteFreezerItem(id).catch(console.error)); } }} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Del All</button>
                      </td>
                    </tr>
                  ));
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
                      <tr key={productName} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="text-[13px] font-medium text-zinc-900">{productName}</div>
                          <div className="text-[11px] text-zinc-400 mt-0.5 flex flex-wrap gap-1.5">
                            {(() => {
                              const bySource = new Map<string, { label: string; total: number }>();
                              g.items.forEach(f => {
                                const key = f.notes === "Production Recipe (Assembled)" ? "assembled" : "deco";
                                if (!bySource.has(key)) bySource.set(key, { label: key === "assembled" ? "Assembled" : "Deco PR", total: 0 });
                                bySource.get(key)!.total += f.qty;
                              });
                              return [...bySource.entries()].map(([key, s]) => (
                                <span key={key} className="inline-flex items-center gap-1">
                                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${key === "assembled" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                                    {s.label}
                                  </span>
                                  <span className="font-mono text-zinc-500">{s.total} pcs</span>
                                </span>
                              ));
                            })()}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{g.totalQty} pcs</td>
                        <td className="px-5 py-3.5 text-[12px] text-zinc-600" style={{ fontFamily: "Fragment Mono, monospace" }}>{g.items.map(f => f.batchRef).filter(Boolean).join(", ")}</td>
                        <td className="px-5 py-3.5 text-[12px] text-zinc-500">{g.items.map(f => f.dateProduced).filter((v, i, a) => a.indexOf(v) === i).join(", ")}</td>
                        <td className="px-5 py-3.5">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                            {g.items.length} batch{g.items.length > 1 ? "es" : ""}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button onClick={() => { if (confirm(`Delete ALL batches of ${productName}?`)) { const ids = new Set(g.items.map(x => x.id)); const updated = freezerItems.filter(f => !ids.has(f.id)); onUpdateFreezer?.(updated); ids.forEach(id => db.deleteFreezerItem(id).catch(console.error)); } }} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Del All</button>
                        </td>
                      </tr>
                    );
                  });
                })() : filtered.map(item => {
                  if (freezerTab === "my-inventory") {
                    const inv = item as unknown as InventoryItem;
                    const isFilling = recipes.some(r => r.productName === inv.name && r.group === "filling");
                    return (
                      <tr key={inv.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-5 py-3.5"><div className="text-[13px] font-medium text-zinc-900">{inv.name}</div></td>
                        <td className="px-5 py-3.5 text-[13px] text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{inv.onHand} {inv.unit}</td>
                        <td className="px-5 py-3.5 text-[12px] text-zinc-500">{isFilling ? "Filling" : inv.group === "ingredients" ? "Ingredient" : inv.group === "packaging-materials" ? "Packaging" : inv.group === "decoration-supplies" ? "Decoration" : "Operational"}</td>
                        <td className="px-5 py-3.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isFilling ? "bg-violet-50 text-violet-700" : "bg-zinc-100 text-zinc-600"}`}>{isFilling ? "Filling" : inv.group}</span></td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-[11px] text-zinc-400">View only</span>
                        </td>
                      </tr>
                    );
                  }
                  const frz = item as FreezerItem;
                  return (
                    <tr key={frz.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-5 py-3.5"><div className="text-[13px] font-medium text-zinc-900">{frz.productName}</div>{frz.notes && <div className="text-[11px] text-zinc-400 mt-0.5">{frz.notes}</div>}</td>
                      <td className="px-5 py-3.5 text-[13px] text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{frz.qty} {frz.unit}</td>
                      <td className="px-5 py-3.5 text-[12px] text-zinc-600" style={{ fontFamily: "Fragment Mono, monospace" }}>{frz.batchRef || "—"}</td>
                      <td className="px-5 py-3.5 text-[12px] text-zinc-500">{frz.dateProduced}</td>
                      <td className="px-5 py-3.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${frz.producedBy === "baker" ? "bg-amber-50 text-amber-700" : frz.producedBy === "deco" ? "bg-rose-50 text-rose-700" : "bg-zinc-100 text-zinc-600"}`}>{frz.producedBy === "baker" ? "Baker" : frz.producedBy === "deco" ? "Deco" : frz.producedBy}</span></td>
                      <td className="px-5 py-3.5 text-right">
                        {canEdit(frz) ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => { setEditingFreezerItem(frz); setShowEditFreezer(true); }} className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">Edit</button>
                            <button onClick={() => { if (confirm(`Delete ${frz.productName}?`)) { const updated = freezerItems.filter(f => f.id !== frz.id); onUpdateFreezer?.(updated); db.deleteFreezerItem(frz.id).catch(console.error); } }} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Del</button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-400">View only</span>
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
      </div>
    );
  }

  /* ── Main Dashboard (Step Wizard) ── */
  if (activeTab !== "dashboard") return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Baker Workstation</h1>
        <p className="mt-1 text-[13px] text-zinc-500">Today's baking orders grouped by recipe.</p>
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
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-white text-zinc-900 shadow-[0_0_0_3px_rgba(255,255,255,0.15)] scale-110'
                      : isPast
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-zinc-800/50 text-zinc-600 border border-zinc-700/50'
                  }`}
                >
                  {isPast ? '✓' : i + 1}
                </button>
                <span className={`mt-2 text-[10px] font-medium tracking-wide text-center transition-colors duration-300 ${
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
      <div className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3">
          {(() => {
            const all = bakerDOS.length;
            const pending = bakerDOS.filter(d => d.status === "pending").length;
            const inProgress = bakerDOS.filter(d => d.status === "in-progress").length;
            const completed = bakerDOS.filter(d => d.status === "completed").length;
            return [
              { label: "Total Items", value: all, color: "text-white" },
              { label: "Pending", value: pending, color: "text-zinc-400" },
              { label: "In Progress", value: inProgress, color: "text-amber-400" },
              { label: "Completed", value: completed, color: "text-emerald-400" },
            ].map((stat, i) => (
              <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
                <div className={`text-[22px] font-bold font-mono ${stat.color}`}>{stat.value}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">{stat.label}</div>
              </div>
            ));
          })()}
        </div>

        {bakerDOS.length === 0 ? (
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-6 text-center">
            <p className="text-[14px] text-zinc-500">No baking orders yet.</p>
            <p className="text-[12px] text-zinc-500 mt-1">Wait for Admin to create a DOS.</p>
          </div>
        ) : (
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[16px] font-semibold text-white" style={{ fontFamily: "Instrument Sans, system-ui" }}>Today's DOS • {new Date().toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" })}</h2>
                <p className="text-[12px] text-zinc-400 mt-0.5">Daily Order Sales — auto-generates production tasks</p>
              </div>
            
            </div>
            <div className="space-y-3">
              {(() => {
                const grouped = new Map<string, { dos: DOSItem[]; totalQty: number }>();
                bakerDOS.forEach(d => {
                  if (!grouped.has(d.product)) grouped.set(d.product, { dos: [], totalQty: 0 });
                  const g = grouped.get(d.product)!;
                  g.dos.push(d);
                  g.totalQty += d.qty;
                });
                return [...grouped.entries()].map(([productName, group]) => {
                  const recipe = findRecipe(productName);
                  const hasYield = !!(recipe?.yield && recipe.yield > 0);
                  const yieldPerBatch = recipe?.yield ?? 1;
                  const requiredBatches = Math.ceil(group.totalQty / yieldPerBatch);
                  const recipeDisplayName = recipe?.productName || productName;
                  const actualDecoOutput = decoOutputMap.get(recipeDisplayName) || 0;
                  const actualExcess = actualDecoOutput > 0 ? Math.max(0, actualDecoOutput - group.totalQty) : 0;
                  const itemStatus = group.dos.every(d => d.status === "completed") ? "completed" : group.dos.some(d => d.status === "in-progress") ? "in-progress" : actualDecoOutput > 0 ? "ready" : "pending";
                  return (
                    <div key={productName} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 hover:border-zinc-700 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[15px] font-bold text-white truncate">{recipeDisplayName}</span>
                            {recipe && recipe.productName !== productName && (
                              <span className="text-[10px] text-zinc-500 truncate shrink-0">→ {productName}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            {hasYield ? (
                              <>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Demand</span>
                                  <span className="text-[15px] font-bold text-white font-mono">{group.totalQty}<span className="text-[10px] font-medium text-zinc-500 ml-0.5">pcs</span></span>
                                </div>
                                <div className="w-px h-4 bg-zinc-800" />
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Batches</span>
                                  <span className="text-[15px] font-bold text-white font-mono">{requiredBatches}</span>
                                </div>
                                <div className="w-px h-4 bg-zinc-800" />
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Yield</span>
                                  <span className="text-[15px] font-bold text-amber-400 font-mono">{yieldPerBatch}<span className="text-[10px] font-medium text-amber-600 ml-0.5">pcs</span></span>
                                </div>
                                {actualDecoOutput > 0 && (
                                  <>
                                    <div className="w-px h-4 bg-zinc-800" />
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Deco Output</span>
                                      <span className="text-[15px] font-bold text-emerald-400 font-mono">{actualDecoOutput}<span className="text-[10px] font-medium text-emerald-600 ml-0.5">pcs</span></span>
                                    </div>
                                    {actualExcess > 0 && (
                                      <>
                                        <div className="w-px h-4 bg-zinc-800" />
                                        <span className="text-[10px] text-amber-400/70">+{actualExcess} excess</span>
                                      </>
                                    )}
                                  </>
                                )}
                                {actualDecoOutput === 0 && (
                                  <span className="text-[10px] text-zinc-500 italic">Awaiting Deco production</span>
                                )}
                              </>
                            ) : (
                              <span className="text-[10px] text-amber-400/70 italic">Set recipe yield in Admin &gt; Recipes</span>
                            )}
                          </div>
                          {(group.dos.some(d => d.flavor || d.size)) && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              {[...new Set(group.dos.map(d => d.flavor).filter(Boolean))].map(f => (
                                <span key={f} className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-200">{f}</span>
                              ))}
                              {[...new Set(group.dos.map(d => d.size).filter(Boolean))].map(s => (
                                <span key={s} className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-200">{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold shrink-0 ${
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
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
        <div className="text-center space-y-3">
          <div className="text-[12px] text-zinc-500">Baker: {bakerDOS.length} items</div>
          <button onClick={() => setStep(1)} className="w-full rounded-2xl border border-zinc-700 bg-white px-8 py-3.5 text-[15px] font-bold text-zinc-900 hover:bg-zinc-100 hover:shadow-xl transition-all active:scale-[0.98]">
            Next →
          </button>
        </div>
      </div>
      )}

      {step === 1 && (
        <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-900/40 text-amber-300 text-[18px] font-bold">1</span>
            <div>
              <h2 className="text-[20px] font-bold text-white tracking-tight">STEP 1 — ACKNOWLEDGE TASK</h2>
              <p className="text-[12px] text-zinc-400 mt-0.5">Click a recipe to view details and start task</p>
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
            // Only show products where Deco has completed their DOS
            const readyGrouped = new Map([...grouped.entries()].filter(([productName]) => {
              const recipe = findRecipe(productName);
              const recipeName = recipe?.productName || productName;
              return (decoOutputMap.get(recipeName) || 0) > 0;
            }));
            const allStarted = readyGrouped.size > 0 && [...readyGrouped.keys()].every(k => startedRecipes.has(k));
            const isWaiting = readyGrouped.size === 0;
            if (isWaiting) {
              return (
                <div className="rounded-xl border border-zinc-800 p-8 text-center">
                  <p className="text-[14px] text-zinc-400">Waiting for Deco to complete production...</p>
                  <p className="text-[12px] text-zinc-500 mt-1">Please check back once Deco has finished setting up the DOS recipe.</p>
                </div>
              );
            }
            return (
              <>
                <div className="rounded-xl border border-zinc-800 overflow-hidden mb-4">
                    {[...readyGrouped.entries()].map(([productName, group], idx) => {
                    const recipe = findRecipe(productName);
                    const hasYield = !!(recipe?.yield && recipe.yield > 0);
                    const yieldPerBatch = recipe?.yield ?? 1;
                    const requiredBatches = Math.ceil(group.totalQty / yieldPerBatch);
                    const recipeDisplayName = recipe?.productName || productName;
                    const isStarted = startedRecipes.has(productName);
                    const actualDecoOutput = decoOutputMap.get(recipeDisplayName) || 0;
                    const actualExcess = actualDecoOutput > 0 ? Math.max(0, actualDecoOutput - group.totalQty) : 0;
                    return (
                      <div
                        key={productName}
                        onClick={() => setSelectedRecipe(productName)}
                        className={`grid grid-cols-12 items-center gap-2 px-3 py-3 hover:bg-zinc-800/40 cursor-pointer transition-colors ${idx > 0 ? 'border-t border-zinc-800' : ''}`}
                      >
                        <div className="col-span-8">
                          <div className="flex items-center gap-2">
                            <span className={`text-[14px] font-semibold truncate ${isStarted ? 'text-emerald-300' : 'text-white'}`}>Recipe: {recipeDisplayName}</span>
                            {recipe && recipe.productName !== productName && <span className="text-[10px] text-zinc-600">→ {productName}</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-zinc-500">Demand:</span>
                              <span className="text-[14px] font-bold text-white font-mono">{group.totalQty} <span className="text-[11px] font-medium text-zinc-500">pcs</span></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-zinc-500">Required Batches:</span>
                              <span className="text-[14px] font-bold text-white font-mono">{requiredBatches}</span>
                            </div>
                            {hasYield && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-zinc-500">Yield per Batch:</span>
                                <span className="text-[14px] font-bold text-amber-400 font-mono">{yieldPerBatch} <span className="text-[11px] font-medium text-amber-600">pcs</span></span>
                              </div>
                            )}
                            {hasYield && actualDecoOutput > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-zinc-500">Deco Output:</span>
                                <span className="text-[14px] font-bold text-emerald-400 font-mono">{actualDecoOutput} <span className="text-[11px] font-medium text-emerald-600">pcs</span></span>
                                {actualExcess > 0 && <span className="text-[10px] text-amber-400/70 ml-1">(Excess: {actualExcess} pcs)</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="col-span-4 flex items-center justify-end">
                          {isStarted ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold bg-emerald-900/40 text-emerald-300">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              In Progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold bg-blue-900/40 text-blue-300">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                              Ready
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between rounded-xl bg-zinc-950/40 px-4 py-2.5 mt-4 mb-5">
                  <span className="text-[12px] text-zinc-500">{readyGrouped.size} recipe{readyGrouped.size !== 1 ? 's' : ''} · {bakerDOS.reduce((s, d) => s + d.qty, 0)} pcs total</span>
                  <span className="text-[12px] text-emerald-400">{startedRecipes.size}/{readyGrouped.size} started</span>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={!allStarted}
                  className="w-full rounded-xl bg-white px-4 py-3.5 text-[15px] font-bold text-zinc-900 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                >
                  {allStarted ? 'Next → Record Production' : `Start each recipe first (${startedRecipes.size}/${readyGrouped.size})`}
                </button>

                <div className="mt-4 text-center">
                  <button onClick={() => setStep(0)} className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">
                    ← Back to DOS Review
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {step === 2 && (
        <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-900/40 text-amber-300 text-[18px] font-bold">2</span>
            <div>
              <h2 className="text-[20px] font-bold text-white tracking-tight">STEP 2 — RECORD ACTUAL PRODUCTION</h2>
              <p className="text-[12px] text-zinc-400 mt-0.5">Enter how many pieces were actually produced for each recipe</p>
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
            return [...grouped.entries()].map(([productName, group]) => {
              const recipe = findRecipe(productName);
              const hasYield = !!(recipe?.yield && recipe.yield > 0);
              const yieldPerBatch = recipe?.yield ?? 1;
              const requiredBatches = Math.ceil(group.totalQty / yieldPerBatch);
              const expectedOutput = requiredBatches * yieldPerBatch;
              const recipeDisplayName = recipe?.productName || productName;
              const hasActual = actualProduction[productName] !== undefined;
              const actual = hasActual ? actualProduction[productName]! : 0;
              // Deco stock from Production Recipe
              const decoStock = freezerItems.filter(i =>
                i.status === "stored" && i.qty > 0 && i.producedBy === "deco" &&
                (i.productName === productName || i.productName === recipeDisplayName)
              );
              const decoAvailable = decoStock.reduce((sum, i) => sum + i.qty, 0);
              const decoExcess = decoAvailable - (hasActual ? actual : 0);
              const bakerNeeded = Math.max(0, group.totalQty - decoAvailable);
              return (
                <div key={productName} className="rounded-xl border border-zinc-800 bg-zinc-800/30 p-4 mb-3 last:mb-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-white truncate">{recipeDisplayName}</span>
                        {recipe && <span className="text-[10px] text-zinc-600">→ {productName}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px]">
                        <span className="text-zinc-400">DOS Demand: <span className="font-mono font-semibold text-white">{group.totalQty}</span> pcs</span>
                        {hasYield && (
                          <>
                            <span className="text-zinc-600">·</span>
                            <span className="text-amber-400/80">Expected: {expectedOutput} pcs</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-zinc-950/40 p-3 mb-3">
                    <label className="text-[11px] text-zinc-400 block mb-1.5">
                      How many pieces will you produce?
                      {decoAvailable >= group.totalQty && bakerNeeded === 0 && (
                        <span className="text-emerald-400/60 ml-1">(Deco has enough — optional)</span>
                      )}
                      {decoAvailable < group.totalQty && (
                        <span className="text-zinc-600 ml-1">(need {bakerNeeded} more)</span>
                      )}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={actualProduction[productName] !== undefined ? String(actualProduction[productName]) : ''}
                        placeholder={`${expectedOutput}`}
                        onChange={e => {
                          const raw = e.target.value;
                          if (raw === '') {
                            const { [productName]: _, ...rest } = actualProduction;
                            setActualProduction(rest);
                          } else {
                            setActualProduction(prev => ({ ...prev, [productName]: parseInt(raw) || 0 }));
                          }
                        }}
                        className="w-28 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-[15px] font-mono font-bold text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                      <span className="text-[12px] text-zinc-500">pcs</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-[11px]">
                    <div className="rounded-lg bg-zinc-950/40 p-2 text-center">
                      <div className="text-zinc-500 mb-0.5">Orders</div>
                      <div className="font-mono font-bold text-white text-[13px]">{group.totalQty}</div>
                    </div>
                    <div className="rounded-lg bg-zinc-950/40 p-2 text-center">
                      <div className="text-zinc-500 mb-0.5">Deco Has</div>
                      <div className={`font-mono font-bold text-[13px] ${decoAvailable > 0 ? 'text-emerald-400' : 'text-zinc-600'}`}>
                        {decoAvailable > 0 ? decoAvailable : '—'}
                      </div>
                    </div>
                    <div className="rounded-lg bg-zinc-950/40 p-2 text-center">
                      <div className="text-zinc-500 mb-0.5">I Make</div>
                      <div className="font-mono font-bold text-amber-300 text-[13px]">{hasActual ? actual : '—'}</div>
                    </div>
                    <div className="rounded-lg bg-zinc-950/40 p-2 text-center">
                      <div className="text-zinc-500 mb-0.5">Excess</div>
                      <div className={`font-mono font-bold text-[13px] ${hasActual ? (decoExcess > 0 ? 'text-emerald-400' : decoExcess < 0 ? 'text-red-400' : 'text-zinc-300') : 'text-zinc-600'}`}>
                        {hasActual ? (decoExcess > 0 ? `+${decoExcess}` : decoExcess) : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            });
          })()}

          <div className="mt-5 text-center">
            <button onClick={() => setStep(3)} className="w-full rounded-xl bg-white px-4 py-3.5 text-[15px] font-bold text-zinc-900 hover:bg-zinc-100 transition-all active:scale-[0.98]">
              Next → Complete Production
            </button>
          </div>

          <div className="mt-4 text-center">
            <button onClick={() => setStep(1)} className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">
              ← Back to Acknowledge
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-900/40 text-emerald-300 text-[18px] font-bold">3</span>
            <div>
              <h2 className="text-[20px] font-bold text-white tracking-tight">STEP 3 — COMPLETE PRODUCTION</h2>
              <p className="text-[12px] text-zinc-400 mt-0.5">Review allocation and save to freezer stock</p>
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
            return [...grouped.entries()].map(([productName, group]) => {
              const recipe = findRecipe(productName);
              const recipeDisplayName = recipe?.productName || productName;
              const bakerProduced = actualProduction[productName] ?? 0;
              const demand = group.totalQty;
              const bakerUsed = Math.min(bakerProduced, demand);
              const bakerRemaining = bakerProduced - bakerUsed;
              const notMade = Math.max(0, demand - bakerProduced);
              return (
                <div key={productName} className="rounded-xl border border-zinc-800 bg-zinc-800/30 p-4 mb-3 last:mb-0">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[14px] font-semibold text-white truncate">{recipeDisplayName}</span>
                    {recipe && <span className="text-[10px] text-zinc-600">→ {productName}</span>}
                  </div>

                  <div className="rounded-lg bg-zinc-950/40 p-3 mb-3">
                    <div className="text-[11px] text-zinc-500 mb-2">Orders Allocation</div>
                    {bakerUsed > 0 && (
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] text-zinc-400">I Made</span>
                        <span className="font-mono font-bold text-amber-400 text-[14px]">{bakerUsed} pcs</span>
                      </div>
                    )}
                    {notMade > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-zinc-400">Not Made</span>
                        <span className="font-mono font-bold text-zinc-500 text-[14px]">{notMade} pcs</span>
                      </div>
                    )}
                    {bakerUsed === 0 && notMade === 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-red-400/70">Nothing produced</span>
                        <span className="font-mono font-bold text-red-400 text-[14px]">0 pcs</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-zinc-800">
                      <span className="text-[12px] text-zinc-400 font-medium">Orders</span>
                      <span className="font-mono font-bold text-white text-[14px]">{demand} pcs</span>
                    </div>
                  </div>

                  {bakerRemaining > 0 && (
                    <div className="rounded-lg bg-zinc-950/40 p-3">
                      <div className="text-[11px] text-zinc-500 mb-2">My Extra</div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-zinc-400">{recipeDisplayName}</span>
                        <span className="font-mono font-bold text-amber-400 text-[14px]">{bakerRemaining} pcs</span>
                      </div>
                    </div>
                  )}

                  {bakerProduced < demand && (
                    <div className="rounded-lg bg-red-950/30 border border-red-900/30 p-3">
                      <div className="text-[11px] text-red-400/70 mb-1">Short on Orders</div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-red-300/80">I made {bakerUsed} of {demand} — short {demand - bakerProduced}</span>
                        <span className="font-mono font-bold text-red-400 text-[14px]">-{demand - bakerProduced} pcs</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            });
          })()}

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
                const recipeDisplayName = recipe?.productName || productName;
                const bakerProduced = actualProduction[productName] ?? 0;
                const demand = group.totalQty;
                const bakerUsed = Math.min(bakerProduced, demand);
                const bakerRemaining = bakerProduced - bakerUsed;

                // Deduct bakerProduced from Deco Production Recipe items (FIFO)
                if (bakerProduced > 0) {
                  let toDeduct = bakerProduced;
                  const decoItems = freezerItems
                    .filter(i =>
                      i.status === "stored" && i.qty > 0 && i.producedBy === "deco" &&
                      (i.productName === productName || i.productName === recipeDisplayName)
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

                // Save baker's output to Baked Products tab
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
                  });
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
                  });
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

              // Save to freezer
              onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, ...newFreezerItems]);
              db.upsertFreezerItems(newFreezerItems).catch(console.error);

              // Deduct from Deco Production Recipe items
              if (updatedDecoItems.length > 0) {
                onUpdateFreezer?.((prev: FreezerItem[]) => {
                  const updated = new Map(prev.map(i => [i.id, i]));
                  updatedDecoItems.forEach(i => updated.set(i.id, i));
                  return [...updated.values()];
                });
                db.upsertFreezerItems(updatedDecoItems).catch(console.error);
              }

              // Save history
              newHistory.forEach(h => db.insertFreezerHistory(h).catch(console.error));

              // Reset and go back to DOS Review
              setStep(0);
              setStartedRecipes(new Set());
              setActualProduction({});
            }}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-[15px] font-bold text-white hover:bg-emerald-500 transition-all active:scale-[0.98] mb-3"
          >
            Complete & Save to Freezer
          </button>

          <div className="mt-2 text-center">
            <button onClick={() => setStep(2)} className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">
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
        const hasYield = !!(recipe?.yield && recipe.yield > 0);
        const yieldPerBatch = recipe?.yield ?? 1;
        const requiredBatches = Math.ceil(group.totalQty / yieldPerBatch);
        const recipeDisplayName = recipe?.productName || selectedRecipe;
        const actualDecoOutput = decoOutputMap.get(recipeDisplayName) || 0;
        const actualExcess = actualDecoOutput > 0 ? Math.max(0, actualDecoOutput - group.totalQty) : 0;
        const isStarted = startedRecipes.has(selectedRecipe);
        const isStarting = startingRecipe === selectedRecipe;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedRecipe(null)} />
            <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-900/40 text-amber-300 text-[16px] font-bold">R</span>
                  <div>
                    <h3 className="text-[16px] font-bold text-white">{recipeDisplayName}</h3>
                    {recipe && recipe.productName !== selectedRecipe && <p className="text-[11px] text-zinc-500">DOS Product: {selectedRecipe}</p>}
                  </div>
                </div>
                <button onClick={() => setSelectedRecipe(null)} className="rounded-lg p-1.5 hover:bg-zinc-800 transition-colors">
                  <span className="text-zinc-400 text-[18px]">✕</span>
                </button>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="rounded-xl bg-zinc-800/50 p-3 text-center">
                    <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">DOS Demand</div>
                    <div className="text-[22px] font-bold text-white font-mono">{group.totalQty}</div>
                    <div className="text-[10px] text-zinc-500">pcs</div>
                  </div>
                  <div className="rounded-xl bg-zinc-800/50 p-3 text-center">
                    <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Deco Output</div>
                    <div className="text-[22px] font-bold text-emerald-400 font-mono">{actualDecoOutput || '—'}</div>
                    <div className="text-[10px] text-zinc-500">pcs</div>
                  </div>
                  <div className="rounded-xl bg-zinc-800/50 p-3 text-center">
                    <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Excess</div>
                    <div className={`text-[22px] font-bold font-mono ${actualExcess > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>{actualExcess}</div>
                    <div className="text-[10px] text-zinc-500">pcs</div>
                  </div>
                </div>
                <div className="rounded-xl bg-zinc-800/30 border border-zinc-800 p-4 mb-5">
                  <div className="text-[11px] text-zinc-500 mb-3 uppercase tracking-wider">Batch Calculation</div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-zinc-400">Batch</span>
                      <span className="text-[16px] font-bold text-white font-mono">{requiredBatches}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-zinc-400">Yield</span>
                      <span className="text-[16px] font-bold text-amber-400 font-mono">{hasYield ? `${yieldPerBatch} pcs` : 'N/A'}</span>
                    </div>
                  </div>
                </div>
                {recipe && recipe.ingredients.length > 0 && (
                  <div className="mb-5">
                    <div className="text-[11px] text-zinc-500 mb-3 uppercase tracking-wider">Ingredients</div>
                    <div className="space-y-1.5">
                      {recipe.ingredients.map((ing, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-zinc-800/30 px-3 py-2">
                          <span className="text-[12px] text-zinc-300">{ing.name}</span>
                          <span className="text-[12px] text-zinc-500 font-mono">{ing.qtyPerBatch * requiredBatches} {ing.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Additional Ingredients Used */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Additional Ingredients Used</div>
                    <button
                      onClick={() => { setShowIngredientPicker(true); setIngredientPickerSearch(""); setPickQuantities({}); }}
                      className="rounded-lg bg-amber-600/20 px-3 py-1.5 text-[11px] font-semibold text-amber-400 hover:bg-amber-600/30 transition-all"
                    >
                      + Add from Inventory
                    </button>
                  </div>
                  {(!additionalIngredients[selectedRecipe] || additionalIngredients[selectedRecipe].length === 0) ? (
                    <div className="rounded-lg bg-zinc-800/20 px-3 py-2.5 text-center">
                      <span className="text-[11px] text-zinc-500">No additional ingredients added.</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {additionalIngredients[selectedRecipe].map((ing, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-zinc-800/30 px-3 py-2">
                          <span className="text-[12px] text-zinc-300">{ing.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-zinc-400 font-mono">{ing.qty} {ing.unit}</span>
                            <button
                              onClick={() => {
                                const removed = additionalIngredients[selectedRecipe][i];
                                // Restore stock to inventory
                                if (removed.sourceType === "inventory") {
                                  onUpdateInventory?.(prev => prev.map(inv => inv.id === removed.sourceId ? { ...inv, onHand: inv.onHand + removed.qty } : inv));
                                  db.updateInventoryItem(removed.sourceId, { onHand: (inventory.find(inv => inv.id === removed.sourceId)?.onHand ?? 0) + removed.qty, group: "ingredients" }).catch(console.error);
                                }
                                setAdditionalIngredients(prev => ({
                                  ...prev,
                                  [selectedRecipe]: prev[selectedRecipe].filter((_, idx) => idx !== i),
                                }));
                              }}
                              className="rounded-md px-1.5 py-0.5 text-[11px] text-red-400 hover:bg-red-900/30 transition-all"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {recipe && recipe.notes && (
                  <div className="mb-5">
                    <div className="text-[11px] text-zinc-500 mb-2 uppercase tracking-wider">Notes</div>
                    <div className="text-[12px] text-zinc-400 rounded-lg bg-zinc-800/30 px-3 py-2.5">{recipe.notes}</div>
                  </div>
                )}
                <div className="mb-5">
                  <div className="text-[11px] text-zinc-500 mb-3 uppercase tracking-wider">DOS Items ({group.dos.length})</div>
                  <div className="space-y-1.5">
                    {group.dos.map((d, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-zinc-800/30 px-3 py-2">
                        <span className="text-[12px] text-zinc-400 font-mono">{d.id}</span>
                        <span className="text-[12px] text-white font-bold font-mono">{d.qty} pcs</span>
                      </div>
                    ))}
                  </div>
                </div>
                {!isStarted ? (
                  <button
                    onClick={() => handleStartRecipe(selectedRecipe)}
                    disabled={isStarting}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-[15px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  >
                    {isStarting ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Starting...
                      </span>
                    ) : (
                      'Start Task'
                    )}
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-900/30 border border-emerald-800/50 px-4 py-3.5">
                    <span className="text-emerald-400 text-[16px]">✓</span>
                    <span className="text-[14px] font-semibold text-emerald-300">Task Started — In Progress</span>
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

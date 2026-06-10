import React, { useEffect, useState } from "react";
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
  { id: "execute", label: "🏭 Execute Batches" },
];

export default function BakerDashboard({ production, dosItems, onCompleteTask, activeTab, productCatalog, recipes, newDOSIds, onMarkDOSSeen, freezerItems = [], onUpdateFreezer, freezerHistory = [], inventory = [], onUpdateInventory }: Props) {
  const [step, setStep] = useState(0);
  const [tasksStarted, setTasksStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [doneBatches, setDoneBatches] = useState<Set<string>>(new Set());
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

  // Assembly tab state
  const [assemblyTasks, setAssemblyTasks] = useState<db.BakerAssemblyTask[]>([]);
  const [assemblySearch, setAssemblySearch] = useState("");
  const [assembleQtys, setAssembleQtys] = useState<Record<string, string>>({});

  useEffect(() => {
    db.fetchBakerIngredientRequests().then(setIngredientReqs).catch(() => {});
  }, []);

  useEffect(() => {
    db.fetchBakerAssemblyTasks().then(setAssemblyTasks).catch(err => console.error("Failed to fetch assembly tasks:", err));
  }, [activeTab]);

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

  const handleStartTask = async () => {
    setStarting(true);
    try {
      await Promise.all(bakerDOS.map(d => db.updateDOS(d.id, { status: "in-progress" })));
      setTasksStarted(true);
      setStep(2);
    } catch (err) {
      console.error("Failed to start tasks:", err);
      alert("Failed to start tasks. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  const toggleBatch = (productName: string, batchIndex: number) => {
    const key = `${productName}::batch-${batchIndex}`;
    setDoneBatches(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Shared helpers for recipe matching — defined once at component scope
  const getBaseName = (name: string) =>
    name.toLowerCase().replace(/[\s]*[\(\*\d].*$/, '').trim();
  const findRecipe = (productName: string) =>
    recipes.find(r =>
      r.productName.toLowerCase() === productName.toLowerCase() ||
      r.linkedIngredients?.some(l => l.toLowerCase() === productName.toLowerCase()) ||
      getBaseName(r.productName) === getBaseName(productName)
    );

  /* ── Assembly Tab ── */
  if (activeTab === "assembly") {
    // Advanced Premix from Deco with remaining qty > 0
    const decoPremixItems = freezerItems.filter(i => i.producedBy === "deco" && i.status === "stored" && i.qty > 0 && i.batchRef?.startsWith("ADV-"));
    const todayDOSProducts = [...new Set(bakerDOS.map(d => d.product))];

    const handleAssemble = (premixIds: string[], qty: number, dosId?: string) => {
      const premixItems = premixIds.map(id => freezerItems.find(i => i.id === id)).filter(Boolean) as FreezerItem[];
      if (premixItems.length === 0) return;
      const dosItemsForProduct = dosId
        ? bakerDOS.filter(d => d.id === dosId)
        : bakerDOS.filter(d => d.product === premixItems[0].productName);
      if (dosItemsForProduct.length === 0) { alert("No DOS item found for this product."); return; }
      const dosQtyTotal = dosItemsForProduct.reduce((s, d) => s + d.qty, 0);
      const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];

      // Deduct qty from ALL linked premix items
      const updatedFreezer = freezerItems.map(f =>
        premixIds.includes(f.id) ? { ...f, qty: Math.max(0, f.qty - qty) } : f
      );
      onUpdateFreezer?.(updatedFreezer);
      db.upsertFreezerItems(updatedFreezer.filter(f => premixIds.includes(f.id))).catch(console.error);

      // Create Production Recipe item for baking (use DOS product name so wizard picks it up)
      const dosProduct = dosId ? bakerDOS.find(d => d.id === dosId) : null;
      const assembledItem: FreezerItem = {
        id: `FRZ-${Date.now()}`,
        productName: dosProduct?.product || premixItems[0].productName,
        qty,
        unit: "pcs",
        batchRef: `ASM-${Date.now()}`,
        producedBy: "baker",
        dateProduced: today,
        status: "stored",
        notes: "Production Recipe (Assembled)",
      };
      onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, assembledItem]);
      db.upsertFreezerItems([assembledItem]).catch(console.error);

      // Save assembly task
      const batchRefs = premixItems.map(p => p.batchRef).filter(Boolean).join(", ");
      const task: db.BakerAssemblyTask = {
        id: crypto.randomUUID?.() ?? `ASM-${Date.now()}`,
        productName: premixItems[0].productName,
        dosId: dosId || dosItemsForProduct[0].id,
        dosQty: dosQtyTotal,
        premixItemId: premixIds[0],
        premixQtyUsed: qty,
        qtyAssembled: qty,
        status: "completed",
        assembledBy: "baker",
        notes: `Assembled from ${batchRefs}`,
      };
      db.saveBakerAssemblyTask(task).catch(console.error);
      setAssemblyTasks(prev => [task, ...prev]);
    };

    // Compute assembled qty per product
    const assembledQtyMap = new Map<string, number>();
    assemblyTasks.filter(t => t.status === "completed").forEach(t => {
      assembledQtyMap.set(t.productName, (assembledQtyMap.get(t.productName) || 0) + t.qtyAssembled);
    });

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-[24px] font-semibold">Assembly</h1>
          <p className="mt-1 text-[13px] text-zinc-600">All recipes from Deco's Advanced Premix.</p>
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[14px]">⌕</span>
          <input value={assemblySearch} onChange={e => setAssemblySearch(e.target.value)} placeholder="Search recipes..." className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-2 text-[13px] outline-none focus:border-zinc-400" />
        </div>

        {/* Products (top, sliding) */}
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">DOS Product</h2>
          <div className="overflow-x-auto pb-2 -mx-5 px-5">
            <div className="flex gap-3 min-w-max">
              {bakerDOS
                .filter(d => !assemblySearch || d.product.toLowerCase().includes(assemblySearch.toLowerCase()))
                .map(dos => {
                  const matchedRecipes = recipes.filter(r => r.productName === dos.product || r.linkedIngredients?.includes(dos.product));
                  const allRecipeNames = matchedRecipes.map(r => r.productName);
                  const allRecipeLinked = [...new Set(matchedRecipes.flatMap(r => r.linkedIngredients ?? []))];
                  const matchingPremix = decoPremixItems.filter(p =>
                    allRecipeNames.includes(p.productName) ||
                    allRecipeLinked.includes(p.productName) ||
                    p.productName === dos.product
                  );
                  const done = (bakedQtyMap.get(dos.product) || 0) + freezerItems.filter(i => i.producedBy === "baker" && i.status === "stored" && i.notes === "Production Recipe (Assembled)" && i.productName === dos.product).reduce((s, i) => s + i.qty, 0);
                  const left = dos.qty - done;
                  const premixByProduct = new Map<string, number>();
                  matchingPremix.forEach(p => premixByProduct.set(p.productName, (premixByProduct.get(p.productName) || 0) + p.qty));
                  const minPremixQty = premixByProduct.size > 0 ? Math.min(...premixByProduct.values()) : 0;
                  const maxAssemble = Math.min(left, minPremixQty);
                  return (
                    <div key={dos.id} className="w-[280px] shrink-0 rounded-[20px] border border-[#E8E0D5] bg-white p-4 shadow-sm flex flex-col">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-[14px] font-semibold text-zinc-900">{dos.product}</h3>
                          <p className="text-[11px] text-zinc-400 mt-0.5">Recipe: {allRecipeNames.length > 0 ? allRecipeNames.join(", ") : dos.product}</p>
                        </div>
                        {matchingPremix.length > 0 ? (
                          <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Ready</span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-400">No premix</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[12px] text-zinc-500 mb-2">
                        <span>Need <strong className="text-zinc-700">{dos.qty}</strong></span>
                        <span className="text-zinc-200">|</span>
                        <span>Done <strong className="text-zinc-700">{done}</strong></span>
                        <span className="text-zinc-200">|</span>
                        <span>Left <strong className={left > 0 ? 'text-amber-600' : 'text-emerald-600'}>{Math.max(0, left)}</strong></span>
                      </div>
                      <div className="mt-auto flex items-center gap-2">
                        <input type="number" min={1} max={maxAssemble} value={assembleQtys[dos.id] ?? "1"}
                          onChange={e => setAssembleQtys(prev => ({ ...prev, [dos.id]: e.target.value }))}
                          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[12px] text-center outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-200" />
                        <button onClick={() => {
                          const qty = Number(assembleQtys[dos.id] ?? "1") || 0;
                          if (qty <= 0) return;
                          // Find one premix per unique linked recipe
                          const uniqueProducts = [...new Set(matchingPremix.map(p => p.productName))];
                          const targets = uniqueProducts
                            .map(name => matchingPremix.find(p => p.productName === name && p.qty >= qty))
                            .filter(Boolean) as FreezerItem[];
                          if (targets.length === 0) { alert("No premix stock left."); return; }
                          if (targets.length !== uniqueProducts.length) {
                            alert("Not all required recipes have enough premix stock.");
                            return;
                          }
                          handleAssemble(targets.map(t => t.id), qty, dos.id);
                          setAssembleQtys(prev => ({ ...prev, [dos.id]: "" }));
                        }}
                          disabled={left <= 0 || !(Number(assembleQtys[dos.id] ?? "1") > 0) || matchingPremix.every(p => p.qty <= 0)}
                          className="rounded-lg bg-zinc-900 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors">Assemble</button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Recipes from Advanced Premix (bottom, cards) */}
        {(() => {
          // Compute which premix names match at least one DOS product's recipe
          const premixMatchesDOS = new Set<string>();
          bakerDOS.forEach(dos => {
            const matchedRecipes = recipes.filter(r => r.productName === dos.product || r.linkedIngredients?.includes(dos.product));
            const allRecipeNames = matchedRecipes.map(r => r.productName);
            const allRecipeLinked = [...new Set(matchedRecipes.flatMap(r => r.linkedIngredients ?? []))];
            decoPremixItems.forEach(p => {
              if (allRecipeNames.includes(p.productName) || allRecipeLinked.includes(p.productName) || p.productName === dos.product) {
                premixMatchesDOS.add(p.productName);
              }
            });
          });
          return (
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Recipes</h2>
              {decoPremixItems.length === 0 ? (
                <div className="text-center py-10 text-[13px] text-zinc-400">No premix from Deco yet.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[...new Set(decoPremixItems.map(p => p.productName))]
                    .filter(n => !assemblySearch || n.toLowerCase().includes(assemblySearch.toLowerCase()))
                    .map(name => {
                      const items = decoPremixItems.filter(p => p.productName === name);
                      const total = items.reduce((s, p) => s + p.qty, 0);
                      const isRelevant = premixMatchesDOS.has(name);
                      return (
                        <div key={name} className={`rounded-[20px] border shadow-sm flex flex-col overflow-hidden ${isRelevant ? 'border-[#E8E0D5] bg-white' : 'border-dashed border-zinc-300 bg-zinc-50/30'}`}>
                          <div className="px-4 pt-4 pb-3 border-b border-zinc-100">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <h2 className="text-[16px] font-semibold text-zinc-900 leading-tight">{name}</h2>
                                {!isRelevant && (
                                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[9px] font-medium text-zinc-500">No DOS match</span>
                                )}
                              </div>
                              <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">{total} batch{total !== 1 ? 'es' : ''}</span>
                            </div>
                          </div>
                          <div className="px-4 py-3 bg-zinc-50/50">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Total Qty</span>
                              <span className="text-[22px] font-bold text-zinc-800">{total}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Assembly History */}
        {assemblyTasks.some(t => t.status === "completed") && (
          <div className="rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
              <h2 className="text-[15px] font-semibold">History</h2>
              <span className="text-[12px] text-zinc-400">{assemblyTasks.filter(t => t.status === "completed").length} completed</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
                    <th className="px-5 py-3">Recipe</th>
                    <th className="px-5 py-3">DOS Product</th>
                    <th className="px-5 py-3 text-right">Qty</th>
                    <th className="px-5 py-3">Premix Batch</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {assemblyTasks.filter(t => t.status === "completed").map(t => {
                    const dosProduct = bakerDOS.find(d => d.id === t.dosId)?.product || t.productName;
                    return (
                      <tr key={t.id} className="text-[13px] text-zinc-700">
                        <td className="px-5 py-3 font-medium">{t.productName}</td>
                        <td className="px-5 py-3 text-zinc-500">{dosProduct}</td>
                        <td className="px-5 py-3 text-right font-mono">{t.qtyAssembled}</td>
                        <td className="px-5 py-3 text-zinc-500">{t.notes?.replace("Assembled from ", "") || "—"}</td>
                        <td className="px-5 py-3 text-zinc-500">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}</td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => { if (confirm("Delete this assembly?")) db.deleteBakerAssemblyTask(t.id).then(() => setAssemblyTasks(prev => prev.filter(x => x.id !== t.id))).catch(alert); }}
                            className="text-[11px] text-red-500 hover:text-red-700">Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
        db.updateInventoryItem(existingInv.id, { onHand: existingInv.onHand + batchQty }).catch(console.error);
        onUpdateInventory?.(prev => prev.map(i => i.id === existingInv.id ? { ...i, onHand: i.onHand + batchQty } : i));
      } else {
        const newInv: InventoryItem = {
          id: `INV-${Date.now()}`,
          name: fillingName.trim(),
          onHand: batchQty,
          unit: "batches",
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
                {recipes.map(r => <option key={r.productName} value={r.productName} />)}
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
    const bakerItems = freezerItems.filter(i => i.producedBy === "baker" && i.status === "stored" && i.notes !== "Production Recipe (Assembled)");
    const bakerAccessInventory = inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("baker"));
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
                    return (
                      <tr key={inv.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-5 py-3.5"><div className="text-[13px] font-medium text-zinc-900">{inv.name}</div></td>
                        <td className="px-5 py-3.5 text-[13px] text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{inv.onHand} {inv.unit}</td>
                        <td className="px-5 py-3.5 text-[12px] text-zinc-500">{inv.group === "ingredients" ? "Ingredient" : inv.group === "packaging-materials" ? "Packaging" : inv.group === "decoration-supplies" ? "Decoration" : "Operational"}</td>
                        <td className="px-5 py-3.5"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{inv.group}</span></td>
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
      <div className="flex items-center gap-3">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-8 bg-zinc-700" />}
            <button
              onClick={() => setStep(i)}
              className={`rounded-full px-4 py-2 text-[12px] font-medium transition-all ${
                step === i
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {i === 0 && <span className="mr-1.5">📋</span>}
              {i === 1 && <span className="mr-1.5">✅</span>}
              {i === 2 && <span className="mr-1.5">🏭</span>}
              {s.label}
            </button>
          </div>
        ))}
      </div>

      {step === 0 && (
      <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-semibold text-white" style={{ fontFamily: "Instrument Sans, system-ui" }}>Today's DOS • {new Date().toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" })}</h2>
            <p className="text-[12px] text-zinc-400">Daily Order Sales — auto-generates production tasks</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-amber-500 border border-amber-900/50">LOCKED</span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-900">{bakerDOS.length} items</span>
          </div>
        </div>
        {bakerDOS.length === 0 ? (
          <div className="mt-8 text-center py-10"><p className="text-[14px] text-zinc-500">No baking orders yet.</p><p className="text-[12px] text-zinc-500 mt-1">Wait for Admin to create a DOS.</p></div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-800">
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-12 gap-2 border-b border-zinc-800 bg-zinc-950/50 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                  <div className="col-span-8">Recipe</div>
                  <div className="col-span-4 text-right">Status</div>
                </div>
                <div className="divide-y divide-zinc-800">
                  {(() => {
                    // Group by product
                    const grouped = new Map<string, { dos: DOSItem[]; totalQty: number }>();
                    bakerDOS.forEach(d => {
                      if (!grouped.has(d.product)) grouped.set(d.product, { dos: [], totalQty: 0 });
                      const g = grouped.get(d.product)!;
                      g.dos.push(d);
                      g.totalQty += d.qty;
                    });
                    return [...grouped.entries()].map(([productName, group]) => {
                      const recipe = findRecipe(productName);
                      // Only show recipe ID if it's a short readable ID (e.g. R001 — not a UUID)
                      const rawId = recipe?.id || '';
                      const recipeId = rawId.length > 10 ? '' : rawId;
                      const recipeDisplayName = recipe?.productName || productName;
                      const hasYield = !!(recipe?.yield && recipe.yield > 0);
                      const yieldPerBatch = recipe?.yield ?? 1;
                      const requiredBatches = Math.ceil(group.totalQty / yieldPerBatch);
                      const productionOutput = requiredBatches * yieldPerBatch;
                      const excess = productionOutput - group.totalQty;
                      const itemStatus = group.dos.every(d => d.status === "completed") ? "completed" : group.dos.some(d => d.status === "in-progress") ? "in-progress" : "pending";
                      return (
                        <div key={productName} className="grid grid-cols-12 items-center gap-2 px-3 py-3 hover:bg-zinc-800/40 transition-colors">
                          <div className="col-span-8">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-semibold text-white">Recipe: {recipeDisplayName}</span>
                              {recipe && recipeId && <span className="text-[11px] font-mono text-zinc-500 shrink-0">({recipeId})</span>}
                              {recipe && <span className="text-[10px] text-zinc-600">→ {productName}</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2">
                              {hasYield ? (
                                <>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-zinc-500">Required Batches:</span>
                                    <span className="text-[14px] font-bold text-white font-mono">{requiredBatches}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-zinc-500">Yield per Batch:</span>
                                    <span className="text-[14px] font-bold text-amber-400 font-mono">{yieldPerBatch} <span className="text-[11px] font-medium text-amber-600">pcs</span></span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-zinc-500">Production Output:</span>
                                    <span className="text-[14px] font-bold text-emerald-400 font-mono">{productionOutput} <span className="text-[11px] font-medium text-emerald-600">pcs</span></span>
                                    {excess > 0 && (
                                      <span className="text-[10px] text-amber-400/70 ml-1">(Excess: {excess} pcs)</span>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <span className="text-[11px] text-amber-400/70 italic">Set recipe yield in Admin &gt; Recipes</span>
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
                          <div className="col-span-4 flex items-center justify-end">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                              itemStatus === "completed" ? "bg-emerald-900/40 text-emerald-300" :
                              itemStatus === "in-progress" ? "bg-amber-900/40 text-amber-300" :
                              "bg-zinc-800 text-zinc-400"
                            }`}>
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                                itemStatus === "completed" ? "bg-emerald-500" :
                                itemStatus === "in-progress" ? "bg-amber-500 animate-pulse" :
                                "bg-zinc-500"
                              }`} />
                              {itemStatus === "completed" ? "Completed" : itemStatus === "in-progress" ? "In Progress" : "Pending"}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-950/40 px-3 py-2.5">
          <div className="text-[12px] text-zinc-500">Baker: {bakerDOS.length} items</div>
          <button onClick={() => setStep(1)} className="rounded-lg bg-white px-5 py-2 text-[12px] font-semibold text-zinc-900 hover:bg-zinc-100 transition-colors">
            Next →
          </button>
        </div>
      </div>
      )}

      {step === 1 && (
        <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          {!tasksStarted ? (
            <>
              <div className="flex items-center gap-4 mb-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-900/40 text-amber-300 text-[18px] font-bold">1</span>
                <div>
                  <h2 className="text-[20px] font-bold text-white tracking-tight">STEP 1 — ACKNOWLEDGE TASK</h2>
                  <p className="text-[12px] text-zinc-400 mt-0.5">Review and start today's baking tasks</p>
                </div>
              </div>

              {/* Recipe list */}
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
                  const productionOutput = requiredBatches * yieldPerBatch;
                  const excess = productionOutput - group.totalQty;
                  const recipeDisplayName = recipe?.productName || productName;
                  return (
                    <div key={productName} className="flex items-center justify-between rounded-xl bg-zinc-800/50 px-4 py-3 mb-2 last:mb-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-white truncate">{recipeDisplayName}</span>
                          {recipe && <span className="text-[10px] text-zinc-600">→ {productName}</span>}
                        </div>
                        {hasYield ? (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px]">
                            <span className="text-zinc-400">{requiredBatches} batch{requiredBatches !== 1 ? 'es' : ''}</span>
                            <span className="text-zinc-600">·</span>
                            <span className="text-amber-400/80">{yieldPerBatch} pcs/batch</span>
                            <span className="text-zinc-600">·</span>
                            <span className="text-emerald-400/80">{productionOutput} pcs output</span>
                            {excess > 0 && <span className="text-amber-400/70">· {excess} pcs excess</span>}
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-400/60 mt-0.5 block">No yield set</span>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className="text-[15px] font-bold text-white font-mono">{group.totalQty}</div>
                        <div className="text-[10px] text-zinc-500">pcs ordered</div>
                      </div>
                    </div>
                  );
                });
              })()}

              {/* Summary bar */}
              <div className="flex items-center justify-between rounded-xl bg-zinc-950/40 px-4 py-2.5 mt-4 mb-5">
                <span className="text-[12px] text-zinc-500">{bakerDOS.length} recipe{bakerDOS.length !== 1 ? 's' : ''} · {bakerDOS.reduce((s, d) => s + d.qty, 0)} pcs total</span>
              </div>

              <button
                onClick={handleStartTask}
                disabled={starting}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-[15px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {starting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Starting...
                  </span>
                ) : (
                  'Start Task'
                )}
              </button>
              <p className="mt-3 text-[11px] text-zinc-500 text-center">System will lock all tasks and set status to <span className="text-amber-400 font-medium">In Progress</span></p>

              {/* Back button */}
              <div className="mt-4 text-center">
                <button onClick={() => setStep(0)} className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">
                  ← Back to DOS Review
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-900/40 text-emerald-300 text-[18px] font-bold">✔</span>
                <div>
                  <h2 className="text-[20px] font-bold text-emerald-300 tracking-tight">TASK STARTED</h2>
                  <p className="text-[12px] text-zinc-400 mt-0.5">System has locked the task</p>
                </div>
              </div>
              <div className="rounded-xl bg-zinc-800/50 p-4 space-y-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-zinc-400">Status:</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-900/40 px-3 py-1 text-[12px] font-semibold text-amber-300">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    In Progress
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-zinc-400">Tasks locked:</span>
                  <span className="font-mono font-semibold text-emerald-400">{bakerDOS.length}</span>
                </div>
              </div>
              <p className="mt-4 text-[11px] text-zinc-500 text-center">You can now proceed to baking. DOS items are marked in-progress.</p>
              <div className="mt-4 text-center">
                <button onClick={() => setStep(0)} className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">
                  ← Back to DOS Review
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-900/40 text-amber-300 text-[18px] font-bold">3</span>
            <div>
              <h2 className="text-[20px] font-bold text-white tracking-tight">STEP 3 — EXECUTE BATCHES</h2>
              <p className="text-[12px] text-zinc-400 mt-0.5">Baker follows physical production only — portion, shape, and bake each batch</p>
            </div>
          </div>

          {(() => {
            // Compute total batches once
            let totalBatches = 0;
            const seen = new Set<string>();
            bakerDOS.forEach(d => {
              if (!seen.has(d.product)) {
                seen.add(d.product);
                const recipe = findRecipe(d.product);
                const y = recipe?.yield ?? 1;
                const q = [...bakerDOS.filter(x => x.product === d.product)].reduce((s, x) => s + x.qty, 0);
                totalBatches += Math.ceil(q / y);
              }
            });
            const pct = totalBatches > 0 ? (doneBatches.size / totalBatches) * 100 : 0;

            return (
              <>
                <div className="rounded-xl bg-zinc-950/40 p-3 mb-5">
                  <div className="flex items-center justify-between text-[12px] text-zinc-400 mb-2">
                    <span>Overall Progress</span>
                    <span>{doneBatches.size} / {totalBatches} batches</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
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
              const productionOutput = requiredBatches * yieldPerBatch;
              const excess = productionOutput - group.totalQty;
              const recipeDisplayName = recipe?.productName || productName;
              const doneCount = [...Array(requiredBatches)].filter((_, i) => doneBatches.has(`${productName}::batch-${i}`)).length;
              const allDone = doneCount >= requiredBatches;
              return (
                <div key={productName} className={`rounded-xl border ${allDone ? 'border-emerald-900/50 bg-emerald-900/10' : 'border-zinc-800 bg-zinc-800/30'} p-4 mb-3 last:mb-0 transition-colors`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[14px] font-semibold ${allDone ? 'text-emerald-300' : 'text-white'} truncate`}>{recipeDisplayName}</span>
                      {recipe && <span className="text-[10px] text-zinc-600 shrink-0">→ {productName}</span>}
                      {allDone && <span className="text-emerald-400 text-[14px]">✓</span>}
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium ml-2 ${allDone ? 'bg-emerald-900/40 text-emerald-300' : 'bg-zinc-700 text-zinc-300'}`}>
                      {doneCount}/{requiredBatches} batches
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 mb-3">
                    <span>{group.totalQty} pcs demand</span>
                    <span className="mx-1.5">·</span>
                    <span className="text-amber-400/70">{yieldPerBatch} pcs/batch</span>
                    {hasYield && (
                      <>
                        <span className="mx-1.5">·</span>
                        <span className="text-emerald-400/70">{productionOutput} pcs output</span>
                        {excess > 0 && <span className="ml-1.5 text-amber-400/60">({excess} pcs excess)</span>}
                      </>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {[...Array(requiredBatches)].map((_, i) => {
                      const batchKey = `${productName}::batch-${i}`;
                      const isDone = doneBatches.has(batchKey);
                      return (
                        <button
                          key={batchKey}
                          onClick={() => toggleBatch(productName, i)}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all ${
                            isDone
                              ? 'border-emerald-700/50 bg-emerald-900/30 text-emerald-200'
                              : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800'
                          }`}
                        >
                          <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                            isDone ? 'bg-emerald-600 text-white' : 'bg-zinc-700 text-zinc-400'
                          }`}>
                            {isDone ? '✓' : i + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium">Batch {i + 1}</div>
                            <div className="text-[9px] text-zinc-500">{yieldPerBatch} pcs</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
            </>
          );
        })()}

          {/* Back button */}
          <div className="mt-5 text-center">
            <button onClick={() => setStep(1)} className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">
              ← Back to Acknowledge
            </button>
          </div>
        </div>
      )}

      {bakerScheduledSection}
    </div>
  );

}

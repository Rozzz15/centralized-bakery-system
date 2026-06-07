import { useEffect, useState } from "react";
import type { DOSItem, FreezerItem, FreezerHistory, InventoryItem, PromoPackage, PastryAssemblyTask, ProductRecipe } from "../types";
import * as db from "../lib/db";

type Props = {
  dosItems: DOSItem[];
  activeTab: string;
  newDOSIds?: Set<string>;
  onMarkDOSSeen?: (ids: string[]) => void;
  freezerItems?: FreezerItem[];
  onUpdateFreezer?: (cb: FreezerItem[] | ((prev: FreezerItem[]) => FreezerItem[])) => void;
  freezerHistory?: FreezerHistory[];
  inventory?: InventoryItem[];
  onUpdateInventory?: (cb: InventoryItem[] | ((prev: InventoryItem[]) => InventoryItem[])) => void;
  promosPackages?: PromoPackage[];
  recipes?: ProductRecipe[];
  productCatalog?: string[];
};

const workflowSteps = [
  { id: "orders", label: "My Orders" },
  { id: "availability", label: "Check Availability" },
  { id: "accept", label: "Accept Task" },
  { id: "assemble", label: "Assemble" },
  { id: "qc", label: "QC & Complete" },
];

export default function PastryDashboard({ dosItems, activeTab, newDOSIds, onMarkDOSSeen, freezerItems = [], onUpdateFreezer, freezerHistory = [], inventory = [], promosPackages = [], recipes = [], productCatalog = [] }: Props) {
  const [step, setStep] = useState(0);
  const [selectedDOS, setSelectedDOS] = useState<DOSItem | null>(null);
  const [selectedFreezerItems, setSelectedFreezerItems] = useState<Map<string, { item: FreezerItem; qty: number }>>(new Map());
  const [producedCount, setProducedCount] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<Map<string, number>>(new Map());

  const [assemblyTasks, setAssemblyTasks] = useState<PastryAssemblyTask[]>([]);
  const [activeTask, setActiveTask] = useState<PastryAssemblyTask | null>(null);

  const [qcChecklist, setQcChecklist] = useState<Record<string, boolean>>({
    correctProducts: false,
    correctQty: false,
    packagingComplete: false,
    labelAttached: false,
  });

  const [showAddFreezer, setShowAddFreezer] = useState(false);
  const [showEditFreezer, setShowEditFreezer] = useState(false);
  const [editingFreezerItem, setEditingFreezerItem] = useState<FreezerItem | null>(null);
  const [newProduct, setNewProduct] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("pcs");
  const [newBatch, setNewBatch] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [freezerSearch, setFreezerSearch] = useState("");
  const [freezerTab, setFreezerTab] = useState<"assembled" | "components" | "my-inventory">("assembled");

  const [assemblySearch, setAssemblySearch] = useState("");
  const [assembleQtys, setAssembleQtys] = useState<Record<string, string>>({});

  useEffect(() => {
    db.fetchPastryAssemblyTasks().then(setAssemblyTasks).catch(console.error);
  }, [activeTab]);

  const todayDOS = dosItems.filter(d => {
    if (d.status === "scheduled") return false;
    if (d.scheduledDate && d.scheduledDate <= new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0]) return true;
    const ts = d.id.match(/DOS-(\d+)/)?.[1];
    if (!ts) return false;
    const itemDate = new Date(Number(ts)).toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    return itemDate === new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
  });

  const pastryDOS = todayDOS.filter(d => (d.roles ?? []).includes("pastry"));
  const pendingDOS = pastryDOS.filter(d => !completedTasks.has(d.id) && d.status !== "completed");
  const doneDOS = pastryDOS.filter(d => completedTasks.has(d.id) || d.status === "completed");

  const findPromo = (productName: string) => promosPackages.find(p => p.name === productName);

  const bakedProducts = freezerItems.filter(i =>
    i.status === "stored" && i.qty > 0 && i.producedBy === "baker" &&
    !i.notes?.startsWith("Production Recipe")
  );
  const decoProductionRecipes = freezerItems.filter(i =>
    i.status === "stored" && i.qty > 0 && i.producedBy === "deco" &&
    i.notes?.startsWith("Production Recipe")
  );
  const advancedPremix = freezerItems.filter(i =>
    i.status === "stored" && i.qty > 0 && i.batchRef?.startsWith("ADV-")
  );

  const getNeedPerProduct = (): Map<string, number> => {
    const need = new Map<string, number>();
    if (!selectedDOS) return need;
    const promo = findPromo(selectedDOS.product);
    if (promo) {
      promo.items.forEach(item => {
        need.set(item.productName, (need.get(item.productName) || 0) + item.qty * (selectedDOS.qty ?? 1));
      });
    } else {
      need.set(selectedDOS.product, selectedDOS.qty ?? 1);
    }
    return need;
  };

  const getAllocatedPerProduct = (): Map<string, number> => {
    const allocated = new Map<string, number>();
    selectedFreezerItems.forEach(({ item, qty }) => {
      allocated.set(item.productName, (allocated.get(item.productName) || 0) + qty);
    });
    return allocated;
  };

  const getRemainingPerProduct = (productName: string): number => {
    const need = getNeedPerProduct();
    const productNeed = need.get(productName) || 0;
    const allocated = getAllocatedPerProduct();
    const productAllocated = allocated.get(productName) || 0;
    return Math.max(0, productNeed - productAllocated);
  };

  const toggleFreezerItem = (item: FreezerItem) => {
    setSelectedFreezerItems(prev => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        const need = getNeedPerProduct();
        const productNeed = need.get(item.productName) || 0;
        let otherAllocated = 0;
        prev.forEach(({ item: sel, qty }) => {
          if (sel.productName === item.productName) otherAllocated += qty;
        });
        const remaining = Math.max(0, productNeed - otherAllocated);
        const autoQty = remaining > 0 ? Math.min(remaining, item.qty) : item.qty;
        next.set(item.id, { item, qty: autoQty });
      }
      return next;
    });
  };

  const updateFreezerItemQty = (itemId: string, newQty: number) => {
    setSelectedFreezerItems(prev => {
      const next = new Map(prev);
      const entry = next.get(itemId);
      if (entry) {
        const need = getNeedPerProduct();
        const productNeed = need.get(entry.item.productName) || 0;
        let otherAllocated = 0;
        prev.forEach(({ item: sel, qty }) => {
          if (sel.productName === entry.item.productName && sel.id !== itemId) otherAllocated += qty;
        });
        const maxAllowed = Math.max(1, Math.min(entry.item.qty, productNeed - otherAllocated));
        const clamped = Math.max(1, Math.min(newQty, maxAllowed));
        next.set(itemId, { ...entry, qty: clamped });
      }
      return next;
    });
  };

  const promo = selectedDOS ? findPromo(selectedDOS.product) : null;
  const produceTarget = promo
    ? promo.items.reduce((sum, item) => sum + item.qty, 0) * (selectedDOS?.qty ?? 1)
    : selectedDOS?.qty ?? 0;

  const handleAcceptTask = () => {
    if (!selectedDOS) return;
    const promoDef = findPromo(selectedDOS.product);
    const components: PastryAssemblyTask["components"] = [];
    if (promoDef) {
      promoDef.items.forEach(pi => {
        const matchingBaked = bakedProducts.filter(b => b.productName === pi.productName);
        matchingBaked.forEach(b => {
          components.push({ productName: b.productName, qty: pi.qty * (selectedDOS.qty ?? 1), sourceFreezerId: b.id });
        });
      });
    }
    const task: PastryAssemblyTask = {
      id: crypto.randomUUID?.() ?? `PASM-${Date.now()}`,
      dosId: selectedDOS.id,
      promoId: promoDef?.id,
      productName: selectedDOS.product,
      promoType: promoDef ? (promoDef.type as "promo" | "package") : "normal",
      components,
      targetQty: produceTarget,
      assembledQty: 0,
      status: "accepted",
      assembledBy: "pastry",
      qcChecklist: {},
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.savePastryAssemblyTask(task).catch(console.error);
    setAssemblyTasks(prev => [task, ...prev]);
    setActiveTask(task);
    setStep(3);
  };

  const handleStartAssembly = () => {
    if (!activeTask) return;
    const updated = { ...activeTask, status: "in_progress" as const, updatedAt: new Date().toISOString() };
    db.savePastryAssemblyTask(updated).catch(console.error);
    setAssemblyTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    setActiveTask(updated);
  };

  const handleCompleteAssembly = () => {
    if (!selectedDOS || !activeTask) return;
    const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];

    if (selectedFreezerItems.size > 0 && onUpdateFreezer) {
      const deductions: FreezerItem[] = [];
      selectedFreezerItems.forEach(({ item, qty }) => {
        const deductQty = Math.min(qty, item.qty);
        deductions.push({ ...item, qty: item.qty - deductQty });
      });
      onUpdateFreezer((prev: FreezerItem[]) =>
        prev.map(f => {
          const sub = deductions.find(d => d.id === f.id);
          return sub || f;
        })
      );
      db.upsertFreezerItems(deductions).catch(console.error);
    }

    const assembledItem: FreezerItem = {
      id: `FRZ-${Date.now()}`,
      productName: promo ? `${promo.name} (${promo.type})` : selectedDOS.product,
      qty: producedCount,
      unit: "pcs",
      batchRef: `PASM-${Date.now()}`,
      producedBy: "pastry",
      dateProduced: today,
      status: "stored",
      notes: promo ? `Assembled ${promo.type} - ${promo.name}` : `Packaged - ${selectedDOS.product}`,
    };
    onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, assembledItem]);
    db.upsertFreezerItems([assembledItem]).catch(console.error);

    const historyEntry: FreezerHistory = {
      id: `FRZH-${Date.now()}`,
      productName: assembledItem.productName,
      producedBy: "pastry",
      qtyChanged: producedCount,
      action: "assembled",
      reference: activeTask.dosId || "",
      timestamp: new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" }),
    };
    db.insertFreezerHistory(historyEntry).catch(console.error);

    const finalTask = { ...activeTask, status: "completed" as const, assembledQty: producedCount, qcChecklist, updatedAt: new Date().toISOString() };
    db.savePastryAssemblyTask(finalTask).catch(console.error);
    setAssemblyTasks(prev => prev.map(t => t.id === finalTask.id ? finalTask : t));

    setCompletedTasks(prev => new Map(prev).set(selectedDOS.id, producedCount));
    setSelectedDOS(null);
    setProducedCount(0);
    setSelectedFreezerItems(new Map());
    setActiveTask(null);
    setQcChecklist({ correctProducts: false, correctQty: false, packagingComplete: false, labelAttached: false });
    setStep(4);
  };

  if (activeTab === "dashboard" && todayDOS.length > 0 && newDOSIds && onMarkDOSSeen) {
    const unseen = todayDOS.filter(d => newDOSIds.has(d.id));
    if (unseen.length > 0) onMarkDOSSeen(unseen.map(d => d.id));
  }

  if (activeTab === "dashboard") {
    return (
      <div className="min-h-screen bg-zinc-50/50">
        <div className="max-w-4xl mx-auto space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Pastry Production</h1>
              <p className="mt-1.5 text-base text-zinc-500">Assemble packages, promos, and packaged products</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-emerald-700">Active</span>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm overflow-x-auto">
            <div className="flex items-center gap-1.5 min-w-max">
              {workflowSteps.map((s, i) => (
                <div key={s.id} className="flex items-center gap-1.5">
                  <button
                    onClick={() => { if (i <= step) setStep(i); }}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-all whitespace-nowrap ${
                      step === i
                        ? "bg-amber-600 text-white shadow-md"
                        : step > i
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-zinc-50 text-zinc-400 border border-zinc-100"
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      step === i ? "bg-white/20 text-white" : step > i ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-400"
                    }`}>
                      {step > i ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="hidden lg:inline">{s.label}</span>
                  </button>
                  {i < workflowSteps.length - 1 && (
                    <div className={`w-5 h-0.5 rounded-full shrink-0 ${step > i ? "bg-amber-400" : "bg-zinc-200"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ─── Step 0: My Orders ─── */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-zinc-900">Your DOS Orders</h2>
                  <p className="mt-2 text-base text-zinc-500">Select an order below to begin assembly.</p>
                </div>
                {pastryDOS.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-5">
                      <svg className="w-10 h-10 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                    </div>
                    <p className="text-lg font-medium text-zinc-500">No pastry orders yet</p>
                    <p className="text-sm text-zinc-400 mt-2">Wait for Admin to create a DOS.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4">
                      {pastryDOS.map(d => {
                        const isDone = completedTasks.has(d.id) || d.status === "completed";
                        const isSelected = selectedDOS?.id === d.id;
                        const p = findPromo(d.product);
                        return (
                          <button
                            key={d.id}
                            disabled={isDone}
                            onClick={() => { if (!isDone) setSelectedDOS(isSelected ? null : d); }}
                            className={`w-full text-left rounded-2xl border-2 p-6 transition-all ${
                              isDone
                                ? "border-zinc-100 bg-zinc-50 opacity-50 cursor-not-allowed"
                                : isSelected
                                  ? "border-amber-400 bg-amber-50 shadow-lg ring-2 ring-amber-200"
                                  : "border-zinc-100 bg-white hover:border-zinc-300 hover:shadow-md cursor-pointer"
                            }`}
                          >
                            <div className="flex items-start gap-5">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                                isDone ? "bg-emerald-100" : isSelected ? "bg-amber-500" : "bg-zinc-100"
                              }`}>
                                {isDone ? (
                                  <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                  <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="text-lg font-semibold text-zinc-900">{d.product}</span>
                                  {newDOSIds?.has(d.id) && !isDone && (
                                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">NEW</span>
                                  )}
                                  {p && (
                                    <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700 uppercase">{p.type}</span>
                                  )}
                                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                    d.priority === "HIGH" ? "bg-red-50 text-red-700 border-red-200" : d.priority === "MEDIUM" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-zinc-100 text-zinc-600 border-zinc-200"
                                  }`}>{d.priority}</span>
                                </div>
                                <div className="mt-1.5 text-sm text-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }}>{d.id}</div>
                                {p && (
                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {p.items.map((item, idx) => (
                                      <span key={idx} className="inline-flex items-center rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600">
                                        {item.productName} x{item.qty}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-3xl font-bold text-zinc-900" style={{ fontFamily: "Fragment Mono, monospace" }}>{d.qty}</div>
                                <div className="text-sm text-zinc-400 mt-0.5">pcs</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between mt-6 px-2">
                      <span className="text-sm text-zinc-400">{pendingDOS.length} pending &middot; {doneDOS.length} completed</span>
                      <span className="text-sm text-zinc-400">Total: <span className="font-semibold text-zinc-600" style={{ fontFamily: "Fragment Mono, monospace" }}>{pastryDOS.reduce((s, d) => s + d.qty, 0)} pcs</span></span>
                    </div>

                    <div className="mt-6">
                      <button
                        onClick={() => { if (selectedDOS) setStep(1); }}
                        disabled={!selectedDOS}
                        className="w-full rounded-2xl bg-amber-600 py-4 text-lg font-bold text-white hover:bg-amber-700 transition-all shadow-md active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-600"
                      >
                        {selectedDOS ? `Continue with ${selectedDOS.product}` : "Select an order to continue"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ─── Step 1: Check Availability ─── */}
          {step === 1 && selectedDOS && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <button onClick={() => setStep(0)} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">Select Products</h2>
                  <p className="mt-1 text-base text-zinc-500">Pick what you need from Baker &amp; Deco freezers.</p>
                </div>
              </div>

              {/* Order summary */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900">{selectedDOS.product}</h3>
                    <p className="text-sm text-zinc-500 mt-1" style={{ fontFamily: "Fragment Mono, monospace" }}>{selectedDOS.id}</p>
                    {promo && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {promo.items.map((item, idx) => (
                          <span key={idx} className="inline-flex items-center rounded-lg bg-white border border-amber-200 px-3 py-1.5 text-sm font-medium text-amber-800">
                            {item.productName} x{item.qty * (selectedDOS.qty ?? 1)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Target</div>
                    <div className="text-3xl font-bold text-amber-700 mt-1" style={{ fontFamily: "Fragment Mono, monospace" }}>{selectedDOS.qty}</div>
                    <div className="text-sm text-zinc-500">pieces</div>
                  </div>
                </div>
              </div>

              {/* Product selection — grouped by product name */}
              {(() => {
                const need = getNeedPerProduct();
                if (need.size === 0) return null;

                const allStock = [...bakedProducts, ...decoProductionRecipes, ...advancedPremix];

                return (
                  <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50">
                      <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Products Needed</h3>
                    </div>
                    <div className="divide-y divide-zinc-100">
                      {[...need.entries()].map(([productName, productNeed]) => {
                        const stockItems = allStock.filter(i => i.productName === productName);
                        const totalAvailable = stockItems.reduce((s, i) => s + i.qty, 0);
                        const allocated = getAllocatedPerProduct().get(productName) || 0;
                        const isFull = allocated >= productNeed;
                        const isAvailable = totalAvailable > 0;

                        return (
                          <div key={productName} className={`px-6 py-5 ${isFull ? "bg-emerald-50/50" : ""}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${isFull ? "bg-emerald-500" : isAvailable ? "bg-amber-400" : "bg-red-400"}`} />
                                <span className="text-base font-semibold text-zinc-900">{productName}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-zinc-500">
                                  Need <span className="font-bold text-zinc-700" style={{ fontFamily: "Fragment Mono, monospace" }}>{productNeed}</span>
                                </span>
                                <span className="text-zinc-300">|</span>
                                <span className="text-sm text-zinc-500">
                                  Available <span className={`font-bold ${isAvailable ? "text-emerald-600" : "text-red-500"}`} style={{ fontFamily: "Fragment Mono, monospace" }}>{totalAvailable}</span>
                                </span>
                                {stockItems.length > 1 && (
                                  <span className="text-xs text-zinc-400">({stockItems.length} batches)</span>
                                )}
                              </div>
                            </div>

                            {/* Qty selector for this product */}
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-zinc-500 w-16">Select:</span>
                              <button
                                onClick={() => {
                                  const newQty = Math.max(0, allocated - 1);
                                  // Remove or reduce selections for this product
                                  setSelectedFreezerItems(prev => {
                                    const next = new Map(prev);
                                    let toRemove = allocated - newQty;
                                    // Remove from last selected first
                                    const itemsForProduct = [...next.entries()]
                                      .filter(([_, v]) => v.item.productName === productName)
                                      .sort((a, b) => b[1].qty - a[1].qty);
                                    for (const [id, entry] of itemsForProduct) {
                                      if (toRemove <= 0) break;
                                      if (entry.qty <= toRemove) {
                                        toRemove -= entry.qty;
                                        next.delete(id);
                                      } else {
                                        next.set(id, { ...entry, qty: entry.qty - toRemove });
                                        toRemove = 0;
                                      }
                                    }
                                    return next;
                                  });
                                }}
                                disabled={allocated <= 0}
                                className="w-10 h-10 rounded-xl border-2 border-zinc-200 bg-white text-xl font-bold text-zinc-500 hover:bg-zinc-100 hover:border-zinc-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                              >-</button>
                              <div className="w-20 text-center text-2xl font-bold text-zinc-900" style={{ fontFamily: "Fragment Mono, monospace" }}>
                                {allocated}
                              </div>
                              <button
                                onClick={() => {
                                  const maxAllowed = Math.min(productNeed, totalAvailable);
                                  const toAdd = maxAllowed - allocated;
                                  if (toAdd <= 0) return;
                                  // Auto-select from available batches (FIFO)
                                  let remaining = toAdd;
                                  setSelectedFreezerItems(prev => {
                                    const next = new Map(prev);
                                    for (const si of stockItems) {
                                      if (remaining <= 0) break;
                                      const alreadySelected = next.get(si.id);
                                      const alreadyHas = alreadySelected ? alreadySelected.qty : 0;
                                      const batchAvail = si.qty - alreadyHas;
                                      if (batchAvail <= 0) continue;
                                      const take = Math.min(remaining, batchAvail);
                                      if (alreadySelected) {
                                        next.set(si.id, { ...alreadySelected, qty: alreadySelected.qty + take });
                                      } else {
                                        next.set(si.id, { item: si, qty: take });
                                      }
                                      remaining -= take;
                                    }
                                    return next;
                                  });
                                }}
                                disabled={allocated >= Math.min(productNeed, totalAvailable)}
                                className="w-10 h-10 rounded-xl border-2 border-amber-300 bg-amber-50 text-xl font-bold text-amber-600 hover:bg-amber-100 hover:border-amber-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                              >+</button>
                              <span className="text-sm text-zinc-400 ml-1">/ {Math.min(productNeed, totalAvailable)} max</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-4">
                <button onClick={() => setStep(0)} className="rounded-2xl border border-zinc-200 bg-white py-4 px-6 text-base font-medium text-zinc-700 hover:bg-zinc-50 transition-all">Back</button>
                <button onClick={() => setStep(2)} className="flex-1 rounded-2xl bg-amber-600 py-4 text-lg font-bold text-white hover:bg-amber-700 transition-all shadow-md">Continue</button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Accept Task ─── */}
          {step === 2 && selectedDOS && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <button onClick={() => setStep(1)} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">Accept Task</h2>
                  <p className="mt-1 text-base text-zinc-500">Confirm you will work on this order.</p>
                </div>
              </div>

              <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-8">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900">{selectedDOS.product}</h3>
                  <p className="text-sm text-zinc-500 mt-1" style={{ fontFamily: "Fragment Mono, monospace" }}>{selectedDOS.id}</p>
                  <div className="text-4xl font-bold text-amber-700 mt-4" style={{ fontFamily: "Fragment Mono, monospace" }}>{selectedDOS.qty} pcs</div>
                  {promo && (
                    <div className="flex flex-wrap gap-2 mt-4 justify-center">
                      {promo.items.map((item, idx) => (
                        <span key={idx} className="inline-flex items-center rounded-lg bg-white border border-amber-200 px-3 py-1.5 text-sm font-medium text-amber-800">
                          {item.productName} x{item.qty * (selectedDOS.qty ?? 1)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => setStep(1)} className="rounded-2xl border border-zinc-200 bg-white py-4 px-6 text-base font-medium text-zinc-700 hover:bg-zinc-50 transition-all">Back</button>
                <button onClick={handleAcceptTask} className="flex-1 rounded-2xl bg-amber-600 py-4 text-lg font-bold text-white hover:bg-amber-700 transition-all shadow-md active:scale-[0.98]">
                  Accept Task
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 3: Assemble ─── */}
          {step === 3 && selectedDOS && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <button onClick={() => setStep(2)} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">Assembling</h2>
                  <p className="mt-1 text-base text-zinc-500">Count how many you assembled, then proceed to QC.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900">{selectedDOS.product}</h3>
                    <p className="text-xs text-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }}>{selectedDOS.id}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-zinc-900" style={{ fontFamily: "Fragment Mono, monospace" }}>{produceTarget}</div>
                    <div className="text-xs text-zinc-400">needed</div>
                  </div>
                </div>
                {promo && (
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-100">
                    {promo.items.map((item, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600">
                        {item.productName} <span className="font-semibold text-zinc-800">x{item.qty * (selectedDOS.qty ?? 1)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {selectedFreezerItems.size > 0 && (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                    <span className="text-sm font-semibold text-sky-800">Using from Freezer</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[...selectedFreezerItems.values()].map(({ item, qty }) => (
                      <span key={item.id} className="inline-flex items-center gap-1 rounded-lg bg-white border border-sky-200 px-3 py-1.5 text-sm font-medium text-sky-800">
                        {item.productName} <span className="font-bold">x{qty}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border-2 border-zinc-200 bg-white p-6">
                <div className="flex items-center justify-center gap-4 mb-5">
                  <button onClick={() => setProducedCount(prev => Math.max(0, prev - 1))} disabled={producedCount <= 0} className="w-14 h-14 rounded-xl border-2 border-zinc-200 bg-zinc-50 text-2xl font-bold text-zinc-500 hover:bg-zinc-100 hover:border-zinc-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95">&minus;</button>
                  <input type="number" min="0" max={produceTarget * 2} value={producedCount} onChange={e => setProducedCount(Math.max(0, Math.min(Number(e.target.value) || 0, produceTarget * 2)))} className="w-28 text-center text-5xl font-bold text-zinc-900 bg-transparent border-b-2 border-zinc-200 focus:border-amber-500 outline-none transition-colors" style={{ fontFamily: "Fragment Mono, monospace" }} />
                  <button onClick={() => setProducedCount(prev => Math.min(produceTarget * 2, prev + 1))} className="w-14 h-14 rounded-xl border-2 border-amber-300 bg-amber-50 text-2xl font-bold text-amber-600 hover:bg-amber-100 hover:border-amber-400 transition-all active:scale-95">+</button>
                </div>
                <div className="flex justify-center gap-2 mb-5">
                  {[1, 5, 10, 25].map(n => (
                    <button key={n} onClick={() => setProducedCount(prev => Math.min(produceTarget * 2, prev + n))} className="rounded-lg bg-zinc-100 border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-200 transition-all">+{n}</button>
                  ))}
                </div>
                <div className="mb-3">
                  <div className="h-3 bg-zinc-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${producedCount >= produceTarget ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${Math.min(100, (producedCount / Math.max(produceTarget, 1)) * 100)}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">{producedCount} assembled</span>
                  {producedCount >= produceTarget ? (
                    <span className="font-semibold text-emerald-600">Target reached!</span>
                  ) : (
                    <span className="text-zinc-400">{produceTarget - producedCount} more to go</span>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="rounded-2xl border border-zinc-200 bg-white py-4 px-6 text-base font-medium text-zinc-700 hover:bg-zinc-50 transition-all">Back</button>
                <button onClick={() => { handleStartAssembly(); setStep(3); }} disabled={producedCount === 0} className="flex-1 rounded-2xl bg-amber-600 py-4 text-lg font-bold text-white hover:bg-amber-700 transition-all shadow-md active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed">
                  Proceed to QC
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 3b: QC & Complete ─── */}
          {step === 3 && selectedDOS && producedCount > 0 && activeTask && activeTask.status === "in_progress" && (
            (() => {
              const allChecked = Object.values(qcChecklist).every(Boolean);
              return (
                <div className="space-y-5">
                  <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6">
                    <h3 className="text-lg font-bold text-emerald-800 mb-4">Quality Check</h3>
                    <div className="space-y-3">
                      {[
                        { key: "correctProducts", label: "Correct products included" },
                        { key: "correctQty", label: "Correct quantity assembled" },
                        { key: "packagingComplete", label: "Packaging complete" },
                        { key: "labelAttached", label: "Label attached" },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={!!qcChecklist[key]} onChange={e => setQcChecklist(prev => ({ ...prev, [key]: e.target.checked }))} className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 w-5 h-5" />
                          <span className="text-base text-zinc-700 font-medium">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => { setActiveTask(at => at ? { ...at, status: "accepted" as const } : null); }} className="rounded-2xl border border-zinc-200 bg-white py-4 px-6 text-base font-medium text-zinc-700 hover:bg-zinc-50 transition-all">Back</button>
                    <button onClick={handleCompleteAssembly} disabled={!allChecked} className="flex-1 rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white hover:bg-emerald-700 transition-all shadow-md active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed">
                      Complete &amp; Save to Freezer
                    </button>
                  </div>
                </div>
              );
            })()
          )}

          {/* ─── Step 4: Done ─── */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                  <svg className="w-12 h-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h2 className="text-3xl font-bold text-zinc-900">Task Completed!</h2>
                <p className="text-base text-zinc-500 mt-2">Assembled product has been saved to your Freezer.</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Total Tasks</div>
                  <div className="text-3xl font-bold mt-2 text-zinc-900">{pastryDOS.length}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Pending</div>
                  <div className="text-3xl font-bold mt-2 text-amber-600">{pendingDOS.length}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Completed</div>
                  <div className="text-3xl font-bold mt-2 text-emerald-600">{doneDOS.length}</div>
                </div>
              </div>

              {doneDOS.length > 0 && (
                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                  <div className="bg-zinc-50 border-b border-zinc-100 px-6 py-4">
                    <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Completed Today</h3>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {doneDOS.map(task => {
                      const taskPromo = findPromo(task.product);
                      const taskTarget = taskPromo
                        ? taskPromo.items.reduce((s, i) => s + i.qty, 0) * task.qty
                        : task.qty;
                      const taskProduced = completedTasks.get(task.id) ?? taskTarget;
                      return (
                        <div key={task.id} className="flex items-center gap-5 px-6 py-5">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-base font-semibold text-zinc-900">{task.product}</div>
                            <div className="text-sm text-zinc-500 mt-0.5" style={{ fontFamily: "Fragment Mono, monospace" }}>{task.id}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-zinc-700" style={{ fontFamily: "Fragment Mono, monospace" }}>{taskProduced}/{taskTarget}</div>
                            <div className="text-sm text-zinc-500">pcs</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => { setStep(0); setSelectedDOS(null); }} className="flex-1 rounded-2xl border border-zinc-200 bg-white py-4 text-base font-medium text-zinc-700 hover:bg-zinc-50 transition-all">Back to Orders</button>
                {pendingDOS.length > 0 && (
                  <button onClick={() => { setSelectedDOS(null); setStep(0); }} className="flex-1 rounded-2xl bg-amber-600 py-4 text-base font-bold text-white hover:bg-amber-700 transition-all shadow-md">Next Task</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Assembly Tab ── */
  if (activeTab === "assembly") {
    const promoPackages = promosPackages.filter(p => p.status === "active");
    const promoNames = new Set(promoPackages.map(p => p.name));
    const decoRecipeNames = new Set(freezerItems.filter(i => i.producedBy === "deco" && i.status === "stored" && i.qty > 0).map(i => i.productName));
    const normalProducts = productCatalog.filter(n => {
      if (promoNames.has(n)) return false;
      if (decoRecipeNames.has(n)) return true;
      const recipeForProduct = recipes.find(r => r.productName === n);
      return recipeForProduct?.linkedIngredients?.some(lp => decoRecipeNames.has(lp)) ?? false;
    });

    const handleBulkAssemble = (promo: PromoPackage, qty: number) => {
      const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
      const allAvailable = [...bakedProducts, ...decoProductionRecipes, ...advancedPremix];
      const canFulfill = promo.items.every(pi => {
        const available = allAvailable.filter(i => i.productName === pi.productName).reduce((s, i) => s + i.qty, 0);
        return available >= pi.qty * qty;
      });
      if (!canFulfill) { alert("Not enough stock in Baker/Deco freezers for all components."); return; }

      const componentDeductions: { item: FreezerItem; deduct: number }[] = [];
      promo.items.forEach(pi => {
        let needed = pi.qty * qty;
        const directItems = allAvailable.filter(i => i.productName === pi.productName && i.qty > 0);
        if (directItems.length > 0) {
          directItems.forEach(i => {
            if (needed <= 0) return;
            const take = Math.min(needed, i.qty);
            componentDeductions.push({ item: i, deduct: take });
            needed -= take;
          });
        } else {
          const recipeForProduct = recipes.find(r => r.productName === pi.productName);
          const linkedNames = recipeForProduct?.linkedIngredients ?? [];
          allAvailable.filter(i => linkedNames.includes(i.productName) && i.qty > 0).forEach(i => {
            if (needed <= 0) return;
            const take = Math.min(needed, i.qty);
            componentDeductions.push({ item: i, deduct: take });
            needed -= take;
          });
        }
      });

      const updatedFreezer = freezerItems.map(f => {
        const deduction = componentDeductions.find(d => d.item.id === f.id);
        return deduction ? { ...f, qty: f.qty - deduction.deduct } : f;
      });
      onUpdateFreezer?.(updatedFreezer);
      db.upsertFreezerItems(updatedFreezer.filter(f => componentDeductions.some(d => d.item.id === f.id))).catch(console.error);

      const assembledItem: FreezerItem = {
        id: `FRZ-${Date.now()}`,
        productName: `${promo.name} (${promo.type})`,
        qty,
        unit: "pcs",
        batchRef: `PASM-${Date.now()}`,
        producedBy: "pastry",
        dateProduced: today,
        status: "stored",
        notes: `Assembled ${promo.type} - ${promo.name}`,
      };
      onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, assembledItem]);
      db.upsertFreezerItems([assembledItem]).catch(console.error);

      const historyEntry: FreezerHistory = {
        id: `FRZH-${Date.now()}`,
        productName: assembledItem.productName,
        producedBy: "pastry",
        qtyChanged: qty,
        action: "assembled",
        reference: promo.id,
        timestamp: new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" }),
      };
      db.insertFreezerHistory(historyEntry).catch(console.error);
      setAssembleQtys(prev => ({ ...prev, [promo.id]: "" }));
    };

    const handlePackageProduct = (productName: string, qty: number) => {
      const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
      const directItems = freezerItems.filter(i => i.productName === productName && i.status === "stored" && i.qty > 0);
      const recipeForProduct = recipes.find(r => r.productName === productName);
      const linkedNames = recipeForProduct?.linkedIngredients ?? [];
      const matchingItems = directItems.length > 0 ? directItems : freezerItems.filter(i => linkedNames.includes(i.productName) && i.status === "stored" && i.qty > 0);
      let needed = qty;
      const deductions: { item: FreezerItem; deduct: number }[] = [];
      matchingItems.forEach(i => {
        if (needed <= 0) return;
        const take = Math.min(needed, i.qty);
        deductions.push({ item: i, deduct: take });
        needed -= take;
      });
      if (needed > 0) { alert(`Not enough ${productName} in freezers. Available: ${qty - needed}, needed: ${qty}`); return; }

      const updatedFreezer = freezerItems.map(f => {
        const d = deductions.find(dd => dd.item.id === f.id);
        return d ? { ...f, qty: f.qty - d.deduct } : f;
      });
      onUpdateFreezer?.(updatedFreezer);
      db.upsertFreezerItems(updatedFreezer.filter(f => deductions.some(d => d.item.id === f.id))).catch(console.error);

      const packaged: FreezerItem = {
        id: `FRZ-${Date.now()}`,
        productName,
        qty,
        unit: "pcs",
        batchRef: `PKG-${Date.now()}`,
        producedBy: "pastry",
        dateProduced: today,
        status: "stored",
        notes: `Packaged - ${productName}`,
      };
      onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, packaged]);
      db.upsertFreezerItems([packaged]).catch(console.error);

      const historyEntry: FreezerHistory = {
        id: `FRZH-${Date.now()}`,
        productName,
        producedBy: "pastry",
        qtyChanged: qty,
        action: "packaged",
        reference: "",
        timestamp: new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" }),
      };
      db.insertFreezerHistory(historyEntry).catch(console.error);
      setAssembleQtys(prev => ({ ...prev, [`pkg-${productName}`]: "" }));
    };

    return (
      <div className="min-h-screen bg-zinc-50/50">
        <div className="max-w-5xl mx-auto space-y-6 p-6">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Assembly</h1>
            <p className="mt-1.5 text-base text-zinc-500">Assemble promo/package bundles or package normal products.</p>
          </div>

          <div className="relative max-w-md">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            <input value={assemblySearch} onChange={e => setAssemblySearch(e.target.value)} placeholder="Search products..." className="w-full rounded-xl border border-zinc-200 bg-white pl-12 pr-4 py-3.5 text-base focus:outline-none focus:border-zinc-400 transition-all" />
          </div>

          {/* Assemble — unified DOS products + promos/packages */}
          {pastryDOS.length > 0 && (() => {
            const decoRecipeItems = freezerItems.filter(i => i.producedBy === "deco" && i.status === "stored" && i.qty > 0);
            const pastryBakedQtyMap = new Map<string, number>();
            freezerItems.filter(i => i.producedBy === "pastry" && i.status === "stored" && i.qty > 0).forEach(i => {
              pastryBakedQtyMap.set(i.productName, (pastryBakedQtyMap.get(i.productName) || 0) + i.qty);
            });
            const allAvailable = [...bakedProducts, ...decoRecipeItems, ...advancedPremix];
            const totalAvail = (name: string) => {
              const direct = allAvailable.filter(i => i.productName === name).reduce((s, i) => s + i.qty, 0);
              if (direct > 0) return direct;
              const recipeForProduct = recipes.find(r => r.productName === name);
              if (recipeForProduct?.linkedIngredients?.length) {
                return allAvailable.filter(i => recipeForProduct.linkedIngredients!.includes(i.productName)).reduce((s, i) => s + i.qty, 0);
              }
              return 0;
            };
            return (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-3">Assemble</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pastryDOS
                    .filter(d => !assemblySearch || d.product.toLowerCase().includes(assemblySearch.toLowerCase()))
                    .map(dos => {
                      const promo = findPromo(dos.product);
                      const isPromoOrPkg = promo && (promo.type === "promo" || promo.type === "package");
                      const done = pastryBakedQtyMap.get(dos.product) || 0;
                      const left = dos.qty - done;
                      const assembleQty = Number(assembleQtys[dos.id] ?? "1") || 0;

                      if (isPromoOrPkg && promo) {
                        const maxQty = promo.items.length > 0 ? Math.min(...promo.items.map(pi => Math.floor(totalAvail(pi.productName) / pi.qty))) : 0;
                        return (
                          <div key={dos.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm flex flex-col">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="text-base font-bold text-zinc-900">{dos.product}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700 uppercase">{promo.type}</span>
                                  <span className="text-xs text-zinc-400">Need {dos.qty} | Done {done} | Left <span className={left > 0 ? "text-amber-600" : "text-emerald-600"}>{Math.max(0, left)}</span></span>
                                </div>
                              </div>
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${maxQty > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                                {maxQty > 0 ? `Up to ${maxQty}` : "No stock"}
                              </span>
                            </div>
                            <div className="space-y-1.5 mb-4 flex-1">
                              {promo.items.map((item, idx) => {
                                const avail = totalAvail(item.productName);
                                const hasEnough = avail >= item.qty * Math.max(1, assembleQty);
                                return (
                                  <div key={idx} className="flex items-center justify-between text-sm">
                                    <span className="text-zinc-600">{item.productName} x{item.qty}</span>
                                    <span className={`font-medium ${hasEnough ? "text-emerald-600" : "text-red-500"}`}>{avail} avail</span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="number" min={1} max={maxQty} value={assembleQtys[dos.id] ?? "1"}
                                onChange={e => setAssembleQtys(prev => ({ ...prev, [dos.id]: e.target.value }))}
                                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-center outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-200" />
                              <button onClick={() => handleBulkAssemble(promo, assembleQty)}
                                disabled={maxQty <= 0 || assembleQty <= 0}
                                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors">Assemble</button>
                            </div>
                          </div>
                        );
                      }

                      // Normal product — assemble from Deco recipes
                      const matchedRecipes = recipes.filter(r => r.productName === dos.product || r.linkedIngredients?.includes(dos.product));
                      const allRecipeNames = matchedRecipes.map(r => r.productName);
                      const allRecipeLinked = [...new Set(matchedRecipes.flatMap(r => r.linkedIngredients ?? []))];
                      const matchingRecipes = decoRecipeItems.filter(p =>
                        allRecipeNames.includes(p.productName) ||
                        allRecipeLinked.includes(p.productName) ||
                        p.productName === dos.product
                      );
                      const recipesByProduct = new Map<string, number>();
                      matchingRecipes.forEach(p => recipesByProduct.set(p.productName, (recipesByProduct.get(p.productName) || 0) + p.qty));
                      const minRecipeQty = recipesByProduct.size > 0 ? Math.min(...recipesByProduct.values()) : 0;
                      const maxAssemble = Math.min(left, minRecipeQty);
                      return (
                        <div key={dos.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm flex flex-col">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="text-base font-bold text-zinc-900">{dos.product}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-zinc-400">Recipe: {allRecipeNames.length > 0 ? allRecipeNames.join(", ") : dos.product}</span>
                              </div>
                            </div>
                            {matchingRecipes.length > 0 ? (
                              <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Ready</span>
                            ) : (
                              <span className="shrink-0 rounded-full bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-400">No recipe</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-zinc-500 mb-4">
                            <span>Need <strong className="text-zinc-700">{dos.qty}</strong></span>
                            <span className="text-zinc-200">|</span>
                            <span>Done <strong className="text-zinc-700">{done}</strong></span>
                            <span className="text-zinc-200">|</span>
                            <span>Left <strong className={left > 0 ? "text-amber-600" : "text-emerald-600"}>{Math.max(0, left)}</strong></span>
                          </div>
                          <div className="flex items-center gap-2 mt-auto">
                            <input type="number" min={1} max={maxAssemble} value={assembleQtys[dos.id] ?? "1"}
                              onChange={e => setAssembleQtys(prev => ({ ...prev, [dos.id]: e.target.value }))}
                              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-center outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-200" />
                            <button onClick={() => {
                              const qty = Number(assembleQtys[dos.id] ?? "1") || 0;
                              if (qty <= 0) return;
                              const uniqueProducts = [...new Set(matchingRecipes.map(p => p.productName))];
                              const targets = uniqueProducts
                                .map(name => matchingRecipes.find(p => p.productName === name && p.qty >= qty))
                                .filter(Boolean) as FreezerItem[];
                              if (targets.length === 0) { alert("No recipe stock left."); return; }
                              if (targets.length !== uniqueProducts.length) { alert("Not all required recipes have enough stock."); return; }

                              const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
                              const updatedFreezer = freezerItems.map(f =>
                                targets.some(t => t.id === f.id) ? { ...f, qty: Math.max(0, f.qty - qty) } : f
                              );
                              onUpdateFreezer?.(updatedFreezer);
                              db.upsertFreezerItems(updatedFreezer.filter(f => targets.some(t => t.id === f.id))).catch(console.error);

                              const assembledItem: FreezerItem = {
                                id: `FRZ-${Date.now()}`,
                                productName: dos.product,
                                qty,
                                unit: "pcs",
                                batchRef: `PASM-${Date.now()}`,
                                producedBy: "pastry",
                                dateProduced: today,
                                status: "stored",
                                notes: "Production Recipe (Assembled)",
                              };
                              onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, assembledItem]);
                              db.upsertFreezerItems([assembledItem]).catch(console.error);

                              const batchRefs = targets.map(t => t.batchRef).filter(Boolean).join(", ");
                              const task: PastryAssemblyTask = {
                                id: crypto.randomUUID?.() ?? `PASM-${Date.now()}`,
                                dosId: dos.id,
                                productName: dos.product,
                                promoType: "normal",
                                components: targets.map(t => ({ productName: t.productName, qty, sourceFreezerId: t.id })),
                                targetQty: dos.qty,
                                assembledQty: qty,
                                status: "completed",
                                assembledBy: "pastry",
                                qcChecklist: {},
                                notes: `Assembled from ${batchRefs}`,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                              };
                              db.savePastryAssemblyTask(task).catch(console.error);
                              setAssemblyTasks(prev => [task, ...prev]);
                              setAssembleQtys(prev => ({ ...prev, [dos.id]: "" }));
                            }}
                              disabled={left <= 0 || !(Number(assembleQtys[dos.id] ?? "1") > 0) || matchingRecipes.every(p => p.qty <= 0)}
                              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors">Assemble</button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })()}

          {/* Normal Product Packaging */}
          {normalProducts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-3">Package Normal Products</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {normalProducts
                  .filter(name => !assemblySearch || name.toLowerCase().includes(assemblySearch.toLowerCase()))
                  .map(name => {
                    const directAvail = freezerItems.filter(i => i.productName === name && i.status === "stored" && i.qty > 0).reduce((s, i) => s + i.qty, 0);
                    const recipeForProduct = recipes.find(r => r.productName === name);
                    const linkedNames = recipeForProduct?.linkedIngredients ?? [];
                    const linkedAvail = linkedNames.length > 0 ? freezerItems.filter(i => linkedNames.includes(i.productName) && i.status === "stored" && i.qty > 0).reduce((s, i) => s + i.qty, 0) : 0;
                    const avail = directAvail > 0 ? directAvail : linkedAvail;
                    const pkgQty = Number(assembleQtys[`pkg-${name}`] ?? "1") || 0;
                    return (
                      <div key={name} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm flex flex-col">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-base font-bold text-zinc-900">{name}</h3>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${avail > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{avail} avail</span>
                        </div>
                        <div className="flex items-center gap-2 mt-auto">
                          <input type="number" min={1} max={avail} value={assembleQtys[`pkg-${name}`] ?? "1"}
                            onChange={e => setAssembleQtys(prev => ({ ...prev, [`pkg-${name}`]: e.target.value }))}
                            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-center outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-200" />
                          <button onClick={() => handlePackageProduct(name, pkgQty)}
                            disabled={avail <= 0 || pkgQty <= 0}
                            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors">Package</button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Deco Production Recipes */}
          {(() => {
            const decoRecipeItems = freezerItems.filter(i => i.producedBy === "deco" && i.status === "stored" && i.qty > 0);
            const pastryDOSProducts = [...new Set(pastryDOS.map(d => d.product))];
            const recipeMatchesDOS = new Set<string>();
            pastryDOSProducts.forEach(dosProd => {
              const matchedRecipes = recipes.filter(r => r.productName === dosProd || r.linkedIngredients?.includes(dosProd));
              const allRecipeNames = matchedRecipes.map(r => r.productName);
              const allRecipeLinked = [...new Set(matchedRecipes.flatMap(r => r.linkedIngredients ?? []))];
              decoRecipeItems.forEach(item => {
                if (allRecipeNames.includes(item.productName) || allRecipeLinked.includes(item.productName) || item.productName === dosProd) {
                  recipeMatchesDOS.add(item.productName);
                }
              });
            });
            if (decoRecipeItems.length === 0) return null;
            return (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-3">Recipes from Deco</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[...new Set(decoRecipeItems.map(p => p.productName))]
                    .filter(n => !assemblySearch || n.toLowerCase().includes(assemblySearch.toLowerCase()))
                    .map(name => {
                      const items = decoRecipeItems.filter(p => p.productName === name);
                      const total = items.reduce((s, p) => s + p.qty, 0);
                      const isRelevant = recipeMatchesDOS.has(name);
                      return (
                        <div key={name} className={`rounded-2xl border shadow-sm flex flex-col overflow-hidden ${isRelevant ? "border-zinc-200 bg-white" : "border-dashed border-zinc-300 bg-zinc-50/30"}`}>
                          <div className="px-4 pt-4 pb-3 border-b border-zinc-100">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-semibold text-zinc-900 leading-tight">{name}</h3>
                                {!isRelevant && (
                                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[9px] font-medium text-zinc-500">No DOS match</span>
                                )}
                              </div>
                              <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">{total} batch{total !== 1 ? "es" : ""}</span>
                            </div>
                          </div>
                          <div className="px-4 py-3 bg-zinc-50/50">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Total Qty</span>
                              <span className="text-2xl font-bold text-zinc-800">{total}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })()}

          {/* Assembly History */}
          {assemblyTasks.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <h2 className="text-lg font-semibold">Assembly History</h2>
                <span className="text-sm text-zinc-400">{assemblyTasks.filter(t => t.status === "completed").length} completed</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 border-b border-zinc-100">
                    <tr className="text-xs uppercase tracking-wider text-zinc-500">
                      <th className="px-6 py-3">Product</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3 text-right">Qty</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {assemblyTasks.map(t => (
                      <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-zinc-900">{t.productName}</td>
                        <td className="px-6 py-4"><span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700 uppercase">{t.promoType}</span></td>
                        <td className="px-6 py-4 text-sm text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{t.assembledQty}/{t.targetQty}</td>
                        <td className="px-6 py-4"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${t.status === "completed" ? "bg-emerald-100 text-emerald-700" : t.status === "in_progress" ? "bg-amber-100 text-amber-700" : t.status === "accepted" ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-500"}`}>{t.status}</span></td>
                        <td className="px-6 py-4 text-xs text-zinc-500">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => { if (confirm("Delete this assembly task?")) { db.deletePastryAssemblyTask(t.id).then(() => setAssemblyTasks(prev => prev.filter(x => x.id !== t.id))).catch(alert); } }} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Freezer Tab ── */
  if (activeTab === "freezer") {
    const pastryItems = freezerItems.filter(i => i.producedBy === "pastry" && i.status === "stored");
    const assembledItems = pastryItems.filter(i => i.notes?.toLowerCase().includes("assembled") || i.notes?.toLowerCase().includes("packaged"));
    const componentItems = [...freezerItems.filter(i => i.producedBy === "baker" && i.status === "stored" && i.qty > 0), ...freezerItems.filter(i => i.producedBy === "deco" && i.status === "stored" && i.qty > 0)];
    const pastryAccessInventory = inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("pastry"));

    const tabItems = freezerTab === "assembled" ? assembledItems : freezerTab === "components" ? componentItems : [];
    const filtered = tabItems.filter(i => !freezerSearch || i.productName.toLowerCase().includes(freezerSearch.toLowerCase()));

    const handleAdd = () => {
      if (!newProduct.trim() || !newQty) return;
      const item: FreezerItem = {
        id: `FRZ-${Date.now()}`,
        productName: newProduct.trim(),
        qty: Number(newQty),
        unit: newUnit,
        batchRef: newBatch.trim(),
        producedBy: "pastry",
        dateProduced: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0],
        status: "stored",
        notes: newNotes.trim(),
      };
      onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, item]);
      db.upsertFreezerItems([item]).catch(console.error);
      setShowAddFreezer(false);
      setNewProduct(""); setNewQty(""); setNewBatch(""); setNewNotes("");
    };

    return (
      <div className="min-h-screen bg-zinc-50/50">
        <div className="max-w-5xl mx-auto space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Freezer</h1>
              <p className="mt-1.5 text-base text-zinc-500">Your assembled packages and component stock.</p>
            </div>
            <button onClick={() => setShowAddFreezer(true)} className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 transition-all">+ Add Product</button>
          </div>

          <div className="flex gap-2 rounded-xl bg-zinc-100 p-1.5">
            <button onClick={() => setFreezerTab("assembled")} className={`flex-1 rounded-lg py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${freezerTab === "assembled" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>Assembled Packages <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-700">{assembledItems.length}</span></button>
            <button onClick={() => setFreezerTab("components")} className={`flex-1 rounded-lg py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${freezerTab === "components" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>Component Stock <span className="rounded-full bg-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-700">{componentItems.length}</span></button>
            <button onClick={() => setFreezerTab("my-inventory")} className={`flex-1 rounded-lg py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${freezerTab === "my-inventory" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>My Inventory <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">{pastryAccessInventory.length}</span></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">{freezerTab === "my-inventory" ? "Ingredients" : freezerTab === "components" ? "Components" : "Products"}</div>
              <div className="text-3xl font-bold mt-2 text-zinc-900">{freezerTab === "my-inventory" ? pastryAccessInventory.length : tabItems.length}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">{freezerTab === "my-inventory" ? "Total Stock" : "Total Qty"}</div>
              <div className="text-3xl font-bold mt-2 text-zinc-900">{freezerTab === "my-inventory" ? pastryAccessInventory.reduce((s, i) => s + i.onHand, 0) : tabItems.reduce((s, i) => s + i.qty, 0)} <span className="text-base font-normal text-zinc-500">{freezerTab === "my-inventory" ? (pastryAccessInventory[0]?.unit || "pcs") : "pcs"}</span></div>
            </div>
          </div>

          <div className="relative max-w-md">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            <input value={freezerSearch} onChange={e => setFreezerSearch(e.target.value)} placeholder="Search products..." className="w-full rounded-xl border border-zinc-200 bg-white pl-12 pr-4 py-3.5 text-base focus:outline-none focus:border-zinc-400 transition-all" />
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
                    {freezerTab === "my-inventory" ? (
                      <>
                        <th className="px-6 py-4">Ingredient</th>
                        <th className="px-6 py-4 text-right">On Hand</th>
                        <th className="px-6 py-4">Unit</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Supplier</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-4">Product</th>
                        <th className="px-6 py-4 text-right">Qty</th>
                        <th className="px-6 py-4">Batch</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4 text-center">Source</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {freezerTab === "my-inventory" ? (
                    pastryAccessInventory.filter(i => !freezerSearch || i.name.toLowerCase().includes(freezerSearch.toLowerCase())).length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-16 text-center text-base text-zinc-400">No ingredients assigned to Pastry.</td></tr>
                    ) : pastryAccessInventory.filter(i => !freezerSearch || i.name.toLowerCase().includes(freezerSearch.toLowerCase())).map(item => (
                      <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-5 text-base font-medium text-zinc-900">{item.name}</td>
                        <td className="px-6 py-5 text-base text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.onHand}</td>
                        <td className="px-6 py-5 text-sm text-zinc-600">{item.unit}</td>
                        <td className="px-6 py-5 text-sm text-zinc-500 capitalize">{item.category}</td>
                        <td className="px-6 py-5 text-sm text-zinc-500">{item.supplier || "\u2014"}</td>
                      </tr>
                    ))
                  ) : freezerTab === "components" ? (
                    (() => {
                      const grouped = new Map<string, { items: FreezerItem[]; totalQty: number }>();
                      (filtered as FreezerItem[]).forEach(f => {
                        if (!grouped.has(f.productName)) grouped.set(f.productName, { items: [], totalQty: 0 });
                        const g = grouped.get(f.productName)!;
                        g.items.push(f);
                        g.totalQty += f.qty;
                      });
                      return grouped.size === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-16 text-center text-base text-zinc-400">No component stock available.</td></tr>
                      ) : [...grouped.entries()].map(([productName, g]) => (
                        <tr key={productName} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-6 py-5 text-base font-medium text-zinc-900">{productName}</td>
                          <td className="px-6 py-5 text-base text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{g.totalQty} pcs</td>
                          <td className="px-6 py-5 text-sm text-zinc-600">{g.items.length} batch{g.items.length > 1 ? "es" : ""}</td>
                          <td className="px-6 py-5 text-sm text-zinc-500">{g.items[0]?.dateProduced || "\u2014"}</td>
                          <td className="px-6 py-5 text-center">
                            {g.items.some(i => i.producedBy === "baker") && <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-medium mr-1">Baker</span>}
                            {g.items.some(i => i.producedBy === "deco") && <span className="inline-flex items-center rounded-full bg-rose-50 text-rose-700 px-2 py-0.5 text-xs font-medium">Deco</span>}
                          </td>
                          <td className="px-6 py-5 text-right"><span className="text-xs text-zinc-400">View only</span></td>
                        </tr>
                      ));
                    })()
                  ) : (
                    filtered.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-16 text-center text-base text-zinc-400">No products in freezer.</td></tr>
                    ) : (() => {
                      const grouped = new Map<string, { items: FreezerItem[]; totalQty: number }>();
                      (filtered as FreezerItem[]).forEach(f => {
                        if (!grouped.has(f.productName)) grouped.set(f.productName, { items: [], totalQty: 0 });
                        const g = grouped.get(f.productName)!;
                        g.items.push(f);
                        g.totalQty += f.qty;
                      });
                      return [...grouped.entries()].map(([productName, g]) => (
                        <tr key={productName} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-6 py-5">
                            <div className="text-base font-medium text-zinc-900">{productName}</div>
                            {g.items[0]?.notes && <div className="text-sm text-zinc-400 mt-1">{g.items[0].notes}</div>}
                          </td>
                          <td className="px-6 py-5 text-base text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{g.totalQty} pcs</td>
                          <td className="px-6 py-5 text-sm text-zinc-600" style={{ fontFamily: "Fragment Mono, monospace" }}>{g.items.length} batch{g.items.length > 1 ? "es" : ""}</td>
                          <td className="px-6 py-5 text-sm text-zinc-500">{g.items[0]?.dateProduced || "\u2014"}</td>
                          <td className="px-6 py-5 text-center"><span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-medium">Pastry</span></td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => { setEditingFreezerItem(g.items[0]); setShowEditFreezer(true); }} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-all">Edit</button>
                              <button onClick={() => { if (confirm(`Delete ALL batches of ${productName}?`)) { const ids = new Set(g.items.map(x => x.id)); const updated = freezerItems.filter(f => !ids.has(f.id)); onUpdateFreezer?.(updated); ids.forEach(id => db.deleteFreezerItem(id).catch(console.error)); } }} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-all">Del</button>
                            </div>
                          </td>
                        </tr>
                      ));
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {freezerHistory.filter(h => h.producedBy === "pastry").length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Assembly History</h2>
              <div className="space-y-2">
                {freezerHistory.filter(h => h.producedBy === "pastry").slice(0, 20).map(h => (
                  <div key={h.id} className="flex items-center gap-4 rounded-xl border border-zinc-100 bg-zinc-50/60 px-5 py-4">
                    <span className="rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-xs font-medium">{h.action}</span>
                    <span className="text-base font-medium text-zinc-900">{h.productName}</span>
                    <span className="text-sm text-zinc-600" style={{ fontFamily: "Fragment Mono, monospace" }}>{h.qtyChanged} pcs</span>
                    <span className="text-sm text-zinc-400">{h.reference}</span>
                    <span className="ml-auto text-sm text-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }}>{h.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showAddFreezer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddFreezer(false)}>
              <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-6">Add to Freezer</h2>
                <div className="space-y-4">
                  <div><label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 block">Product</label>
                    <select value={newProduct} onChange={e => setNewProduct(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base outline-none focus:border-zinc-400 transition-all">
                      <option value="">Select product...</option>
                      {[...new Set([...bakedProducts, ...decoProductionRecipes].map(i => i.productName))].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 block">Quantity</label><input type="number" min="1" value={newQty} onChange={e => setNewQty(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base outline-none focus:border-zinc-400 transition-all" /></div>
                    <div><label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 block">Unit</label>
                      <select value={newUnit} onChange={e => setNewUnit(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base outline-none focus:border-zinc-400 transition-all">
                        <option value="pcs">pcs</option><option value="packs">packs</option><option value="boxes">boxes</option><option value="kg">kg</option>
                      </select>
                    </div>
                  </div>
                  <div><label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 block">Batch Ref</label><input value={newBatch} onChange={e => setNewBatch(e.target.value)} placeholder="e.g. BATCH-001" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base outline-none focus:border-zinc-400 transition-all" /></div>
                  <div><label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 block">Notes</label><input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Optional" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base outline-none focus:border-zinc-400 transition-all" /></div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowAddFreezer(false)} className="flex-1 rounded-xl border border-zinc-200 py-3 text-base font-medium text-zinc-600 hover:bg-zinc-50 transition-all">Cancel</button>
                  <button onClick={handleAdd} className="flex-1 rounded-xl bg-zinc-900 py-3 text-base font-medium text-white hover:bg-zinc-800 transition-all">Add to Freezer</button>
                </div>
              </div>
            </div>
          )}

          {showEditFreezer && editingFreezerItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowEditFreezer(false)}>
              <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-6">Edit Product</h2>
                <div className="space-y-4">
                  <div><label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 block">Product</label>
                    <select value={editingFreezerItem.productName} onChange={e => setEditingFreezerItem({ ...editingFreezerItem, productName: e.target.value })} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base outline-none focus:border-zinc-400 transition-all">
                      {[...new Set([...bakedProducts, ...decoProductionRecipes].map(i => i.productName))].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 block">Quantity</label><input type="number" min="1" value={editingFreezerItem.qty} onChange={e => setEditingFreezerItem({ ...editingFreezerItem, qty: Number(e.target.value) || 1 })} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base outline-none focus:border-zinc-400 transition-all" /></div>
                    <div><label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 block">Unit</label>
                      <select value={editingFreezerItem.unit} onChange={e => setEditingFreezerItem({ ...editingFreezerItem, unit: e.target.value })} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base outline-none focus:border-zinc-400 transition-all">
                        <option value="pcs">pcs</option><option value="packs">packs</option><option value="boxes">boxes</option><option value="kg">kg</option>
                      </select>
                    </div>
                  </div>
                  <div><label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 block">Batch Ref</label><input value={editingFreezerItem.batchRef} onChange={e => setEditingFreezerItem({ ...editingFreezerItem, batchRef: e.target.value })} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base outline-none focus:border-zinc-400 transition-all" /></div>
                  <div><label className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 block">Notes</label><input value={editingFreezerItem.notes || ""} onChange={e => setEditingFreezerItem({ ...editingFreezerItem, notes: e.target.value })} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base outline-none focus:border-zinc-400 transition-all" /></div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowEditFreezer(false)} className="flex-1 rounded-xl border border-zinc-200 py-3 text-base font-medium text-zinc-600 hover:bg-zinc-50 transition-all">Cancel</button>
                  <button onClick={() => {
                    const updated = freezerItems.map(f => f.id === editingFreezerItem.id ? editingFreezerItem : f);
                    onUpdateFreezer?.(updated);
                    db.upsertFreezerItems(updated.filter(f => f.id === editingFreezerItem.id)).catch(console.error);
                    setShowEditFreezer(false);
                  }} className="flex-1 rounded-xl bg-zinc-900 py-3 text-base font-medium text-white hover:bg-zinc-800 transition-all">Save Changes</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Promos Tab (READ-ONLY) ── */
  if (activeTab === "promos") {
    const fmtDate = (d?: string) => {
      if (!d) return null;
      const [y, m, day] = d.split("-");
      return `${day}/${m}/${y}`;
    };
    const today = new Date().toISOString().slice(0, 10);
    const isDateValid = (p: PromoPackage) => {
      if (p.startDate && today < p.startDate) return false;
      if (p.endDate && today > p.endDate) return false;
      return true;
    };
    const activePromos = promosPackages.filter(p => p.status === "active" && isDateValid(p));
    const dateOutOfRange = promosPackages.filter(p => p.status === "active" && !isDateValid(p));
    const inactivePromos = promosPackages.filter(p => p.status !== "active");

    const renderPromoCard = (promo: PromoPackage, displayStatus: string, opacityClass: string = "") => {
      const isPromo = promo.type === "promo";
      const savings = promo.originalPrice > 0 && promo.promoPrice > 0 ? Math.round(((promo.originalPrice - promo.promoPrice) / promo.originalPrice) * 100) : 0;
      return (
        <div key={promo.id} className={`group rounded-2xl bg-white shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border ${isPromo ? "border-amber-100" : "border-blue-100"} ${opacityClass}`}>
          <div className={`relative px-6 pt-5 pb-4 ${isPromo ? "bg-gradient-to-br from-amber-50 via-amber-50/80 to-orange-50" : "bg-gradient-to-br from-blue-50 via-blue-50/80 to-indigo-50"}`}>
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-[60px] opacity-[0.07] ${isPromo ? "bg-amber-600" : "bg-blue-600"}`} />
            <div className="flex items-start justify-between mb-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${isPromo ? "bg-amber-200/70 text-amber-800" : "bg-blue-200/70 text-blue-800"}`}>
                {promo.type}
              </span>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${displayStatus === "active" ? "bg-emerald-100 text-emerald-700" : displayStatus === "not started" ? "bg-amber-100 text-amber-700" : displayStatus === "inactive" ? "bg-zinc-100 text-zinc-500" : "bg-red-100 text-red-700"}`}>{displayStatus}</span>
            </div>
            <h3 className="text-xl font-bold text-zinc-900 tracking-tight">{promo.name}</h3>
            {promo.description && <p className="text-sm text-zinc-500 mt-1.5 line-clamp-2 leading-relaxed">{promo.description}</p>}
          </div>

          <div className="px-6 py-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Includes</span>
              <div className="flex-1 h-px bg-zinc-100" />
            </div>
            <div className="space-y-3 mb-5">
              {promo.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-base">
                  <span className="text-zinc-700 font-medium">{item.productName}</span>
                  <span className="inline-flex items-center justify-center min-w-[36px] rounded-lg bg-zinc-100 px-2 py-1 text-sm font-bold text-zinc-600">x{item.qty}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-100 pt-4">
              <div className="flex items-end justify-between mb-1">
                <div>
                  <div className="flex items-baseline gap-2">
                    {promo.originalPrice > 0 && <span className="text-base text-zinc-400 line-through">{"\u20B1"}{promo.originalPrice.toFixed(2)}</span>}
                    {promo.promoPrice > 0 && <span className="text-2xl font-extrabold text-zinc-900 tracking-tight">{"\u20B1"}{promo.promoPrice.toFixed(2)}</span>}
                  </div>
                  {savings > 0 && <span className="inline-flex items-center mt-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-600">Save {savings}%</span>}
                </div>
                {(promo.startDate || promo.endDate) && (
                  <div className="text-right">
                    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">Valid</div>
                    <div className="text-sm text-zinc-600 font-medium">
                      {fmtDate(promo.startDate) || "\u2014"} {"\u2013"} {fmtDate(promo.endDate) || "\u2014"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="min-h-screen bg-zinc-50/50">
        <div className="max-w-5xl mx-auto space-y-8 p-6">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Promos &amp; Packages</h1>
            <p className="mt-1.5 text-base text-zinc-500">View active promos and package deals for assembly.</p>
          </div>

          {promosPackages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-16 text-center">
              <div className="w-20 h-20 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-5">
                <svg className="w-10 h-10 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>
              </div>
              <p className="text-lg font-medium text-zinc-600">No promos or packages yet</p>
              <p className="text-sm text-zinc-400 mt-2">Promos created by admin will appear here.</p>
            </div>
          ) : (
            <div className="space-y-10">
              {activePromos.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-zinc-800 mb-5">Currently Active</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {activePromos.map(promo => renderPromoCard(promo, "active"))}
                  </div>
                </div>
              )}

              {dateOutOfRange.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-amber-700 mb-5">Upcoming / Expired Dates</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {dateOutOfRange.map(promo => {
                      const isUpcoming = promo.startDate && today < promo.startDate;
                      return renderPromoCard(promo, isUpcoming ? "not started" : "expired", "opacity-75");
                    })}
                  </div>
                </div>
              )}

              {inactivePromos.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-zinc-800 mb-5">Inactive</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {inactivePromos.map(promo => renderPromoCard(promo, promo.status, "opacity-50"))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

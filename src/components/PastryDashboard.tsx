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

  const [viewingPromo, setViewingPromo] = useState<PromoPackage | null>(null);
  const [showBakerFreezer, setShowBakerFreezer] = useState(false);
  const [bakerFreezerSearch, setBakerFreezerSearch] = useState("");
  const [promoSearch, setPromoSearch] = useState("");

  const [showDecoFreezer, setShowDecoFreezer] = useState(false);
  const [decoFreezerSearch, setDecoFreezerSearch] = useState("");
  const [decoFreezerTab, setDecoFreezerTab] = useState<"production-recipe" | "advanced-premix">("production-recipe");
  const [showMyInventory, setShowMyInventory] = useState(false);
  const [myInventorySearch, setMyInventorySearch] = useState("");
  const [selectedInventory, setSelectedInventory] = useState<Map<string, { item: InventoryItem; qty: number }>>(new Map());
  const [viewingRecipe, setViewingRecipe] = useState<ProductRecipe | null>(null);

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



  useEffect(() => {
    db.fetchPastryAssemblyTasks().then(setAssemblyTasks).catch(console.error);
  }, [activeTab]);

  // Auto-allocate products when entering Step 1 if stock is available
  useEffect(() => {
    if (step !== 1 || !selectedDOS) return;
    const need = getNeedPerProduct();
    const allStock = promo ? bakedProducts : [...decoProductionRecipes, ...advancedPremix];
    setSelectedFreezerItems(prev => {
      const next = new Map(prev);
      let changed = false;
      need.forEach((productNeed, productName) => {
        const alreadyAllocated = [...next.values()].filter(e => e.item.productName === productName).reduce((s, e) => s + e.qty, 0);
        if (alreadyAllocated >= productNeed) return;
        const stockItems = allStock.filter(i => i.productName === productName && i.qty > 0);
        const totalAvailable = stockItems.reduce((s, i) => s + i.qty, 0);
        const toAllocate = Math.min(productNeed, totalAvailable);
        if (toAllocate <= alreadyAllocated) return;
        let remaining = toAllocate - alreadyAllocated;
        for (const si of stockItems) {
          if (remaining <= 0) break;
          const existing = next.get(si.id);
          const existingQty = existing ? existing.qty : 0;
          const batchAvail = si.qty - existingQty;
          if (batchAvail <= 0) continue;
          const take = Math.min(remaining, batchAvail);
          if (existing) {
            next.set(si.id, { ...existing, qty: existingQty + take });
          } else {
            next.set(si.id, { item: si, qty: take });
          }
          remaining -= take;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [step, selectedDOS]);

  const pastryAccessInventory = inventory.filter(i => i.group === "pastry-inventory" || i.group === "ingredients");

  const todayStr = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
  const todayDOS = dosItems.filter(d => {
    if (d.status === "scheduled" && d.scheduledDate && d.scheduledDate > todayStr) return false;
    if (d.scheduledDate) return d.scheduledDate === todayStr;
    const ts = d.id.match(/DOS-(\d+)/)?.[1];
    if (!ts) return true;
    const itemDate = new Date(Number(ts)).toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    return itemDate === todayStr;
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
    return (<>
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
              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(() => {
                  const all = pastryDOS.length;
                  const pending = pendingDOS.length;
                  const inProgress = pastryDOS.filter(d => d.status === "in-progress").length;
                  const completed = doneDOS.length;
                  return [
                    { label: "Total Orders", value: all, color: "text-zinc-900", bg: "bg-white border-zinc-200" },
                    { label: "Pending", value: pending, color: "text-zinc-500", bg: "bg-zinc-50 border-zinc-200" },
                    { label: "In Progress", value: inProgress, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
                    { label: "Completed", value: completed, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
                  ].map((stat, i) => (
                    <div key={i} className={`rounded-2xl border ${stat.bg} p-4 text-center shadow-sm`}>
                      <div className={`text-2xl font-extrabold font-mono ${stat.color}`}>{stat.value}</div>
                      <div className="text-[10px] text-zinc-400 uppercase tracking-wider mt-1 font-semibold">{stat.label}</div>
                    </div>
                  ));
                })()}
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">Today's DOS</h2>
                    <p className="text-sm text-zinc-400 mt-0.5">Daily Order Schedule &mdash; {new Date().toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                  <span className="text-xs font-semibold text-zinc-400">{pastryDOS.length} order{pastryDOS.length !== 1 ? "s" : ""}</span>
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
                  <div className="space-y-3">
                    {(() => {
                      const grouped = new Map<string, { dos: typeof pastryDOS; totalQty: number }>();
                      pastryDOS.forEach(d => {
                        if (!grouped.has(d.product)) grouped.set(d.product, { dos: [], totalQty: 0 });
                        const g = grouped.get(d.product)!;
                        g.dos.push(d);
                        g.totalQty += d.qty;
                      });
                      return [...grouped.entries()].map(([productName, group]) => {
                        const allDone = group.dos.every(d => completedTasks.has(d.id) || d.status === "completed");
                        const someInProgress = group.dos.some(d => d.status === "in-progress" || completedTasks.has(d.id));
                        const groupStatus = allDone ? "completed" : someInProgress ? "in-progress" : "pending";
                        const p = findPromo(productName);
                        const isSelected = group.dos.some(d => d.id === selectedDOS?.id);
                        const totalQty = group.totalQty;
                        const totalDemand = group.dos.reduce((s, d) => s + (d.qty ?? 0), 0);
                        return (
                          <div key={productName} onClick={() => { if (!allDone) { setSelectedDOS(group.dos[0]); } }} className={`rounded-2xl border-2 p-5 transition-all ${
                            allDone
                              ? "border-emerald-100 bg-emerald-50/50"
                              : isSelected
                                ? "border-amber-400 bg-amber-50 shadow-lg ring-2 ring-amber-200"
                                : "border-zinc-100 bg-white hover:border-zinc-300 hover:shadow-md"
                          } ${!allDone ? "cursor-pointer" : ""}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[15px] font-bold text-zinc-900 truncate">{productName}</span>
                                  {p && (
                                    <button onClick={(e) => { e.stopPropagation(); setViewingPromo(p); }} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity ${p.type === "promo" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                                      {p.type}
                                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                                    </button>
                                  )}
                                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    groupStatus === "completed" ? "bg-emerald-100 text-emerald-700" :
                                    groupStatus === "in-progress" ? "bg-amber-100 text-amber-700" :
                                    "bg-zinc-100 text-zinc-500"
                                  }`}>
                                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                                      groupStatus === "completed" ? "bg-emerald-500" :
                                      groupStatus === "in-progress" ? "bg-amber-500 animate-pulse" :
                                      "bg-zinc-400"
                                    }`} />
                                    {groupStatus === "completed" ? "Completed" : groupStatus === "in-progress" ? "In Progress" : "Pending"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 mt-2.5">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Demand</span>
                                    <span className="text-[15px] font-bold text-zinc-900 font-mono">{totalDemand}<span className="text-[10px] font-medium text-zinc-400 ml-0.5">pcs</span></span>
                                  </div>
                                  <div className="w-px h-4 bg-zinc-200" />
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Orders</span>
                                    <span className="text-[15px] font-bold text-zinc-900 font-mono">{group.dos.length}</span>
                                  </div>
                                  <div className="w-px h-4 bg-zinc-200" />
                                  <span className="text-[10px] text-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }}>{group.dos[0].id}</span>
                                </div>

                                {/* Priority badges for individual DOS items */}
                                {group.dos.length > 1 && (
                                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                                    {group.dos.map(d => (
                                      <span key={d.id} className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                                        d.priority === "HIGH" ? "bg-red-50 text-red-600 border-red-200" :
                                        d.priority === "MEDIUM" ? "bg-amber-50 text-amber-600 border-amber-200" :
                                        "bg-zinc-50 text-zinc-500 border-zinc-200"
                                      }`}>
                                        {d.qty} pcs
                                        {completedTasks.has(d.id) && <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {p && (
                                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                                    {p.items.map((item, idx) => (
                                      <span key={idx} className="inline-flex items-center rounded-lg bg-zinc-100 border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600">
                                        {item.productName} x{item.qty * totalQty}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0 ml-4">
                                <div className="text-2xl font-extrabold text-zinc-900 font-mono">{totalDemand}</div>
                                <div className="text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">pcs</div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-zinc-400">{pendingDOS.length} pending &middot; {doneDOS.length} completed</span>
                  <span className="text-sm text-zinc-400">Total: <span className="font-semibold text-zinc-600 font-mono">{pastryDOS.reduce((s, d) => s + (d.qty ?? 0), 0)} pcs</span></span>
                </div>
                <button
                  onClick={() => { if (selectedDOS) setStep(1); }}
                  disabled={!selectedDOS}
                  className="w-full mt-4 rounded-2xl bg-amber-600 py-3.5 text-[15px] font-bold text-white hover:bg-amber-700 transition-all shadow-md active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-600"
                >
                  {selectedDOS ? `Continue with ${selectedDOS.product}` : "Select an order to continue"}
                </button>
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

              {promo ? (
                <>
                  <button onClick={() => setShowBakerFreezer(true)} className="w-full rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 py-3.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 hover:border-amber-400 transition-all flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                    View Baker Freezer — {bakedProducts.length} products available
                  </button>
                  <button onClick={() => setShowMyInventory(true)} className="w-full rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 py-3.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 transition-all flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3.75h4.5m-4.5 3.75h4.5M12 12v4.5m0-4.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9z" /></svg>
                    My Inventory — {pastryAccessInventory.length} ingredients available
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setShowDecoFreezer(true)} className="w-full rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50/50 py-3.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 hover:border-rose-400 transition-all flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg>
                    View Deco Freezer — {decoProductionRecipes.length + advancedPremix.length} products available
                  </button>
                  <button onClick={() => setShowMyInventory(true)} className="w-full rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 py-3.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 transition-all flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3.75h4.5m-4.5 3.75h4.5M12 12v4.5m0-4.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9z" /></svg>
                    My Inventory — {pastryAccessInventory.length} ingredients available
                  </button>
                </>
              )}

              {/* Order summary */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold text-zinc-900">{selectedDOS.product}</span>
                      <span className="text-xs text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{selectedDOS.id}</span>
                    </div>
                    {promo ? (
                      <div className="mt-3 space-y-2">
                        {promo.items.map((item, idx) => {
                          const totalNeeded = item.qty * (selectedDOS.qty ?? 1);
                          return (
                            <div key={idx} className="flex items-center justify-between bg-white rounded-xl border border-amber-200 px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700 shrink-0">{idx + 1}</span>
                                <span className="text-sm font-semibold text-zinc-800">{item.productName}</span>
                              </div>
                              <span className="text-sm font-bold text-amber-700">x{totalNeeded}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center gap-2 bg-white rounded-xl border border-amber-200 px-4 py-3">
                        <span className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700 shrink-0">1</span>
                        <span className="text-sm font-semibold text-zinc-800">{selectedDOS.product}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-6">
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

                const allStock = promo ? bakedProducts : [...decoProductionRecipes, ...advancedPremix];

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
                <button
                  onClick={() => setStep(2)}
                  disabled={(() => {
                    const need = getNeedPerProduct();
                    const allocated = getAllocatedPerProduct();
                    return [...need.entries()].some(([name, needed]) => (allocated.get(name) || 0) < needed);
                  })()}
                  className="flex-1 rounded-2xl bg-amber-600 py-4 text-lg font-bold text-white hover:bg-amber-700 transition-all shadow-md active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-600"
                >
                  {(() => {
                    const need = getNeedPerProduct();
                    const allocated = getAllocatedPerProduct();
                    const allFulfilled = [...need.entries()].every(([name, needed]) => (allocated.get(name) || 0) >= needed);
                    return allFulfilled ? "Continue" : "Allocate all products first";
                  })()}
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Production Planning & Review ─── */}
          {step === 2 && selectedDOS && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <button onClick={() => setStep(1)} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">Production Planning</h2>
                  <p className="mt-1 text-base text-zinc-500">Review order details before accepting.</p>
                </div>
              </div>

              {/* Order Summary Card */}
              <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-amber-50/80 to-orange-50 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Order Summary</span>
                </div>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-2xl font-extrabold text-zinc-900">{selectedDOS.product}</h3>
                      {promo && (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${promo.type === "promo" ? "bg-amber-200/70 text-amber-800" : "bg-blue-200/70 text-blue-800"}`}>{promo.type}</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1.5" style={{ fontFamily: "Fragment Mono, monospace" }}>{selectedDOS.id}</p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Target Qty</div>
                    <div className="text-4xl font-extrabold text-amber-700 mt-1 font-mono">{selectedDOS.qty}</div>
                    <div className="text-sm text-zinc-500">pieces</div>
                  </div>
                </div>
              </div>

              {/* Product Category */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Product Category</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(() => {
                    const categories = [
                      { label: "Pastry Products", active: !promo, icon: "🧁" },
                      { label: "Cake Components", active: false, icon: "🎂" },
                      { label: promo ? `${promo.type === "promo" ? "Promo" : "Package"} Inclusions` : "Package Inclusions", active: !!promo, icon: promo ? "📦" : "📦" },
                      { label: "Custom Orders", active: false, icon: "✨" },
                      { label: "Rush Orders", active: selectedDOS.priority === "HIGH", icon: "🚨" },
                    ];
                    return categories.map((cat, i) => (
                      <div key={i} className={`rounded-xl border px-4 py-3 text-center transition-all ${cat.active ? "border-amber-300 bg-amber-50" : "border-zinc-100 bg-zinc-50/50"}`}>
                        <div className="text-lg mb-1">{cat.icon}</div>
                        <div className={`text-xs font-semibold ${cat.active ? "text-amber-700" : "text-zinc-400"}`}>{cat.label}</div>
                        {cat.active && <div className="mt-1 inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">THIS ORDER</div>}
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Required Quantities — breakdown */}
              <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Required Quantities</span>
                </div>
                <div className="divide-y divide-zinc-100">
                  {promo ? promo.items.map((item, idx) => {
                    const totalNeeded = item.qty * (selectedDOS.qty ?? 1);
                    const stockSource = promo ? bakedProducts : [...decoProductionRecipes, ...advancedPremix];
                    const available = stockSource.filter(i => i.productName === item.productName).reduce((s, i) => s + i.qty, 0);
                    const hasEnough = available >= totalNeeded;
                    return (
                      <div key={idx} className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${hasEnough ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{idx + 1}</div>
                          <div>
                            <span className="text-sm font-semibold text-zinc-800">{item.productName}</span>
                            <div className="text-xs text-zinc-400 mt-0.5">{item.qty} per unit × {selectedDOS.qty} units</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-zinc-900 font-mono">{totalNeeded}</div>
                          <div className={`text-xs font-medium ${hasEnough ? "text-emerald-600" : "text-red-500"}`}>{available} avail</div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="flex items-center justify-between px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-emerald-100 text-emerald-700">1</div>
                        <div>
                          <span className="text-sm font-semibold text-zinc-800">{selectedDOS.product}</span>
                          <div className="text-xs text-zinc-400 mt-0.5">Single product order</div>
                        </div>
                      </div>
                      <div className="text-lg font-bold text-zinc-900 font-mono">{selectedDOS.qty}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Priority & Scheduling */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Priority & Schedule</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`rounded-xl border p-4 text-center ${selectedDOS.priority === "HIGH" ? "border-red-200 bg-red-50" : selectedDOS.priority === "MEDIUM" ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-zinc-50"}`}>
                    <div className="text-xs uppercase tracking-wider font-semibold text-zinc-400 mb-1">Priority</div>
                    <div className={`text-lg font-bold ${selectedDOS.priority === "HIGH" ? "text-red-700" : selectedDOS.priority === "MEDIUM" ? "text-amber-700" : "text-zinc-700"}`}>{selectedDOS.priority || "NORMAL"}</div>
                    {selectedDOS.priority === "HIGH" && <div className="mt-1 text-[10px] font-bold text-red-600 uppercase">⚡ Rush Order</div>}
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center">
                    <div className="text-xs uppercase tracking-wider font-semibold text-zinc-400 mb-1">Due</div>
                    <div className="text-lg font-bold text-zinc-700">{selectedDOS.scheduledDate || todayStr}</div>
                    <div className="text-[10px] text-zinc-400 mt-1">Today</div>
                  </div>
                </div>
              </div>

              {/* Production Queue Position */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Production Queue</span>
                </div>
                <div className="space-y-2">
                  {(() => {
                    const queue: { label: string; status: "done" | "current" | "pending"; desc: string }[] = [
                      { label: "Receive DOS from Admin", status: "done", desc: "Order received" },
                      { label: "Review & Plan Production", status: "current", desc: "Analyzing requirements" },
                      { label: "Check Freezer Availability", status: "pending", desc: "Step 1" },
                      { label: "Accept & Begin Assembly", status: "pending", desc: "Step 3" },
                      { label: "QC & Complete", status: "pending", desc: "Final check" },
                    ];
                    return queue.map((item, i) => (
                      <div key={i} className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${item.status === "current" ? "bg-amber-50 border border-amber-200" : item.status === "done" ? "bg-emerald-50/50" : "bg-zinc-50"}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${item.status === "done" ? "bg-emerald-500 text-white" : item.status === "current" ? "bg-amber-500 text-white animate-pulse" : "bg-zinc-200 text-zinc-500"}`}>
                          {item.status === "done" ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold ${item.status === "current" ? "text-amber-800" : item.status === "done" ? "text-emerald-700" : "text-zinc-500"}`}>{item.label}</div>
                          <div className="text-xs text-zinc-400">{item.desc}</div>
                        </div>
                        {item.status === "current" && <span className="shrink-0 rounded-full bg-amber-200 px-2.5 py-1 text-[10px] font-bold text-amber-800 uppercase">Current</span>}
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Notes & Special Instructions */}
              {(selectedDOS.notes || promo?.description) && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Notes & Special Instructions</span>
                  </div>
                  {selectedDOS.notes && (
                    <div className="rounded-xl bg-zinc-50 border border-zinc-100 px-4 py-3 mb-3">
                      <p className="text-sm text-zinc-700 leading-relaxed">{selectedDOS.notes}</p>
                    </div>
                  )}
                  {promo?.description && (
                    <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">Promo Description</div>
                      <p className="text-sm text-amber-800 leading-relaxed">{promo.description}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => setStep(1)} className="rounded-2xl border border-zinc-200 bg-white py-4 px-6 text-base font-medium text-zinc-700 hover:bg-zinc-50 transition-all">Back</button>
                <button
                  onClick={handleAcceptTask}
                  disabled={(() => {
                    const need = getNeedPerProduct();
                    const allocated = getAllocatedPerProduct();
                    return [...need.entries()].some(([name, needed]) => (allocated.get(name) || 0) < needed);
                  })()}
                  className="flex-1 rounded-2xl bg-amber-600 py-4 text-lg font-bold text-white hover:bg-amber-700 transition-all shadow-md active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-600"
                >
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

      {/* Promo/Package Detail Modal — accessible from DOS cards */}
      {viewingPromo && (() => {
        const p = viewingPromo;
        const isPromo = p.type === "promo";
        const savings = p.originalPrice > 0 && p.promoPrice > 0 ? Math.round(((p.originalPrice - p.promoPrice) / p.originalPrice) * 100) : 0;
        const fmtDateM = (d?: string) => { if (!d) return null; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setViewingPromo(null)}>
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className={`relative px-8 pt-7 pb-6 ${isPromo ? "bg-gradient-to-br from-amber-50 via-amber-50/80 to-orange-50" : "bg-gradient-to-br from-blue-50 via-blue-50/80 to-indigo-50"}`}>
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[80px] opacity-[0.06] ${isPromo ? "bg-amber-600" : "bg-blue-600"}`} />
                <button onClick={() => setViewingPromo(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${isPromo ? "bg-amber-200/70 text-amber-800" : "bg-blue-200/70 text-blue-800"}`}>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    {p.type}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${p.status === "active" ? "bg-emerald-100 text-emerald-700" : p.status === "inactive" ? "bg-zinc-100 text-zinc-500" : "bg-red-100 text-red-700"}`}>{p.status}</span>
                </div>
                <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight">{p.name}</h2>
                {p.description && <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{p.description}</p>}
              </div>
              <div className="px-8 py-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Included Items</span>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 border border-zinc-100 divide-y divide-zinc-100">
                    {p.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${isPromo ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{i + 1}</div>
                          <span className="text-sm font-medium text-zinc-800">{item.productName}</span>
                        </div>
                        <span className={`inline-flex items-center justify-center min-w-[40px] rounded-lg px-3 py-1.5 text-sm font-bold ${isPromo ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>x{item.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Pricing</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      {p.originalPrice > 0 && <p className="text-base text-zinc-400 line-through">{"\u20B1"}{p.originalPrice.toFixed(2)}</p>}
                      {p.promoPrice > 0 && <p className="text-3xl font-extrabold text-zinc-900 tracking-tight">{"\u20B1"}{p.promoPrice.toFixed(2)}</p>}
                    </div>
                    {savings > 0 && (
                      <div className="text-right">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">Save {savings}%</span>
                        <p className="text-xs text-emerald-600 mt-1 font-medium">{"\u20B1"}{(p.originalPrice - p.promoPrice).toFixed(2)} off</p>
                      </div>
                    )}
                  </div>
                </div>
                {(p.startDate || p.endDate) && (
                  <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Validity Period</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 rounded-xl bg-white border border-zinc-200 px-4 py-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Start</p>
                        <p className="text-sm font-semibold text-zinc-800">{fmtDateM(p.startDate) || "\u2014"}</p>
                      </div>
                      <svg className="w-5 h-5 text-zinc-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                      <div className="flex-1 rounded-xl bg-white border border-zinc-200 px-4 py-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">End</p>
                        <p className="text-sm font-semibold text-zinc-800">{fmtDateM(p.endDate) || "\u2014"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="px-8 pb-6">
                <button onClick={() => setViewingPromo(null)} className="w-full rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white py-3.5 text-sm font-semibold transition-colors">Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Baker Freezer Modal */}
      {showBakerFreezer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowBakerFreezer(false)}>
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-8 pt-7 pb-5 bg-gradient-to-br from-amber-50 via-amber-50/80 to-orange-50 border-b border-amber-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight">Baker Freezer</h2>
                  <p className="text-sm text-zinc-500 mt-1">Live baked products from the Baker account</p>
                </div>
                <button onClick={() => setShowBakerFreezer(false)} className="w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-200/70 px-3 py-1 text-xs font-bold text-amber-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {bakedProducts.length} products
                </span>
                <span className="text-xs text-zinc-400">Total: {bakedProducts.reduce((s, i) => s + i.qty, 0)} pcs</span>
                {selectedDOS && (() => {
                  const needMap = new Map<string, number>();
                  if (promo) {
                    promo.items.forEach(pi => needMap.set(pi.productName, (needMap.get(pi.productName) || 0) + pi.qty * (selectedDOS.qty ?? 1)));
                  } else {
                    needMap.set(selectedDOS.product, selectedDOS.qty ?? 1);
                  }
                  const neededCount = [...needMap.keys()].filter(n => bakedProducts.some(bp => bp.productName === n)).length;
                  return neededCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">{neededCount} needed highlighted</span>
                  ) : null;
                })()}
              </div>
            </div>
            <div className="px-6 pt-4 pb-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <input value={bakerFreezerSearch} onChange={e => setBakerFreezerSearch(e.target.value)} placeholder="Search baked products..." className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all" />
                {bakerFreezerSearch && <button onClick={() => setBakerFreezerSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {bakedProducts.length === 0 ? (
                <div className="px-8 py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                  </div>
                  <p className="text-base font-medium text-zinc-500">No baked products in freezer</p>
                  <p className="text-sm text-zinc-400 mt-1">Wait for Baker to produce items.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {(() => {
                    const grouped = new Map<string, { items: typeof bakedProducts; totalQty: number }>();
                    bakedProducts.forEach(item => {
                      if (!grouped.has(item.productName)) grouped.set(item.productName, { items: [], totalQty: 0 });
                      const g = grouped.get(item.productName)!;
                      g.items.push(item);
                      g.totalQty += item.qty;
                    });
                    return [...grouped.entries()].filter(([name]) => !bakerFreezerSearch || name.toLowerCase().includes(bakerFreezerSearch.toLowerCase())).map(([name, group]) => {
                      const needMap = new Map<string, number>();
                      if (selectedDOS) {
                        if (promo) {
                          promo.items.forEach(pi => needMap.set(pi.productName, (needMap.get(pi.productName) || 0) + pi.qty * (selectedDOS.qty ?? 1)));
                        } else {
                          needMap.set(selectedDOS.product, selectedDOS.qty ?? 1);
                        }
                      }
                      const needed = needMap.get(name) || 0;
                      const isNeeded = needed > 0;
                      const hasEnough = group.totalQty >= needed;
                      return (
                      <div key={name} className={`px-6 py-4 transition-all ${isNeeded ? "bg-amber-50/80 border-l-4 border-l-amber-400" : "hover:bg-zinc-50/50"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isNeeded ? "bg-amber-400" : "bg-amber-100"}`}>
                              <svg className={`w-5 h-5 ${isNeeded ? "text-white" : "text-amber-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <div className={`text-sm font-bold ${isNeeded ? "text-amber-900" : "text-zinc-900"}`}>{name}</div>
                                {isNeeded && <span className="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">NEEDED</span>}
                              </div>
                              <div className="text-xs text-zinc-400 mt-0.5">{group.items.length} batch{group.items.length > 1 ? "es" : ""}</div>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            {isNeeded && (
                              <div className="text-right">
                                <div className={`text-sm font-bold font-mono ${hasEnough ? "text-emerald-600" : "text-red-500"}`}>Need: {needed}</div>
                                <div className="text-[10px] text-zinc-400">required</div>
                              </div>
                            )}
                            <div>
                              <div className={`text-xl font-extrabold font-mono ${isNeeded ? "text-amber-900" : "text-zinc-900"}`}>{group.totalQty}</div>
                              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">pcs</div>
                            </div>
                          </div>
                        </div>
                        </div>
                      );
                    });
                  })()}
                  {bakerFreezerSearch && (() => {
                    const filtered = [...new Map(bakedProducts.map(item => [item.productName, item])).values()].filter(i => i.productName.toLowerCase().includes(bakerFreezerSearch.toLowerCase()));
                    return filtered.length === 0 && (
                      <div className="px-6 py-10 text-center">
                        <p className="text-sm text-zinc-500">No products matching "{bakerFreezerSearch}"</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            <div className="px-8 py-4 border-t border-zinc-100 bg-zinc-50/50">
              <button onClick={() => setShowBakerFreezer(false)} className="w-full rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white py-3 text-sm font-semibold transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Deco Freezer Modal */}
      {showDecoFreezer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDecoFreezer(false)}>
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-8 pt-7 pb-5 bg-gradient-to-br from-rose-50 via-rose-50/80 to-pink-50 border-b border-rose-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight">Deco Freezer</h2>
                  <p className="text-sm text-zinc-500 mt-1">Production Recipe &amp; Advanced Premix from Deco</p>
                </div>
                <button onClick={() => setShowDecoFreezer(false)} className="w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-200/70 px-3 py-1 text-xs font-bold text-rose-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                  {decoFreezerTab === "production-recipe" ? decoProductionRecipes.length : advancedPremix.length} items
                </span>
                <span className="text-xs text-zinc-400">Total: {decoFreezerTab === "production-recipe" ? decoProductionRecipes.reduce((s, i) => s + i.qty, 0) : advancedPremix.reduce((s, i) => s + i.qty, 0)} pcs</span>
                {selectedDOS && (() => {
                  const needMap = new Map<string, number>();
                  if (promo) {
                    promo.items.forEach(pi => needMap.set(pi.productName, (needMap.get(pi.productName) || 0) + pi.qty * (selectedDOS.qty ?? 1)));
                  } else {
                    needMap.set(selectedDOS.product, selectedDOS.qty ?? 1);
                  }
                  const neededCount = [...needMap.keys()].filter(n => [...decoProductionRecipes, ...advancedPremix].some(bp => bp.productName === n)).length;
                  return neededCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">{neededCount} needed highlighted</span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-2 px-6 pt-4 pb-2">
              <button onClick={() => setDecoFreezerTab("production-recipe")} className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${decoFreezerTab === "production-recipe" ? "bg-rose-600 text-white shadow-sm" : "bg-rose-50 text-rose-700 hover:bg-rose-100"}`}>Production Recipe</button>
              <button onClick={() => setDecoFreezerTab("advanced-premix")} className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${decoFreezerTab === "advanced-premix" ? "bg-rose-600 text-white shadow-sm" : "bg-rose-50 text-rose-700 hover:bg-rose-100"}`}>Advanced Premix</button>
            </div>

            <div className="px-6 pt-2 pb-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <input value={decoFreezerSearch} onChange={e => setDecoFreezerSearch(e.target.value)} placeholder={`Search ${decoFreezerTab === "production-recipe" ? "production recipes" : "advanced premix"}...`} className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all" />
                {decoFreezerSearch && <button onClick={() => setDecoFreezerSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {(() => {
                const items = decoFreezerTab === "production-recipe" ? decoProductionRecipes : advancedPremix;
                const filtered = items.filter(i => !decoFreezerSearch || i.productName.toLowerCase().includes(decoFreezerSearch.toLowerCase()));

                if (filtered.length === 0) {
                  return (
                    <div className="px-8 py-16 text-center">
                      <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                      </div>
                      <p className="text-base font-medium text-zinc-500">{decoFreezerTab === "production-recipe" ? "No Production Recipe items" : "No Advanced Premix items"}</p>
                      <p className="text-sm text-zinc-400 mt-1">Wait for Deco to produce items.</p>
                    </div>
                  );
                }

                const grouped = new Map<string, { items: typeof filtered; totalQty: number }>();
                filtered.forEach(item => {
                  if (!grouped.has(item.productName)) grouped.set(item.productName, { items: [], totalQty: 0 });
                  const g = grouped.get(item.productName)!;
                  g.items.push(item);
                  g.totalQty += item.qty;
                });

                return (
                  <div className="divide-y divide-zinc-100">
                    {[...grouped.entries()].map(([name, group]) => {
                      const needMap = new Map<string, number>();
                      if (selectedDOS) {
                        if (promo) {
                          promo.items.forEach(pi => needMap.set(pi.productName, (needMap.get(pi.productName) || 0) + pi.qty * (selectedDOS.qty ?? 1)));
                        } else {
                          needMap.set(selectedDOS.product, selectedDOS.qty ?? 1);
                        }
                      }
                      const needed = needMap.get(name) || 0;
                      const isNeeded = needed > 0;
                      const hasEnough = group.totalQty >= needed;
                      const recipe = recipes.find(r => r.productName.toLowerCase() === name.toLowerCase());

                      return (
                        <div key={name} className={`px-6 py-4 transition-all ${isNeeded ? "bg-rose-50/80 border-l-4 border-l-rose-400" : "hover:bg-zinc-50/50"}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isNeeded ? "bg-rose-400" : "bg-rose-100"}`}>
                                <svg className={`w-5 h-5 ${isNeeded ? "text-white" : "text-rose-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className={`text-sm font-bold truncate ${isNeeded ? "text-rose-900" : "text-zinc-900"}`}>{name}</div>
                                  {isNeeded && <span className="inline-flex items-center rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-800 shrink-0">NEEDED</span>}
                                  {recipe && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setViewingRecipe(recipe); }}
                                      className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-200 transition-colors shrink-0"
                                    >
                                      Recipe
                                    </button>
                                  )}
                                </div>
                                <div className="text-xs text-zinc-400 mt-0.5">{group.items.length} batch{group.items.length > 1 ? "es" : ""}</div>
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-4 shrink-0 ml-4">
                              {isNeeded && (
                                <div className="text-right">
                                  <div className={`text-sm font-bold font-mono ${hasEnough ? "text-emerald-600" : "text-red-500"}`}>Need: {needed}</div>
                                  <div className="text-[10px] text-zinc-400">required</div>
                                </div>
                              )}
                              <div>
                                <div className={`text-xl font-extrabold font-mono ${isNeeded ? "text-rose-900" : "text-zinc-900"}`}>{group.totalQty}</div>
                                <div className="text-[10px] text-zinc-400 uppercase tracking-wider">pcs</div>
                              </div>
                            </div>
                          </div>

                          {/* Batch breakdown */}
                          {group.items.length > 1 && (
                            <div className="flex flex-wrap gap-1.5 mt-2 ml-13">
                              {group.items.map((item, idx) => (
                                <span key={item.id} className="inline-flex items-center gap-1 rounded-md bg-zinc-50 border border-zinc-200 px-2 py-0.5 text-[10px] text-zinc-500">
                                  Batch {idx + 1}: {item.qty} pcs
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Select button for needed items */}
                          {isNeeded && (
                            <div className="mt-2 flex gap-1.5">
                              <button
                                onClick={() => {
                                  const stockItems = [...decoProductionRecipes, ...advancedPremix].filter(i => i.productName === name);
                                  const needQty = needed;
                                  const allocated = getAllocatedPerProduct().get(name) || 0;
                                  const toAdd = Math.min(needQty - allocated, group.totalQty);
                                  if (toAdd <= 0) return;
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
                                disabled={(() => {
                                  const allocated = getAllocatedPerProduct().get(name) || 0;
                                  return allocated >= needed;
                                })()}
                                className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {(() => {
                                  const allocated = getAllocatedPerProduct().get(name) || 0;
                                  return allocated >= needed ? "Selected" : "Select for Assembly";
                                })()}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="px-8 py-4 border-t border-zinc-100 bg-zinc-50/50">
              <button onClick={() => setShowDecoFreezer(false)} className="w-full rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white py-3 text-sm font-semibold transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Detail Modal */}
      {viewingRecipe && (() => {
        const r = viewingRecipe;
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setViewingRecipe(null)}>
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="px-8 pt-7 pb-5 bg-gradient-to-br from-blue-50 via-blue-50/80 to-indigo-50 border-b border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight">{r.productName}</h2>
                    <p className="text-sm text-zinc-500 mt-1">{r.ingredients.length} ingredients · Yield: {r.yield ?? 1} pcs/batch</p>
                  </div>
                  <button onClick={() => setViewingRecipe(null)} className="w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <div className="px-8 py-6 space-y-6">
                {/* Ingredients */}
                {r.ingredients.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Ingredients</span>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 border border-zinc-100 divide-y divide-zinc-100">
                      {r.ingredients.map((ing, i) => (
                        <div key={i} className="flex items-center justify-between px-5 py-3">
                          <span className="text-sm font-medium text-zinc-800">{ing.name}</span>
                          <span className="text-sm font-semibold text-zinc-600">{ing.qtyPerBatch} {ing.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Packaging Materials */}
                {r.packagingMaterials.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Packaging Materials</span>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 border border-zinc-100 divide-y divide-zinc-100">
                      {r.packagingMaterials.map((pkg, i) => (
                        <div key={i} className="flex items-center justify-between px-5 py-3">
                          <span className="text-sm font-medium text-zinc-800">{pkg.name}</span>
                          <span className="text-sm font-semibold text-zinc-600">{pkg.qtyPerBatch} {pkg.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Decoration Supplies */}
                {r.decorationSupplies.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Decoration Supplies</span>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 border border-zinc-100 divide-y divide-zinc-100">
                      {r.decorationSupplies.map((deco, i) => (
                        <div key={i} className="flex items-center justify-between px-5 py-3">
                          <span className="text-sm font-medium text-zinc-800">{deco.name}</span>
                          <span className="text-sm font-semibold text-zinc-600">{deco.qtyPerBatch} {deco.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {r.notes && (
                  <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                    <p className="text-sm text-amber-800">{r.notes}</p>
                  </div>
                )}
              </div>
              <div className="px-8 pb-6">
                <button onClick={() => setViewingRecipe(null)} className="w-full rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white py-3.5 text-sm font-semibold transition-colors">Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </>);
  }


  /* ── Freezer Tab ── */
  if (activeTab === "freezer") {
    const pastryItems = freezerItems.filter(i => i.producedBy === "pastry" && i.status === "stored");
    const assembledItems = pastryItems.filter(i => i.notes?.toLowerCase().includes("assembled") || i.notes?.toLowerCase().includes("packaged"));
    const componentItems = freezerItems.filter(i => i.producedBy === "pastry" && i.status === "stored" && !i.notes?.toLowerCase().includes("assembled") && !i.notes?.toLowerCase().includes("packaged"));
    const tabItems = freezerTab === "components" ? componentItems : assembledItems;
    const filtered = tabItems.filter(i => !freezerSearch || i.productName.toLowerCase().includes(freezerSearch.toLowerCase()));

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

    const matchesSearch = (p: PromoPackage) => {
      if (!promoSearch.trim()) return true;
      const q = promoSearch.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.items.some(i => i.productName.toLowerCase().includes(q));
    };
    const filteredActive = activePromos.filter(matchesSearch);
    const filteredOutOfRange = dateOutOfRange.filter(matchesSearch);
    const filteredInactive = inactivePromos.filter(matchesSearch);

    const renderPromoCard = (promo: PromoPackage, displayStatus: string, opacityClass: string = "") => {
      const isPromo = promo.type === "promo";
      const savings = promo.originalPrice > 0 && promo.promoPrice > 0 ? Math.round(((promo.originalPrice - promo.promoPrice) / promo.originalPrice) * 100) : 0;
      return (
        <div key={promo.id} onClick={() => setViewingPromo(promo)} className={`group rounded-2xl bg-white shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border ${isPromo ? "border-amber-100" : "border-blue-100"} ${opacityClass} cursor-pointer`}>
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
      <>
      <div className="min-h-screen bg-zinc-50/50">
        <div className="max-w-5xl mx-auto space-y-8 p-6">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Promos &amp; Packages</h1>
            <p className="mt-1.5 text-base text-zinc-500">View active promos and package deals for assembly.</p>
          </div>

          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            <input value={promoSearch} onChange={e => setPromoSearch(e.target.value)} placeholder="Search promos, packages, or items..." className="w-full rounded-2xl border border-zinc-200 bg-white pl-11 pr-4 py-3 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 transition-all" />
            {promoSearch && <button onClick={() => setPromoSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
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
              {filteredActive.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-zinc-800 mb-5">Currently Active</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredActive.map(promo => renderPromoCard(promo, "active"))}
                  </div>
                </div>
              )}

              {filteredOutOfRange.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-amber-700 mb-5">Upcoming / Expired Dates</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredOutOfRange.map(promo => {
                      const isUpcoming = promo.startDate && today < promo.startDate;
                      return renderPromoCard(promo, isUpcoming ? "not started" : "expired", "opacity-75");
                    })}
                  </div>
                </div>
              )}

              {filteredInactive.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-zinc-800 mb-5">Inactive</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredInactive.map(promo => renderPromoCard(promo, promo.status, "opacity-50"))}
                  </div>
                </div>
              )}

              {promoSearch && filteredActive.length === 0 && filteredOutOfRange.length === 0 && filteredInactive.length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center">
                  <p className="text-base font-medium text-zinc-500">No results for "{promoSearch}"</p>
                  <p className="text-sm text-zinc-400 mt-1">Try a different search term.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Promo/Package Detail Modal */}
      {viewingPromo && (() => {
        const p = viewingPromo;
        const isPromo = p.type === "promo";
        const savings = p.originalPrice > 0 && p.promoPrice > 0 ? Math.round(((p.originalPrice - p.promoPrice) / p.originalPrice) * 100) : 0;
        const fmtDate = (d?: string) => { if (!d) return null; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setViewingPromo(null)}>
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className={`relative px-8 pt-7 pb-6 ${isPromo ? "bg-gradient-to-br from-amber-50 via-amber-50/80 to-orange-50" : "bg-gradient-to-br from-blue-50 via-blue-50/80 to-indigo-50"}`}>
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[80px] opacity-[0.06] ${isPromo ? "bg-amber-600" : "bg-blue-600"}`} />
                <button onClick={() => setViewingPromo(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${isPromo ? "bg-amber-200/70 text-amber-800" : "bg-blue-200/70 text-blue-800"}`}>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    {p.type}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${p.status === "active" ? "bg-emerald-100 text-emerald-700" : p.status === "inactive" ? "bg-zinc-100 text-zinc-500" : "bg-red-100 text-red-700"}`}>{p.status}</span>
                </div>
                <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight">{p.name}</h2>
                {p.description && <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{p.description}</p>}
              </div>

              <div className="px-8 py-6 space-y-6">
                {/* Items included */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Included Items</span>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 border border-zinc-100 divide-y divide-zinc-100">
                    {p.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${isPromo ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{i + 1}</div>
                          <span className="text-sm font-medium text-zinc-800">{item.productName}</span>
                        </div>
                        <span className={`inline-flex items-center justify-center min-w-[40px] rounded-lg px-3 py-1.5 text-sm font-bold ${isPromo ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>x{item.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pricing */}
                <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Pricing</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      {p.originalPrice > 0 && <p className="text-base text-zinc-400 line-through">{"\u20B1"}{p.originalPrice.toFixed(2)}</p>}
                      {p.promoPrice > 0 && <p className="text-3xl font-extrabold text-zinc-900 tracking-tight">{"\u20B1"}{p.promoPrice.toFixed(2)}</p>}
                    </div>
                    {savings > 0 && (
                      <div className="text-right">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">Save {savings}%</span>
                        <p className="text-xs text-emerald-600 mt-1 font-medium">{"\u20B1"}{(p.originalPrice - p.promoPrice).toFixed(2)} off</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Date validity */}
                {(p.startDate || p.endDate) && (
                  <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Validity Period</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 rounded-xl bg-white border border-zinc-200 px-4 py-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Start</p>
                        <p className="text-sm font-semibold text-zinc-800">{fmtDate(p.startDate) || "\u2014"}</p>
                      </div>
                      <svg className="w-5 h-5 text-zinc-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                      <div className="flex-1 rounded-xl bg-white border border-zinc-200 px-4 py-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">End</p>
                        <p className="text-sm font-semibold text-zinc-800">{fmtDate(p.endDate) || "\u2014"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-8 pb-6">
                <button onClick={() => setViewingPromo(null)} className="w-full rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white py-3.5 text-sm font-semibold transition-colors">Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* My Inventory Modal */}
      {showMyInventory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowMyInventory(false)}>
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-8 pt-7 pb-5 bg-gradient-to-br from-emerald-50 via-emerald-50/80 to-teal-50 border-b border-emerald-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight">My Inventory</h2>
                  <p className="text-sm text-zinc-500 mt-1">Select ingredients and quantities for assembly</p>
                </div>
                <button onClick={() => setShowMyInventory(false)} className="w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-200/70 px-3 py-1 text-xs font-bold text-emerald-800">
                  {pastryAccessInventory.length} ingredients
                </span>
              </div>
            </div>

            <div className="px-6 pt-4 pb-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <input value={myInventorySearch} onChange={e => setMyInventorySearch(e.target.value)} placeholder="Search ingredients..." className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all" />
                {myInventorySearch && <button onClick={() => setMyInventorySearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {pastryAccessInventory.length === 0 ? (
                <div className="px-8 py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3.75h4.5m-4.5 3.75h4.5M12 12v4.5m0-4.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9z" /></svg>
                  </div>
                  <p className="text-base font-medium text-zinc-500">No ingredients in inventory</p>
                  <p className="text-sm text-zinc-400 mt-1">Add ingredients to access them here.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {pastryAccessInventory.filter(i => !myInventorySearch || i.name.toLowerCase().includes(myInventorySearch.toLowerCase())).map(item => {
                    const selected = selectedInventory.get(item.id);
                    const selectedQty = selected ? selected.qty : 0;
                    return (
                      <div key={item.id} className="px-6 py-4 hover:bg-zinc-50/50 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-zinc-900 truncate">{item.name}</div>
                              <div className="text-xs text-zinc-400 mt-0.5">{item.sku || ""} · {item.category}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <div className="text-right">
                              <div className="text-sm text-zinc-500">On Hand: <span className="font-semibold text-zinc-800 font-mono">{item.onHand}</span></div>
                              <div className="text-[10px] text-zinc-400 uppercase">{item.unit}</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 ml-13">
                          <span className="text-xs font-medium text-zinc-500">Use:</span>
                          <button
                            onClick={() => {
                              setSelectedInventory(prev => {
                                const next = new Map(prev);
                                const existing = next.get(item.id);
                                const currentQty = existing ? existing.qty : 0;
                                if (currentQty <= 0) return prev;
                                if (currentQty <= 1) {
                                  next.delete(item.id);
                                } else {
                                  next.set(item.id, { item, qty: currentQty - 1 });
                                }
                                return next;
                              });
                              setSelectedFreezerItems(prev => {
                                const next = new Map(prev);
                                if (selectedQty <= 1) {
                                  [...next.entries()].forEach(([id, v]) => {
                                    if (v.item.id === item.id) next.delete(id);
                                  });
                                }
                                return next;
                              });
                            }}
                            disabled={selectedQty <= 0}
                            className="w-8 h-8 rounded-lg border-2 border-zinc-200 bg-white text-lg font-bold text-zinc-500 hover:bg-zinc-100 hover:border-zinc-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                          >-</button>
                          <div className="w-14 text-center text-xl font-bold text-zinc-900 font-mono">{selectedQty}</div>
                          <button
                            onClick={() => {
                              const maxQty = item.onHand;
                              if (selectedQty >= maxQty) return;
                              setSelectedInventory(prev => {
                                const next = new Map(prev);
                                const existing = next.get(item.id);
                                const currentQty = existing ? existing.qty : 0;
                                if (currentQty < maxQty) {
                                  next.set(item.id, { item, qty: currentQty + 1 });
                                }
                                return next;
                              });
                            }}
                            disabled={selectedQty >= item.onHand}
                            className="w-8 h-8 rounded-lg border-2 border-emerald-300 bg-emerald-50 text-lg font-bold text-emerald-600 hover:bg-emerald-100 hover:border-emerald-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                          >+</button>
                          <span className="text-xs text-zinc-400">/ {item.onHand} max</span>
                        </div>
                        {selectedQty > 0 && selectedDOS && (
                          <div className="mt-2 ml-13">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              Using {selectedQty} {item.unit} for {selectedDOS.product}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-8 py-4 border-t border-zinc-100 bg-zinc-50/50">
              <button onClick={() => setShowMyInventory(false)} className="w-full rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white py-3 text-sm font-semibold transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  return null;
}

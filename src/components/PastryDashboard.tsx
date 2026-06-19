import { useEffect, useState, useMemo } from "react";
import type { DOSItem, FreezerItem, FreezerHistory, InventoryItem, PromoPackage, PastryAssemblyTask, ProductRecipe, StockTransaction } from "../types";
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
  onStockTransaction?: (tx: StockTransaction) => void;
};

const workflowSteps = [
  { id: "orders", label: "My Orders" },
  { id: "assemble", label: "Assemble" },
  { id: "production-details", label: "Production Details" },
];

export default function PastryDashboard({ dosItems, activeTab, newDOSIds, onMarkDOSSeen, freezerItems = [], onUpdateFreezer, freezerHistory = [], inventory = [], onUpdateInventory, promosPackages = [], recipes = [], productCatalog = [], onStockTransaction }: Props) {
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
  const decoFreezerTab = "production-recipe";
  const [viewingRecipe, setViewingRecipe] = useState<ProductRecipe | null>(null);

  const [showAddFreezer, setShowAddFreezer] = useState(false);
  const [showEditFreezer, setShowEditFreezer] = useState(false);
  const [editingFreezerItem, setEditingFreezerItem] = useState<FreezerItem | null>(null);
  const [newProduct, setNewProduct] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("pcs");
  const [showAddPastryProduct, setShowAddPastryProduct] = useState(false);
  const [addPastryProduct, setAddPastryProduct] = useState("");
  const [addPastrySize, setAddPastrySize] = useState("");
  const [addPastryQty, setAddPastryQty] = useState("");
  const [productCategoryMap, setProductCategoryMap] = useState<Record<string, string>>({});
  const [newBatch, setNewBatch] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [freezerSearch, setFreezerSearch] = useState("");
  const [freezerTab, setFreezerTab] = useState<"assembled" | "components" | "my-inventory">("assembled");

  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventoryUsageSearch, setInventoryUsageSearch] = useState("");
  const [selectedInventoryUsage, setSelectedInventoryUsage] = useState<Map<string, { item: InventoryItem; qty: number }>>(new Map());
  const [acquiredProducts, setAcquiredProducts] = useState<Set<string>>(new Set());
  const [acquiringProductName, setAcquiringProductName] = useState<string | null>(null);

  useEffect(() => {
    db.fetchPastryAssemblyTasks().then(setAssemblyTasks).catch(console.error);
  }, [activeTab]);

  // Reset acquired products when entering Step 1 for a promo/package
  useEffect(() => {
    if (step === 1 && selectedDOS) {
      const promoDef = findPromo(selectedDOS.product);
      if (promoDef) {
        setAcquiredProducts(new Set());
      } else {
        setAcquiredProducts(new Set());
      }
    }
  }, [step, selectedDOS]);


  // Auto-allocate products and auto-fill count when entering Step 1
  useEffect(() => {
    if (step !== 1 || !selectedDOS) return;
    if (!hasDecoRecipe) { setProducedCount(0); return; }
    if (promo) return;
    const target = selectedDOS.qty ?? 0;
    setProducedCount(Math.min(target, maxProduced));
    const need = getNeedPerProduct();
    const allStock = promo ? bakedProducts : [...decoProductionRecipes, ...advancedPremix];
    setSelectedFreezerItems(prev => {
      const next = new Map(prev);
      let changed = false;
      need.forEach((productNeed, productName) => {
        const pn = productName.toLowerCase();
        const alreadyAllocated = [...next.values()].filter(e => e.item.productName.toLowerCase() === pn).reduce((s, e) => s + e.qty, 0);
        if (alreadyAllocated >= productNeed) return;
        const stockItems = allStock.filter(i => i.productName.toLowerCase() === pn && i.qty > 0);
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
  }, [step, selectedDOS, freezerItems]);

  useEffect(() => {
    db.fetchProductCategories().then(map => setProductCategoryMap(map)).catch(() => {});
  }, []);

  const pastryAccessInventory = inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("pastry"));
  const filteredInventory = useMemo(() => {
    if (!inventoryUsageSearch) return pastryAccessInventory;
    const q = inventoryUsageSearch.toLowerCase();
    return pastryAccessInventory.filter(i => i.name.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q));
  }, [pastryAccessInventory, inventoryUsageSearch]);

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

  const getBaseName = (name: string) =>
    name.toLowerCase().replace(/[\s]*[\(\*\d].*$/, '').trim();

  const productRecipeLookup = (name: string) => {
    const pn = name.toLowerCase();
    const exact = recipes.filter(r => r.productName.toLowerCase() === pn);
    const withLinks = exact.find(r => (r.linkedIngredients ?? []).length > 0);
    return withLinks ?? exact[0] ?? undefined;
  };

  const findRecipeName = (productName: string): string => {
    if (!recipes || recipes.length === 0) return productName;
    const pn = productName.toLowerCase();
    const directRecipe = productRecipeLookup(productName);
    if (directRecipe) {
      const linkedName = directRecipe.linkedIngredients?.find(l => l.toLowerCase() !== pn);
      if (linkedName) {
        const linkedRecipe = productRecipeLookup(linkedName);
        if (linkedRecipe) return linkedRecipe.productName;
      }
      return directRecipe.productName;
    }
    const linked = recipes.find(r => r.linkedIngredients?.some(l => l.toLowerCase() === pn));
    if (linked) return linked.productName;
    const baseMatch = recipes.find(r => getBaseName(r.productName) === getBaseName(productName));
    return baseMatch?.productName ?? productName;
  };

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
      need.set(findRecipeName(selectedDOS.product), selectedDOS.qty ?? 1);
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
    const productNeed = getNeedCI(need, productName);
    const allocated = getAllocatedPerProduct();
    const pn = productName.toLowerCase();
    let productAllocated = 0;
    allocated.forEach((qty, name) => { if (name.toLowerCase() === pn) productAllocated += qty; });
    return Math.max(0, productNeed - productAllocated);
  };

  const getNeedCI = (need: Map<string, number>, productName: string): number => {
    const pn = productName.toLowerCase();
    for (const [k, v] of need) { if (k.toLowerCase() === pn) return v; }
    return 0;
  };

  const toggleFreezerItem = (item: FreezerItem) => {
    setSelectedFreezerItems(prev => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        const need = getNeedPerProduct();
        const productNeed = getNeedCI(need, item.productName);
        const pn = item.productName.toLowerCase();
        let otherAllocated = 0;
        prev.forEach(({ item: sel, qty }) => {
          if (sel.productName.toLowerCase() === pn) otherAllocated += qty;
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
        const productNeed = getNeedCI(need, entry.item.productName);
        const pn = entry.item.productName.toLowerCase();
        let otherAllocated = 0;
        prev.forEach(({ item: sel, qty }) => {
          if (sel.productName.toLowerCase() === pn && sel.id !== itemId) otherAllocated += qty;
        });
        const maxAllowed = Math.max(1, Math.min(entry.item.qty, productNeed - otherAllocated));
        const clamped = Math.max(1, Math.min(newQty, maxAllowed));
        next.set(itemId, { ...entry, qty: clamped });
      }
      return next;
    });
  };

  const promo = selectedDOS ? findPromo(selectedDOS.product) : null;
  const allProductsAcquired = promo
    ? promo.items.every(item => acquiredProducts.has(item.productName))
    : true;
  const getBakerStock = (productName: string) =>
    bakedProducts
      .filter(b => b.productName.toLowerCase() === productName.toLowerCase())
      .reduce((s, b) => s + b.qty, 0);

  // Auto-set producedCount when promo products are acquired
  useEffect(() => {
    if (step !== 1 || !selectedDOS || !promo) return;
    const acquiredCount = promo.items.filter(item => acquiredProducts.has(item.productName)).length;
    setProducedCount(acquiredCount);
  }, [acquiredProducts, step, selectedDOS, promo]);
  const produceTarget = promo
    ? promo.items.length
    : selectedDOS?.qty ?? 0;
  const neededRecipeName = selectedDOS && !promo ? findRecipeName(selectedDOS.product) : null;
  const hasDecoRecipe = neededRecipeName
    ? decoProductionRecipes.some(i => i.productName.toLowerCase() === neededRecipeName.toLowerCase())
    : true;
  const maxProduced = neededRecipeName && !promo
    ? Math.min(produceTarget, decoProductionRecipes.filter(i => i.productName.toLowerCase() === neededRecipeName.toLowerCase()).reduce((s, i) => s + i.qty, 0))
    : produceTarget;

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
    console.log("[PastryDashboard] handleStartAssembly called", { selectedDOS: !!selectedDOS, producedCount, activeTask: !!activeTask, freezerCount: selectedFreezerItems.size, inventoryCount: selectedInventoryUsage.size, step });
    if (!selectedDOS) { console.warn("[PastryDashboard] early return: no selectedDOS"); return; }

    let task = activeTask;
    if (!task) {
      console.log("[PastryDashboard] no activeTask, creating new task");
      const promoDef = findPromo(selectedDOS.product);
      const components: PastryAssemblyTask["components"] = [];
      task = {
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
      console.log("[PastryDashboard] task created", task);
    }

    try {
      const updated = { ...task, status: "in_progress" as const, updatedAt: new Date().toISOString() };
      console.log("[PastryDashboard] setting activeTask to", updated);
      db.savePastryAssemblyTask(updated).catch(console.error);
      setAssemblyTasks(prev => {
        const exists = prev.some(t => t.id === updated.id);
        return exists ? prev.map(t => t.id === updated.id ? updated : t) : [updated, ...prev];
      });
      setActiveTask(updated);
      console.log("[PastryDashboard] handleStartAssembly completed OK");
    } catch (err) {
      console.error("[PastryDashboard] handleStartAssembly threw:", err);
    }
  };

  const handleCompleteAssembly = async () => {
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
      const ok = await db.upsertFreezerItems(deductions);
      if (!ok) { alert("Failed to deduct freezer stock. Please try again."); return; }
    }

    if (selectedInventoryUsage.size > 0 && onUpdateInventory) {
      const inventoryDeductions: InventoryItem[] = [];
      selectedInventoryUsage.forEach(({ item, qty }) => {
        const deductQty = Math.min(qty, item.onHand);
        inventoryDeductions.push({ ...item, onHand: item.onHand - deductQty });
      });
      onUpdateInventory((prev: InventoryItem[]) =>
        prev.map(i => {
          const sub = inventoryDeductions.find(d => d.id === i.id);
          return sub || i;
        })
      );
      db.upsertInventory(inventoryDeductions).catch(console.error);
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
    setSelectedInventoryUsage(new Map());
    setActiveTask(null);
    setQcChecklist({ correctProducts: false, correctQty: false, packagingComplete: false, labelAttached: false });
    setStep(0);
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
                                  <div className="mt-2.5 space-y-1">
                                    {p.items.map((item, idx) => (
                                      <div key={idx} className="flex items-center justify-between rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2">
                                        <span className="text-[13px] font-medium text-zinc-600">{item.productName}</span>
                                        <span className="text-[13px] font-bold text-zinc-800 font-mono">x{item.qty * totalQty}</span>
                                      </div>
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
                  {selectedDOS ? `Assemble ${selectedDOS.product}` : "Select an order to continue"}
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 1: Assemble ─── */}
          {step === 1 && selectedDOS && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <button onClick={() => setStep(0)} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-all">
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
                    <h3 className="text-lg font-bold text-zinc-900">{findRecipeName(selectedDOS.product)}</h3>
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

              {promo ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-zinc-900">Required Products</h3>
                    <button onClick={() => setShowBakerFreezer(true)} className="inline-flex items-center gap-1.5 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-3.5 py-2 text-[11px] font-bold text-amber-700 hover:bg-amber-100 hover:border-amber-400 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                      Baker Freezer
                    </button>
                  </div>
                  <div className="grid gap-3">
                    {promo.items.map((item, idx) => {
                      const isAcquired = acquiredProducts.has(item.productName);
                      const requiredQty = item.qty * (selectedDOS.qty ?? 1);
                      const availableStock = getBakerStock(item.productName);
                      const hasEnoughStock = availableStock >= requiredQty;
                      return (
                        <div key={idx} className={`rounded-2xl border-2 p-4 transition-all ${isAcquired ? "border-emerald-300 bg-emerald-50" : "border-zinc-200 bg-white hover:border-zinc-300"}`}>
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isAcquired ? "bg-emerald-400" : "bg-amber-100"}`}>
                                {isAcquired ? (
                                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                ) : (
                                  <span className="text-sm font-bold text-amber-700">{idx + 1}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className={`text-sm font-bold truncate ${isAcquired ? "text-emerald-900" : "text-zinc-900"}`}>{item.productName}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-zinc-500">Need <strong className="font-mono">{requiredQty}</strong> pcs</span>
                                  <span className={`text-xs ${hasEnoughStock ? "text-emerald-600" : "text-red-500"}`}>
                                    Stock: <strong className="font-mono">{availableStock}</strong> pcs
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                if (isAcquired) {
                                  setAcquiredProducts(prev => {
                                    const next = new Set(prev);
                                    next.delete(item.productName);
                                    return next;
                                  });
                                } else {
                                  setAcquiringProductName(item.productName);
                                  setShowBakerFreezer(true);
                                }
                              }}
                              className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                                isAcquired
                                  ? "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
                                  : "border-2 border-dashed border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400"
                              }`}
                            >
                              {isAcquired ? "Acquired" : "Acquire"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Progress summary */}
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-semibold text-zinc-700">{acquiredProducts.size}/{promo.items.length}</span> products acquired
                    {acquiredProducts.size === promo.items.length ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        Ready to proceed
                      </span>
                    ) : (
                      <span className="text-zinc-400">— acquire all products to continue</span>
                    )}
                    <button onClick={() => setShowInventoryModal(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                      My Inventory
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setShowDecoFreezer(true)} className="rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50/50 py-3.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 hover:border-rose-400 transition-all flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg>
                    <span>View Deco Freezer — <strong>{decoProductionRecipes.length}</strong> products</span>
                  </button>
                  <button type="button" onClick={() => setShowInventoryModal(true)} className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 py-3.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 transition-all flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                    <span>Use Inventory — <strong>{pastryAccessInventory.length}</strong> items</span>
                  </button>
                </div>
              )}

              {selectedFreezerItems.size > 0 && (
                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100">
                        <svg className="h-4 w-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-zinc-800">Freezer Allocation</span>
                        <p className="text-[11px] text-zinc-400 leading-none mt-0.5">Assigned production components</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                      {selectedFreezerItems.size} item{selectedFreezerItems.size !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-50">
                    {[...selectedFreezerItems.values()].map(({ item, qty }) => (
                      <div key={item.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-xs font-bold text-sky-600">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg>
                          </div>
                          <span className="text-sm font-medium text-zinc-800">{item.productName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">Batch <span className="font-mono">{(item.batchRef ?? "N/A").replace(/^.*?(\d{1,4})$/, "$1")}</span></span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-sm font-bold text-amber-700">
                            x{qty}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedInventoryUsage.size > 0 && (
                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                        <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-zinc-800">Inventory Consumption</span>
                        <p className="text-[11px] text-zinc-400 leading-none mt-0.5">Items used from My Inventory</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {selectedInventoryUsage.size} item{selectedInventoryUsage.size !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-50">
                    {[...selectedInventoryUsage.values()].map(({ item, qty }) => (
                      <div key={item.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-600">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                          </div>
                          <span className="text-sm font-medium text-zinc-800">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedInventoryUsage(prev => { const next = new Map(prev); next.delete(item.id); return next; })}
                            className="rounded-lg border border-red-200 bg-white px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-all"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                          </button>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-sm font-bold text-emerald-700">
                            {qty} {item.unit}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border-2 border-zinc-200 bg-white p-6">
                <div className="flex items-center justify-center gap-4 mb-5">
                  <button onClick={() => setProducedCount(prev => Math.max(0, prev - 1))} disabled={producedCount <= 0 || !hasDecoRecipe} className="w-14 h-14 rounded-xl border-2 border-zinc-200 bg-zinc-50 text-2xl font-bold text-zinc-500 hover:bg-zinc-100 hover:border-zinc-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95">&minus;</button>
                  <input type="number" min="0" max={maxProduced} value={producedCount} onChange={e => setProducedCount(Math.max(0, Math.min(Number(e.target.value) || 0, maxProduced)))} className="w-28 text-center text-5xl font-bold text-zinc-900 bg-transparent border-b-2 border-zinc-200 focus:border-amber-500 outline-none transition-colors disabled:opacity-30" style={{ fontFamily: "Fragment Mono, monospace" }} disabled={!hasDecoRecipe} />
                  <button onClick={() => setProducedCount(prev => Math.min(maxProduced, prev + 1))} disabled={producedCount >= maxProduced || !hasDecoRecipe} className="w-14 h-14 rounded-xl border-2 border-amber-300 bg-amber-50 text-2xl font-bold text-amber-600 hover:bg-amber-100 hover:border-amber-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95">+</button>
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

              {!hasDecoRecipe && neededRecipeName && (
                <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-center">
                  <p className="text-sm font-semibold text-red-700">Recipe not available in Deco Freezer</p>
                  <p className="text-xs text-red-500 mt-1">"{neededRecipeName}" is not in the Deco Production Recipe. Open <button onClick={() => setShowDecoFreezer(true)} className="underline font-medium text-red-600 hover:text-red-800">View Deco Freezer</button> to check available items.</p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="rounded-2xl border border-zinc-200 bg-white py-4 px-6 text-base font-medium text-zinc-700 hover:bg-zinc-50 transition-all">Back</button>
                <button onClick={() => { handleStartAssembly(); setStep(2); }} disabled={producedCount === 0 || !hasDecoRecipe || (promo && !allProductsAcquired)} className="flex-1 rounded-2xl bg-amber-600 py-4 text-lg font-bold text-white hover:bg-amber-700 transition-all shadow-md active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed">
                  Proceed to Production Details
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Production Details ─── */}
          {step === 2 && selectedDOS && activeTask && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <button onClick={() => { setStep(1); setActiveTask(at => at ? { ...at, status: "accepted" as const } : null); }} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">Production Details</h2>
                  <p className="mt-1 text-base text-zinc-500">Review the assembly and save to Freezer.</p>
                </div>
              </div>

              {/* Allocated Freezer Recipes */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-bold text-zinc-900 mb-4">Allocated Freezer Recipes</h3>
                {promo && promo.items.length > 0 ? (
                  <div className="divide-y divide-zinc-100">
                    {promo.items.map((item, i) => {
                      const isAcquired = acquiredProducts.has(item.productName);
                      return (
                        <div key={i} className={`flex items-center justify-between py-3 ${isAcquired ? "" : "opacity-40"}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isAcquired ? "bg-rose-100" : "bg-zinc-100"}`}>
                              <svg className={`w-4 h-4 ${isAcquired ? "text-rose-600" : "text-zinc-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg>
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-zinc-900 truncate">{item.productName}</div>
                              <div className="text-xs text-zinc-400">Need {item.qty} pcs</div>
                            </div>
                          </div>
                          {isAcquired ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              Acquired
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-400">Not acquired</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : selectedFreezerItems.size === 0 ? (
                  <p className="text-sm text-zinc-400">No freezer items allocated.</p>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {[...selectedFreezerItems.entries()].map(([id, { item, qty }]) => (
                      <div key={id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-zinc-900 truncate">{item.productName}</div>
                            <div className="text-xs text-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.id}</div>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-zinc-700">{qty} pcs</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Inventory Consumption */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-bold text-zinc-900 mb-4">Inventory Consumption</h3>
                {selectedInventoryUsage.size === 0 ? (
                  <p className="text-sm text-zinc-400">No inventory items used.</p>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {[...selectedInventoryUsage.entries()].map(([id, { item, qty }]) => (
                      <div key={id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-zinc-900 truncate">{item.name || item.productName}</div>
                            <div className="text-xs text-zinc-400">{item.unit || "pcs"}</div>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-zinc-700">{qty} {item.unit || "pcs"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Complete button */}
              <div className="flex gap-3">
                <button onClick={() => { setStep(1); setActiveTask(at => at ? { ...at, status: "accepted" as const } : null); }} className="rounded-2xl border border-zinc-200 bg-white py-4 px-6 text-base font-medium text-zinc-700 hover:bg-zinc-50 transition-all">Back</button>
                <button onClick={handleCompleteAssembly} className="flex-1 rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white hover:bg-emerald-700 transition-all shadow-md active:scale-[0.98]">
                  Complete &amp; Save to Freezer
                </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => { setAcquiringProductName(null); setShowBakerFreezer(false); }}>
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-8 pt-7 pb-5 bg-gradient-to-br from-amber-50 via-amber-50/80 to-orange-50 border-b border-amber-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight">Baker Freezer</h2>
                  <p className="text-sm text-zinc-500 mt-1">Live baked products from the Baker account</p>
                </div>
                <button onClick={() => { setAcquiringProductName(null); setShowBakerFreezer(false); }} className="w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors">
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
                    needMap.set(findRecipeName(selectedDOS.product), selectedDOS.qty ?? 1);
                  }
                  const neededCount = acquiringProductName
                    ? (bakedProducts.some(bp => bp.productName === acquiringProductName) ? 1 : 0)
                    : [...needMap.keys()].filter(n => bakedProducts.some(bp => bp.productName === n)).length;
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
                          needMap.set(findRecipeName(selectedDOS.product), selectedDOS.qty ?? 1);
                        }
                      }
                      const needed = needMap.get(name) || 0;
                      const isNeeded = acquiringProductName ? name === acquiringProductName : needed > 0;
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
            <div className="px-8 py-4 border-t border-zinc-100 bg-zinc-50/50 flex gap-3">
              {acquiringProductName && (() => {
                const neededQty = promo && selectedDOS
                  ? (promo.items.find(pi => pi.productName === acquiringProductName)?.qty ?? 0) * (selectedDOS.qty ?? 1)
                  : 0;
                const availableStock = bakedProducts.filter(bp => bp.productName.toLowerCase() === acquiringProductName.toLowerCase()).reduce((s, bp) => s + bp.qty, 0);
                const canAcquire = availableStock >= neededQty;
                return (
                  <button
                    disabled={!canAcquire}
                    onClick={() => {
                      setAcquiredProducts(prev => { const n = new Set(prev); n.add(acquiringProductName); return n; });
                      const neededQty = promo && selectedDOS
                        ? (promo.items.find(pi => pi.productName === acquiringProductName)?.qty ?? 0) * (selectedDOS.qty ?? 1)
                        : 0;
                      const matchingItems = bakedProducts.filter(bp => bp.productName.toLowerCase() === acquiringProductName.toLowerCase() && bp.qty > 0);
                      let remaining = neededQty;
                      setSelectedFreezerItems(prev => {
                        const next = new Map(prev);
                        for (const bp of matchingItems) {
                          if (remaining <= 0) break;
                          const existing = next.get(bp.id);
                          const alreadyTaken = existing ? existing.qty : 0;
                          const batchAvail = bp.qty - alreadyTaken;
                          if (batchAvail <= 0) continue;
                          const take = Math.min(remaining, batchAvail);
                          if (existing) {
                            next.set(bp.id, { ...existing, qty: alreadyTaken + take });
                          } else {
                            next.set(bp.id, { item: bp, qty: take });
                          }
                          remaining -= take;
                        }
                        return next;
                      });
                      setAcquiringProductName(null);
                      setShowBakerFreezer(false);
                    }}
                    className={`flex-1 rounded-2xl py-3 text-sm font-semibold transition-colors ${canAcquire ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-zinc-200 text-zinc-400 cursor-not-allowed"}`}
                  >
                    {canAcquire ? "Confirm Acquisition" : "Insufficient Stock"}
                  </button>
                );
              })()}
              <button onClick={() => { setAcquiringProductName(null); setShowBakerFreezer(false); }} className={`${acquiringProductName ? "flex-1" : "w-full"} rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white py-3 text-sm font-semibold transition-colors`}>Close</button>
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
                  <p className="text-sm text-zinc-500 mt-1">Production Recipe from Deco</p>
                </div>
                <button onClick={() => setShowDecoFreezer(false)} className="w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-200/70 px-3 py-1 text-xs font-bold text-rose-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                  {decoProductionRecipes.length} items
                </span>
                <span className="text-xs text-zinc-400">Total: {decoProductionRecipes.reduce((s, i) => s + i.qty, 0)} pcs</span>
                {selectedDOS && (() => {
                  const needMap = new Map<string, number>();
                  if (promo) {
                    promo.items.forEach(pi => needMap.set(pi.productName, (needMap.get(pi.productName) || 0) + pi.qty * (selectedDOS.qty ?? 1)));
                  } else {
                    needMap.set(findRecipeName(selectedDOS.product), selectedDOS.qty ?? 1);
                  }
                  const neededCount = [...needMap.keys()].filter(n => decoProductionRecipes.some(bp => bp.productName === n)).length;
                  return neededCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">{neededCount} needed highlighted</span>
                  ) : null;
                })()}
              </div>
            </div>

            <div className="px-6 pt-2 pb-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <input value={decoFreezerSearch} onChange={e => setDecoFreezerSearch(e.target.value)} placeholder="Search production recipes..." className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all" />
                {decoFreezerSearch && <button onClick={() => setDecoFreezerSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {(() => {
                const filtered = decoProductionRecipes.filter(i => !decoFreezerSearch || i.productName.toLowerCase().includes(decoFreezerSearch.toLowerCase()));

                if (filtered.length === 0) {
                  return (
                    <div className="px-8 py-16 text-center">
                      <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                      </div>
                      <p className="text-base font-medium text-zinc-500">No Production Recipe items</p>
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
                          needMap.set(findRecipeName(selectedDOS.product), selectedDOS.qty ?? 1);
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

      {/* Inventory Usage Modal */}
      {showInventoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowInventoryModal(false)}>
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-8 pt-7 pb-5 bg-gradient-to-br from-emerald-50 via-emerald-50/80 to-teal-50 border-b border-emerald-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight">My Inventory</h2>
                  <p className="text-sm text-zinc-500 mt-1">Select ingredients and materials to use for this assembly</p>
                </div>
                <button onClick={() => setShowInventoryModal(false)} className="w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-200/70 px-3 py-1 text-xs font-bold text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {pastryAccessInventory.length} items
                </span>
                <span className="text-xs text-zinc-400">Select items to consume during assembly</span>
              </div>
            </div>
            <div className="px-6 pt-4 pb-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <input value={inventoryUsageSearch} onChange={e => setInventoryUsageSearch(e.target.value)} placeholder="Search inventory..." className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all" />
                {inventoryUsageSearch && <button onClick={() => setInventoryUsageSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {pastryAccessInventory.length === 0 ? (
                <div className="px-8 py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                  </div>
                  <p className="text-base font-medium text-zinc-500">No inventory items available</p>
                  <p className="text-sm text-zinc-400 mt-1">No items assigned to your inventory.</p>
                </div>
              ) : filteredInventory.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm text-zinc-500">No items matching "{inventoryUsageSearch}"</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {filteredInventory.map(item => {
                    const selected = selectedInventoryUsage.get(item.id);
                    const selectedQty = selected ? selected.qty : 0;
                    return (
                      <div key={item.id} className={`px-6 py-4 transition-all ${selectedQty > 0 ? "bg-emerald-50/80 border-l-4 border-l-emerald-400" : "hover:bg-zinc-50/50"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selectedQty > 0 ? "bg-emerald-400" : item.group === "ingredients" ? "bg-amber-100" : item.group === "packaging-materials" ? "bg-blue-100" : "bg-zinc-100"}`}>
                              <svg className={`w-5 h-5 ${selectedQty > 0 ? "text-white" : "text-zinc-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className={`text-sm font-bold truncate ${selectedQty > 0 ? "text-emerald-900" : "text-zinc-900"}`}>{item.name}</div>
                                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 capitalize">{item.category}</span>
                              </div>
                              <div className="text-xs text-zinc-400 mt-0.5">{item.group.replace("-", " ")} · {item.supplier || "No supplier"}</div>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-4 shrink-0 ml-4">
                            <div>
                              {selectedQty > 0 ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-lg font-extrabold font-mono text-zinc-400 line-through decoration-zinc-300">{item.onHand}</span>
                                  <svg className="w-4 h-4 text-emerald-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" /></svg>
                                  <span className="text-lg font-extrabold font-mono text-emerald-600 animate-in slide-in-from-right-1">{item.onHand - selectedQty}</span>
                                </div>
                              ) : (
                                <div className={`text-lg font-extrabold font-mono ${item.onHand <= 0 ? "text-red-500" : "text-zinc-900"}`}>{item.onHand}</div>
                              )}
                              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">{item.unit}</div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                const current = selectedQty;
                                if (current <= 1) {
                                  setSelectedInventoryUsage(prev => { const next = new Map(prev); next.delete(item.id); return next; });
                                } else {
                                  setSelectedInventoryUsage(prev => { const next = new Map(prev); next.set(item.id, { item, qty: current - 1 }); return next; });
                                }
                              }}
                              disabled={selectedQty <= 0}
                              className="w-8 h-8 rounded-lg border border-zinc-200 bg-zinc-50 text-lg font-bold text-zinc-500 hover:bg-zinc-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >&minus;</button>
                            <input
                              type="number"
                              min="0"
                              max={item.onHand}
                              value={selectedQty || ""}
                              onChange={e => {
                                const raw = e.target.value;
                                if (raw === "") {
                                  setSelectedInventoryUsage(prev => { const next = new Map(prev); next.delete(item.id); return next; });
                                  return;
                                }
                                const v = Number(raw);
                                if (isNaN(v)) return;
                                const clamped = Math.max(0, Math.min(v, item.onHand));
                                setSelectedInventoryUsage(prev => {
                                  const next = new Map(prev);
                                  if (clamped <= 0) { next.delete(item.id); }
                                  else { next.set(item.id, { item, qty: clamped }); }
                                  return next;
                                });
                              }}
                              className="w-16 text-center rounded-lg border border-zinc-200 px-2 py-1 text-sm font-semibold outline-none focus:border-emerald-400"
                            />
                            <button
                              onClick={() => {
                                const current = selectedQty;
                                if (current >= item.onHand) return;
                                setSelectedInventoryUsage(prev => { const next = new Map(prev); next.set(item.id, { item, qty: current + 1 }); return next; });
                              }}
                              disabled={selectedQty >= item.onHand}
                              className="w-8 h-8 rounded-lg border border-emerald-200 bg-emerald-50 text-lg font-bold text-emerald-600 hover:bg-emerald-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >+</button>
                          </div>
                          {selectedQty > 0 && (
                            <button
                              onClick={() => {
                                setSelectedInventoryUsage(prev => { const next = new Map(prev); next.delete(item.id); return next; });
                              }}
                              className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                            >Clear</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-8 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
              <span className="text-sm text-zinc-500">
                {selectedInventoryUsage.size > 0
                  ? `${selectedInventoryUsage.size} item${selectedInventoryUsage.size !== 1 ? "s" : ""} selected`
                  : "No items selected"}
              </span>
              <button onClick={() => setShowInventoryModal(false)} className="rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white px-8 py-3 text-sm font-semibold transition-colors">
                {selectedInventoryUsage.size > 0 ? "Done" : "Close"}
              </button>
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
      <div className="space-y-5">
        <div className="rounded-3xl bg-white p-8 shadow-lg border border-zinc-200">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-[36px] font-bold tracking-tight text-zinc-900">Freezer</h1>
              <p className="mt-2 text-[15px] text-zinc-500">Your assembled packages and component stock.</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 rounded-2xl bg-zinc-100 p-1.5">
          <button onClick={() => setFreezerTab("assembled")} className={`flex-1 rounded-xl py-3 text-[14px] font-semibold transition-all ${freezerTab === "assembled" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>Assembled Packages</button>
          <button onClick={() => setFreezerTab("components")} className={`flex-1 rounded-xl py-3 text-[14px] font-semibold transition-all ${freezerTab === "components" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>Component Stock</button>
          <button onClick={() => setFreezerTab("my-inventory")} className={`flex-1 rounded-xl py-3 text-[14px] font-semibold transition-all ${freezerTab === "my-inventory" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>My Inventory</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[{ tab: "assembled", label: "Assembled Packages", count: assembledItems.length },
            { tab: "components", label: "Component Stock", count: componentItems.length },
            { tab: "my-inventory", label: "My Inventory", count: pastryAccessInventory.length }
          ].map(({ tab, label, count }) => (
            <button key={tab} onClick={() => setFreezerTab(tab as "assembled" | "components" | "my-inventory")} className={`rounded-2xl border p-5 text-left transition-all hover:shadow-md ${freezerTab === tab ? "bg-amber-50 border-amber-300" : "bg-white border-zinc-200 hover:border-zinc-300"}`}>
              <div className="text-[12px] text-zinc-400 uppercase tracking-wider font-semibold">{label}</div>
              <div className="text-[28px] font-bold text-zinc-900 mt-2">{count}</div>
            </button>
          ))}
        </div>

        <div className="relative max-w-[280px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px]">⌕</span>
          <input value={freezerSearch} onChange={e => setFreezerSearch(e.target.value)} placeholder="Search products..." className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-2.5 text-[13px] focus:outline-none focus:border-zinc-400" />
        </div>

        {freezerTab === "my-inventory" ? (
          <div className="rounded-[24px] border border-rose-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-rose-50/60 border-b border-rose-100">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-rose-700">My Inventory</span>
                <span className="ml-2 text-[10px] text-rose-600">({pastryAccessInventory.length})</span>
              </div>
              <button onClick={() => { setAddPastryProduct(""); setAddPastrySize(""); setAddPastryQty(""); setShowAddPastryProduct(true); }} className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-rose-700 transition-colors">+ Add</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr className="text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                    <th className="px-5 py-3">Ingredient</th>
                    <th className="px-5 py-3 text-right">On Hand</th>
                    <th className="px-5 py-3">Unit</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {pastryAccessInventory.filter(i => !freezerSearch || i.name.toLowerCase().includes(freezerSearch.toLowerCase())).length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-[13px] text-zinc-400">No ingredients assigned to Pastry.</td></tr>
                  ) : pastryAccessInventory.filter(i => !freezerSearch || i.name.toLowerCase().includes(freezerSearch.toLowerCase())).map(item => (
                    <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-5 py-3.5"><div className="text-[13px] font-medium text-zinc-900">{item.name}</div></td>
                      <td className="px-5 py-3.5 text-[13px] text-right font-mono">{item.onHand}</td>
                      <td className="px-5 py-3.5 text-[13px] text-zinc-500">{item.unit}</td>
                      <td className="px-5 py-3.5 text-[13px] text-zinc-500 capitalize">{item.category}</td>
                      <td className="px-5 py-3.5 text-[13px] text-zinc-500">{item.supplier || "\u2014"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (() => {
          const items = filtered as FreezerItem[];
          const grouped = new Map<string, { items: FreezerItem[]; totalQty: number }>();
          items.forEach(f => {
            if (!grouped.has(f.productName)) grouped.set(f.productName, { items: [], totalQty: 0 });
            const g = grouped.get(f.productName)!;
            g.items.push(f);
            g.totalQty += f.qty;
          });
          const tabLabel = freezerTab === "assembled" ? "Assembled Packages" : "Component Stock";
          return (
            <div className="rounded-[24px] border border-rose-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-rose-50/60 border-b border-rose-100">
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-rose-700">{tabLabel}</span>
                  <span className="ml-2 text-[10px] text-rose-600">({items.length})</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 border-b border-zinc-100">
                    <tr className="text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                      <th className="px-5 py-3">Product</th>
                      <th className="px-5 py-3 text-right">Qty</th>
                      <th className="px-5 py-3">Unit</th>
                      <th className="px-5 py-3">Date Added</th>
                      <th className="px-5 py-3 text-center">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {grouped.size === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-zinc-400">No items in this section.</td></tr>
                    ) : [...grouped.entries()].map(([productName, g]) => (
                      <tr key={productName} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="text-[13px] font-medium text-zinc-900">{productName}</div>
                          {g.items[0]?.size && <div className="text-[11px] text-zinc-400 mt-0.5">Size: {g.items[0].size}</div>}
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-right font-mono">{g.totalQty}</td>
                        <td className="px-5 py-3.5 text-[13px] text-zinc-500">{g.items[0]?.unit || "pcs"}</td>
                        <td className="px-5 py-3.5 text-[12px] text-zinc-500">{g.items[0]?.dateProduced || "\u2014"}</td>
                        <td className="px-5 py-3.5 text-center"><span className="text-[11px] font-medium text-emerald-600">✓ In Stock</span></td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => { setEditingFreezerItem(g.items[0]); setShowEditFreezer(true); }} className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">Edit</button>
                            <button onClick={() => { if (confirm(`Delete ALL batches of ${productName}?`)) { const ids = new Set(g.items.map(x => x.id)); const updated = freezerItems.filter(f => !ids.has(f.id)); onUpdateFreezer?.(updated); ids.forEach(id => db.deleteFreezerItem(id).catch(console.error)); } }} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Del</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

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
                <button onClick={() => {
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
                }} className="flex-1 rounded-xl bg-zinc-900 py-3 text-base font-medium text-white hover:bg-zinc-800 transition-all">Add to Freezer</button>
              </div>
            </div>
          </div>
        )}

        {showAddPastryProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddPastryProduct(false)}>
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-[18px] font-semibold mb-4">Add to Freezer</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Product</label>
                  <select value={addPastryProduct} onChange={e => setAddPastryProduct(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400">
                    <option value="">Select product...</option>
                    {productCatalog.filter(p => productCategoryMap[p] === "Freezer Pastry").map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Size</label>
                  <select value={addPastrySize} onChange={e => setAddPastrySize(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400">
                    <option value="">No size</option>
                    {["Small","Regular","Large","6x1","6x2","6x3","8x1","8x2","8x3","10x1","10x2","10x3","12x1","12x2","14x1","14x2","16x1","Sheet"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Qty</label>
                  <input type="number" min="1" value={addPastryQty} onChange={e => setAddPastryQty(e.target.value)} placeholder="0" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] font-mono outline-none focus:border-zinc-400" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowAddPastryProduct(false)} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button disabled={!addPastryProduct || !addPastryQty} onClick={() => {
                  const item: FreezerItem = {
                    id: `FRZ-${Date.now()}`,
                    productName: addPastryProduct.trim(),
                    qty: Number(addPastryQty),
                    unit: "pcs",
                    batchRef: `BATCH-${Date.now()}`,
                    producedBy: "pastry",
                    dateProduced: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0],
                    status: "stored",
                    notes: addPastrySize ? `Size: ${addPastrySize}` : "",
                    size: addPastrySize || undefined,
                  };
                  onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, item]);
                  db.upsertFreezerItems([item]).catch(console.error);
                  setShowAddPastryProduct(false);
                  setAddPastryProduct(""); setAddPastrySize(""); setAddPastryQty("");
                }} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-[13px] font-medium text-white hover:bg-rose-700 disabled:opacity-40">Add Item</button>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredActive.map(promo => renderPromoCard(promo, "active"))}
                  </div>
                </div>
              )}

              {filteredOutOfRange.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-amber-700 mb-5">Upcoming / Expired Dates</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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


      </>
    );
  }

  return null;
}

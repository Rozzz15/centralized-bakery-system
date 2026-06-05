import { useEffect, useState, Fragment } from "react";
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
  { id: "dos", label: "DOS" },
  { id: "produce", label: "Produce" },
  { id: "withdraw", label: "Withdraw Ingredients" },
  { id: "freezer", label: "Save to Freezer" },
];

export default function BakerDashboard({ production, dosItems, onCompleteTask, activeTab, productCatalog, recipes, newDOSIds, onMarkDOSSeen, freezerItems = [], onUpdateFreezer, freezerHistory = [], inventory = [], onUpdateInventory }: Props) {
  const [step, setStep] = useState(0);
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
  const [bakedCompleted, setBakedCompleted] = useState<Set<string>>(new Set());
  const [withdrawnQtys, setWithdrawnQtys] = useState<Record<string, Record<string, number>>>({});

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
  const decoProductionItems = freezerItems.filter(i => i.producedBy === "deco" && i.status === "stored" && i.notes?.startsWith("Production Recipe"));

  const bakerDOS = todayDOS;
  const decoProductSet = new Set(decoProductionItems.map(i => i.productName));
  // Total DOS qty per product (for display)
  const dosQtyMap = new Map<string, number>();
  bakerDOS.forEach(d => { dosQtyMap.set(d.product, (dosQtyMap.get(d.product) || 0) + d.qty); });

  // Only show products that exist in BOTH DOS and Deco Production Recipe
  // Baker bakes the Deco PR qty; DOS remaining = DOS - Deco PR
  const myTasks = (() => {
    const seen = new Set<string>();
    return bakerDOS
      .filter(d => decoProductSet.has(d.product) && !seen.has(d.product) && seen.add(d.product))
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

      // Save filling to freezer
      const item: FreezerItem = {
        id: `FRZ-${Date.now()}`,
        productName: fillingName.trim(),
        qty: batchQty,
        unit: "batches",
        batchRef: `BATCH-${Date.now()}`,
        producedBy: "baker",
        dateProduced: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0],
        status: "stored",
        notes: "Filling",
      };
      onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, item]);
      db.upsertFreezerItems([item]).catch(console.error);
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
    const bakerItems = freezerItems.filter(i => i.producedBy === "baker" && i.status === "stored");
    const bakerAccessInventory = inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("baker"));
    const decoItems = freezerItems.filter(i => i.producedBy === "deco" && i.status === "stored");

    const tabItems = freezerTab === "baked-products" ? bakerItems : freezerTab === "my-inventory" ? bakerAccessInventory : decoItems;
    const filtered = tabItems.filter(i => !freezerSearch || i.productName.toLowerCase().includes(freezerSearch.toLowerCase()));

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
                ) : filtered.map(item => {
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
        <p className="mt-1 text-[13px] text-zinc-500">Bake what the DOS says — nothing more, nothing less.</p>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((s, i) => {
          const canClick = i <= step + 1;
          return (
          <button key={s.id} onClick={() => canClick && setStep(i)} disabled={!canClick} className={`flex items-center gap-2.5 rounded-full px-5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-all ${i === step ? "bg-zinc-900 text-white shadow-sm" : i < step ? "bg-emerald-100 text-emerald-700" : "bg-zinc-50 text-zinc-300 cursor-not-allowed"}`}>
            <span className={`grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold ${i === step ? "bg-white/20" : i < step ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-300"}`}>{i < step ? "✓" : i + 1}</span>
            {s.label}
          </button>
          );
        })}
      </div>

      <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-6 shadow-sm">
        {step === 0 && (
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[21px] font-semibold">Your DOS Orders</h2>
                <p className="mt-1 text-[13px] text-zinc-500">Admin assigned these items for you to bake. Deco items are hidden — focus on your section.</p>
              </div>
  
            </div>
            {bakerDOS.length === 0 ? (
              <div className="mt-8 text-center py-8"><p className="text-[14px] text-zinc-400">No baking orders yet.</p><p className="text-[12px] text-zinc-400 mt-1">Wait for Admin to create a DOS.</p></div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-700 bg-zinc-800 text-left text-[11px] font-medium text-zinc-300 uppercase tracking-wider">
                      <th className="w-8 px-3 py-2.5"></th>
                      <th className="px-2 py-2.5">Product</th>
                      <th className="px-2 py-2.5">Priority</th>
                      <th className="px-2 py-2.5 text-right">Total</th>

                      <th className="w-14 px-3 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bakerDOS.map(d => {
                      const recipe = recipes.find(r => r.productName === d.product);
                      const hasIngredients = recipe && recipe.ingredients.length > 0;
                      const isExpanded = expandedDOS.has(d.id);
                      const pColor = d.priority === "HIGH" ? "bg-red-100 text-red-700" : d.priority === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600";
                      const sDot = d.status === "completed" ? "bg-emerald-500" : d.status === "in-progress" ? "bg-amber-500" : "bg-zinc-300";
                      return (
                        <Fragment key={d.id}>
                          <tr className={`border-b border-zinc-700 text-[13px] transition-colors ${hasIngredients ? "cursor-pointer hover:bg-zinc-800/60" : ""}`} onClick={() => hasIngredients && toggleDOS(d.id)}>
                            <td className="px-3 py-2.5 text-zinc-500 text-[10px] text-center">{hasIngredients ? (isExpanded ? "▾" : "▸") : ""}</td>
                            <td className="px-2 py-2.5 font-medium text-white">{d.product} {newDOSIds?.has(d.id) && <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-800 px-1.5 py-0.5 text-[9px] font-bold text-blue-200 uppercase tracking-wider">New</span>}</td>
                            <td className="px-2 py-2.5"><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${pColor}`}>{d.priority}</span></td>
                            <td className="px-2 py-2.5 text-right font-mono text-white">{d.qty}</td>

                            <td className="px-3 py-2.5 text-right"><span className={`inline-block h-2 w-2 rounded-full ${sDot}`} /></td>
                          </tr>
                          {isExpanded && hasIngredients && (
                            <tr key={`${d.id}-ing`}>
                              <td colSpan={5} className="px-3 pb-2.5 pt-0 bg-zinc-800/60">
                                <div className="flex flex-wrap items-center gap-1.5 pl-7">
                                  <span className="text-[10px] font-medium text-zinc-400 uppercase mr-0.5">Ingredients:</span>
                                  {recipe!.ingredients.map((ing, i) => (
                                    <span key={i} className="rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">{ing.name} x{ing.qtyPerBatch}{ing.unit}</span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-700 bg-zinc-800 text-[13px] font-semibold text-white">
                      <td colSpan={3} className="px-3 py-2.5">Total</td>
                      <td className="px-2 py-2.5 text-right font-mono">{bakerDOS.reduce((s, d) => s + d.qty, 0)}</td>

                      <td className="px-3 py-2.5" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {bakerScheduled.length > 0 && (() => {
              const byDate = new Map<string, DOSItem[]>();
              bakerScheduled.forEach(i => { const d = i.scheduledDate || "unknown"; if (!byDate.has(d)) byDate.set(d, []); byDate.get(d)!.push(i); });
              return (
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
            })()}
            <div className="mt-4 flex justify-end">
              <button onClick={() => setStep(1)} className="rounded-xl bg-zinc-900 px-4 py-2 sm:px-6 sm:py-3 text-[14px] font-medium text-white hover:bg-zinc-800">Next →</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><h2 className="text-[21px] font-semibold">Production</h2><span className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[10px] font-medium text-emerald-700">Live</span></span><p className="mt-1 text-[13px] text-zinc-500">Select products and specify how many to bake for this batch.</p></div>
              {releasedReqs.length > 0 && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200">✓ Stock ready</span>}
            </div>
            {myTasks.length === 0 ? (
              <div className="mt-8 text-center py-8"><p className="text-[14px] text-zinc-400">No tasks assigned.</p></div>
            ) : (
              <div className="mt-4 space-y-3">
                {myTasks.map(task => {
                  if (bakedCompleted.has(task.id) || task.status === "completed") return null;
                  const isSelected = selectedForBaking.has(task.id);
                  const dosQty = dosQtyMap.get(task.product) || 0;
                  const alreadyBaked = task.completed;
                  const decoQty = task.target;
                  const bakeTarget = Math.min(decoQty, Math.max(0, dosQty - alreadyBaked));
                  const remaining = Math.max(0, dosQty - alreadyBaked - bakeTarget);
                  const maxBake = Math.max(0, bakeTarget);
                  const bakeQty = bakerBakeQty[task.id] ?? Math.max(0, maxBake);
                  const pct = dosQty > 0 ? Math.round(((alreadyBaked + bakeTarget) / dosQty) * 100) : 0;
                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        setSelectedForBaking(prev => {
                          const n = new Set(prev);
                          if (n.has(task.id)) n.delete(task.id); else n.add(task.id);
                          return n;
                        });
                        // Initialize bake qty to max when first selected
                        setBakerBakeQty(prev => {
                          if (prev[task.id] === undefined) return { ...prev, [task.id]: bakeTarget };
                          return prev;
                        });
                      }}
                      className={`rounded-2xl border p-4 transition-all cursor-pointer ${isSelected ? "border-zinc-900 bg-zinc-50/60 shadow-sm" : "border-zinc-200 bg-white hover:border-zinc-300"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"}`}>
                              {isSelected && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className="text-[15px] font-medium text-zinc-900">{task.product}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${task.status === "in-progress" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>{task.status}</span>
                          </div>
                          {/* DOS / Deco / Remaining summary */}
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
                            <span className="text-zinc-500">DOS: <strong className="text-zinc-800">{dosQty}</strong> pcs</span>
                            <span className="text-rose-600">Deco PR: <strong>{decoQty}</strong> pcs</span>
                            <span className="text-zinc-500">Already baked: <strong className="text-zinc-800">{alreadyBaked}</strong> pcs</span>
                            <span className="text-amber-600">After baking: <strong>{remaining}</strong> pcs remaining</span>
                          </div>
                          <div className="mt-3"><div className="h-2 rounded-full bg-zinc-100"><div className="h-full rounded-full bg-stone-500" style={{ width: `${pct}%` }} /></div></div>
                        </div>
                      </div>
                      {/* Input row */}
                      <div className="mt-3 flex items-center gap-2.5">
                        <label className="text-[12px] text-zinc-600 font-medium">Bake this batch:</label>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={e => { e.stopPropagation(); setBakerBakeQty(prev => ({ ...prev, [task.id]: Math.max(1, (prev[task.id] ?? 1) - 1) })); }}
                            className="w-7 h-7 rounded-lg border border-zinc-200 bg-white text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 flex items-center justify-center"
                          >−</button>
                          <input
                            type="number"
                            min={1}
                            max={bakeTarget}
                            value={bakeQty}
                            onClick={e => e.stopPropagation()}
                            onChange={e => {
                              const v = Math.min(bakeTarget, Math.max(1, Number(e.target.value) || 1));
                              setBakerBakeQty(prev => ({ ...prev, [task.id]: v }));
                              if (!selectedForBaking.has(task.id)) {
                                setSelectedForBaking(prev => new Set(prev).add(task.id));
                              }
                            }}
                            className="w-16 text-center rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[13px] font-mono font-semibold outline-none focus:border-zinc-400"
                          />
                          <button
                            onClick={e => { e.stopPropagation(); setBakerBakeQty(prev => ({ ...prev, [task.id]: Math.min(bakeTarget, (prev[task.id] ?? 1) + 1) })); }}
                            className="w-7 h-7 rounded-lg border border-zinc-200 bg-white text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 flex items-center justify-center"
                          >+</button>
                        </div>
                        <span className="text-[12px] text-zinc-400 font-mono">/ {bakeTarget}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={selectedForBaking.size === 0}
                className="rounded-xl bg-zinc-900 px-4 py-2 sm:px-6 sm:py-3 text-[14px] font-medium text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="flex items-center justify-between">
              <div><h2 className="text-[21px] font-semibold">Withdraw Ingredients</h2><p className="mt-1 text-[13px] text-zinc-500">Pull ingredients from your My Inventory for the selected products. Quantities are deducted when you withdraw.</p></div>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600 font-mono">{selectedForBaking.size} product{selectedForBaking.size > 1 ? "s" : ""}</span>
            </div>

            {(() => {
              const selectedTasks = myTasks.filter(t => selectedForBaking.has(t.id));
              if (selectedTasks.length === 0) {
                return (
                  <div className="mt-6 text-center py-8">
                    <p className="text-[14px] text-zinc-400">No products selected. Go back to Step 1 to select products.</p>
                  </div>
                );
              }
              const bakerInventory = inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("baker"));

              return (
                <div className="mt-4 space-y-6">
                  {selectedTasks.map(task => {
                    const recipe = recipes.find(r => r.productName === task.product);
                    if (!recipe || recipe.ingredients.length === 0) {
                      return (
                        <div key={task.id} className="rounded-2xl border border-zinc-200 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[15px] font-medium text-zinc-900">{task.product}</span>
                            <span className="text-[12px] text-zinc-400 font-mono">×{bakerBakeQty[task.id] || 1}</span>
                          </div>
                          <p className="text-[13px] text-zinc-400">No recipe ingredients defined for this product.</p>
                        </div>
                      );
                    }
                    const batchQty = bakerBakeQty[task.id] || 1;
                    return (
                      <div key={task.id} className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
                        <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[15px] font-semibold text-zinc-900">{task.product}</span>
                            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-700 font-mono">×{batchQty}</span>
                            <span className="text-[12px] text-zinc-400">batch{batchQty > 1 ? "es" : ""}</span>
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          {/* Recipe Ingredients */}
                          <div className="space-y-2">
                            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Recipe Ingredients Needed</div>
                            {recipe.ingredients.map((ing, i) => {
                              const totalNeeded = ing.qtyPerBatch * batchQty;
                              const invItem = bakerInventory.find(ii => ii.name === ing.name);
                              const withdrawnSoFar = withdrawnQtys[task.id]?.[ing.name] || 0;

                              return (
                                <div key={i} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[13px] font-medium text-zinc-800">{ing.name}</span>
                                      <span className="text-[11px] text-zinc-400">{ing.unit}</span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-[11px]">
                                      <span className="text-zinc-500">Needed: <strong className="text-zinc-800">{totalNeeded}</strong> {ing.unit}</span>
                                      <span className="text-emerald-600">Withdrawn: <strong>{withdrawnSoFar}</strong> {ing.unit}</span>
                                      {invItem && (
                                        <span className="text-zinc-500">Available: <strong className={invItem.onHand >= totalNeeded - withdrawnSoFar ? "text-emerald-600" : "text-amber-600"}>{invItem.onHand}</strong> {ing.unit}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      onClick={() => {
                                        const current = withdrawnQtys[task.id]?.[ing.name] || 0;
                                        const newWithdrawn = Math.max(0, current - 1);
                                        setWithdrawnQtys(prev => {
                                          const taskPrev = { ...(prev[task.id] || {}) };
                                          if (newWithdrawn <= 0) delete taskPrev[ing.name];
                                          else taskPrev[ing.name] = newWithdrawn;
                                          return { ...prev, [task.id]: taskPrev };
                                        });
                                        // Restore to My Inventory
                                        if (invItem) {
                                          db.updateInventoryItem(invItem.id, { onHand: invItem.onHand + 1 }).catch(console.error);
                                          onUpdateInventory?.(prev => prev.map(ii => ii.id === invItem.id ? { ...ii, onHand: ii.onHand + 1 } : ii));
                                        }
                                      }}
                                      disabled={(withdrawnQtys[task.id]?.[ing.name] || 0) <= 0}
                                      className="w-7 h-7 rounded-lg border border-zinc-200 bg-white text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 flex items-center justify-center disabled:opacity-30"
                                    >−</button>
                                    <span className="w-10 text-center font-mono text-[13px] font-semibold text-zinc-900">{withdrawnQtys[task.id]?.[ing.name] || 0}</span>
                                    <button
                                      onClick={() => {
                                        const current = withdrawnQtys[task.id]?.[ing.name] || 0;
                                        const maxAvail = invItem ? invItem.onHand : 0;
                                        if (current >= maxAvail) return;
                                        const newWithdrawn = Math.min(maxAvail, current + 1);
                                        setWithdrawnQtys(prev => ({
                                          ...prev,
                                          [task.id]: { ...(prev[task.id] || {}), [ing.name]: newWithdrawn }
                                        }));
                                        // Deduct from My Inventory
                                        if (invItem) {
                                          db.updateInventoryItem(invItem.id, { onHand: Math.max(0, invItem.onHand - 1) }).catch(console.error);
                                          onUpdateInventory?.(prev => prev.map(ii => ii.id === invItem.id ? { ...ii, onHand: Math.max(0, ii.onHand - 1) } : ii));
                                        }
                                      }}
                                      disabled={!invItem || invItem.onHand <= 0}
                                      className="w-7 h-7 rounded-lg border border-zinc-200 bg-white text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 flex items-center justify-center disabled:opacity-30"
                                    >+</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Withdraw all helper */}
                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => {
                                recipe.ingredients.forEach(ing => {
                                  const totalNeeded = ing.qtyPerBatch * batchQty;
                                  const invItem = bakerInventory.find(ii => ii.name === ing.name);
                                  if (invItem) {
                                    const currentWithdrawn = withdrawnQtys[task.id]?.[ing.name] || 0;
                                    const remainingToWithdraw = Math.min(totalNeeded, invItem.onHand) - currentWithdrawn;
                                    if (remainingToWithdraw > 0) {
                                      const newWithdrawn = currentWithdrawn + remainingToWithdraw;
                                      setWithdrawnQtys(prev => ({
                                        ...prev,
                                        [task.id]: { ...(prev[task.id] || {}), [ing.name]: newWithdrawn }
                                      }));
                                      db.updateInventoryItem(invItem.id, { onHand: Math.max(0, invItem.onHand - remainingToWithdraw) }).catch(console.error);
                                      onUpdateInventory?.(prev => prev.map(ii => ii.id === invItem.id ? { ...ii, onHand: Math.max(0, ii.onHand - remainingToWithdraw) } : ii));
                                    }
                                  }
                                });
                              }}
                              disabled={recipe.ingredients.every(ing => {
                                const invItem = bakerInventory.find(ii => ii.name === ing.name);
                                return !invItem || invItem.onHand <= 0;
                              })}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                            >Withdraw All Needed</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setStep(3)}
                disabled={Object.keys(withdrawnQtys).length === 0}
                className="rounded-xl bg-zinc-900 px-6 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
              >
                Proceed to Save to Freezer →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="flex items-center justify-between">
              <div><h2 className="text-[21px] font-semibold">Save to Freezer</h2><p className="mt-1 text-[13px] text-zinc-500">Save finished products to your Baked Products freezer and mark tasks as complete.</p></div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200">Ready to store</span>
            </div>

            {(() => {
              const selectedTasks = myTasks.filter(t => selectedForBaking.has(t.id));
              if (selectedTasks.length === 0) {
                return (
                  <div className="mt-6 text-center py-8">
                    <p className="text-[14px] text-zinc-400">No products to save.</p>
                  </div>
                );
              }

              const handleSaveToFreezer = () => {
                selectedTasks.forEach(task => {
                  const bakeQty = bakerBakeQty[task.id] || 1;
                  // Add to freezer as baked product
                  const newItem: FreezerItem = {
                    id: `FRZ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    productName: task.product,
                    qty: bakeQty,
                    unit: "pcs",
                    batchRef: `BATCH-${Date.now()}`,
                    producedBy: "baker",
                    dateProduced: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0],
                    status: "stored",
                    notes: `Baked batch from production`,
                  };
                  onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, newItem]);
                  db.upsertFreezerItems([newItem]).catch(console.error);

                  // Mark production task(s) as completed
                  const prodTasks = production.filter(p => p.product === task.product && p.assignedTo === "baker");
                  if (prodTasks.length > 0) {
                    prodTasks.forEach(pt => onCompleteTask(pt.id));
                  } else {
                    // Virtual task (no production record yet) — persist directly
                    db.upsertProduction([{
                      id: `PRD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      product: task.product,
                      target: task.target,
                      completed: Math.min(task.target, bakeQty),
                      assignedTo: "baker",
                      status: "completed",
                    }]).catch(console.error);
                  }
                  setBakedCompleted(prev => new Set(prev).add(task.id));
                });

                // Clear selection for completed items
                setSelectedForBaking(new Set());
                setBakerBakeQty({});
                setWithdrawnQtys({});
                setStep(1);
              };

              return (
                <div className="mt-4 space-y-3">
                  {selectedTasks.map(task => {
                    const bakeQty = bakerBakeQty[task.id] || 1;
                    const hasWithdrawn = withdrawnQtys[task.id] && Object.keys(withdrawnQtys[task.id]).length > 0;
                    return (
                      <div key={task.id} className="rounded-2xl border border-zinc-200 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-[15px] font-medium text-zinc-900">{task.product}</span>
                          <span className="text-[13px] text-zinc-500 font-mono">×{bakeQty}</span>
                          {hasWithdrawn ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">✓ Ingredients withdrawn</span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">⚠ No ingredients withdrawn</span>
                          )}
                        </div>
                        <span className="text-[12px] text-zinc-400">will be saved to Baked Products in Freezer</span>
                      </div>
                    );
                  })}
                  <button
                    onClick={handleSaveToFreezer}
                    className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-[14px] font-semibold text-white hover:bg-emerald-700 shadow-sm transition-all"
                  >
                    Save to Baked Products Freezer & Mark Complete ({selectedTasks.reduce((s, t) => s + (bakerBakeQty[t.id] || 1), 0)} pcs)
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-100">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="rounded-xl border border-zinc-300 px-4 py-2 sm:px-6 sm:py-3 text-[14px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed">← Back</button>
          <div className="text-[14px] text-zinc-400">Step {step + 1} of {steps.length}</div>
          <div className="w-24" />
        </div>
      </div>
    </div>
  );
}
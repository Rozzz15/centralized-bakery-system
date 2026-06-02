import { useEffect, useState, Fragment } from "react";
import type { ProductionTask, DOSItem, BakerIngredientRequest, ProductRecipe, FreezerItem, FreezerHistory } from "../types";
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
};

const steps = [
  { id: "dos", label: "DOS" },
  { id: "produce", label: "Produce" },
  { id: "freezer", label: "Store to Freezer" },
];

export default function BakerDashboard({ production, dosItems, onCompleteTask, activeTab, productCatalog, recipes, newDOSIds, onMarkDOSSeen, freezerItems = [], onUpdateFreezer, freezerHistory = [] }: Props) {
  const [step, setStep] = useState(0);
  const [ingredientReqs, setIngredientReqs] = useState<BakerIngredientRequest[]>([]);
  const [sent, setSent] = useState(false);
  const [expandedDOS, setExpandedDOS] = useState<Set<string>>(new Set());
  const toggleDOS = (id: string) => setExpandedDOS(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [expandedSched, setExpandedSched] = useState<Set<string>>(new Set());
  const toggleSched = (date: string) => setExpandedSched(prev => { const n = new Set(prev); if (n.has(date)) n.delete(date); else n.add(date); return n; });

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
  const [freezerTab, setFreezerTab] = useState<"products" | "history">("products");

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
    const ts = d.id.match(/DOS-(\d+)/)?.[1];
    if (!ts) return true;
    const itemDate = new Date(Number(ts)).toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    const todayStr = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    return itemDate === todayStr;
  });
  const bakerTaskProducts = new Set(production.filter(p => p.assignedTo === "baker").map(t => t.product));
  const bakerDOS = todayDOS.filter(d => bakerTaskProducts.has(d.product));
  const bakerProducts = new Set(bakerDOS.map(d => d.product));
  const myTasks = production.filter(p => p.assignedTo === "baker" && bakerProducts.has(p.product));
  const tomorrowStr = (() => { const t = new Date(); t.setDate(t.getDate() + 1); return t.toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0]; })();
  const allBakerTasks = production.filter(p => p.assignedTo === "baker");
  const bakerScheduled = dosItems.filter(d => d.status === "scheduled" && d.scheduledDate === tomorrowStr && allBakerTasks.some(t => t.product === d.product));
  const allDone = myTasks.length > 0 && myTasks.every(t => t.status === "completed");
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
  const handleSendToKitchen = () => { myTasks.forEach(t => onCompleteTask(t.id)); setSent(true); };

  /* ── Freezer Tab ── */
  if (activeTab === "freezer") {
    const myFreezer = freezerItems.filter(i => i.producedBy === "baker");
    const stored = myFreezer.filter(i => i.status === "stored");
    const filtered = myFreezer.filter(i => !freezerSearch || i.productName.toLowerCase().includes(freezerSearch.toLowerCase()));

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

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div><h1 className="text-[24px] font-semibold">Freezer — Finished Products</h1><p className="mt-1 text-[13px] text-zinc-600">Track baked products ready for dispatch.</p></div>
          <button onClick={() => setShowAddFreezer(true)} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Add Product</button>
        </div>

        <div className="flex gap-1.5 rounded-xl bg-zinc-100 p-1">
          <button onClick={() => setFreezerTab("products")} className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all ${freezerTab === "products" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>Products</button>
          <button onClick={() => setFreezerTab("history")} className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all ${freezerTab === "history" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>History</button>
        </div>

        {freezerTab === "products" ? (<>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Products</div><div className="text-[24px] font-semibold mt-1">{stored.length}</div></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Total Qty</div><div className="text-[24px] font-semibold mt-1">{myFreezer.reduce((s, i) => s + i.qty, 0)} pcs</div></div>
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
                  <th className="px-5 py-3">Batch</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-zinc-400">No products in freezer.</td></tr>
                ) : filtered.map(item => (
                  <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-5 py-3.5"><div className="text-[13px] font-medium text-zinc-900">{item.productName}</div>{item.notes && <div className="text-[11px] text-zinc-400 mt-0.5">{item.notes}</div>}</td>
                    <td className="px-5 py-3.5 text-[13px] text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.qty} {item.unit}</td>
                    <td className="px-5 py-3.5 text-[12px] text-zinc-600" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.batchRef || "—"}</td>
                    <td className="px-5 py-3.5 text-[12px] text-zinc-500">{item.dateProduced}</td>
                    <td className="px-5 py-3.5 text-center"><span className="text-[11px] text-emerald-600 font-medium">✓ In Stock</span></td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => { setEditingFreezerItem(item); setShowEditFreezer(true); }} className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">Edit</button>
                        <button onClick={() => { if (confirm(`Delete ${item.productName}?`)) { const updated = freezerItems.filter(f => f.id !== item.id); onUpdateFreezer?.(updated); db.deleteFreezerItem(item.id).catch(console.error); } }} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>) : (
        <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
          <h2 className="text-[16px] font-semibold mb-3">Dispatch History</h2>
          {freezerHistory.filter(h => h.producedBy === "baker").length === 0 ? (
            <p className="text-[13px] text-zinc-400 text-center py-6">No history yet.</p>
          ) : (
            <div className="space-y-1.5">
              {freezerHistory.filter(h => h.producedBy === "baker").map(h => (
                <div key={h.id} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
                  <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-medium">{h.action}</span>
                  <span className="text-[13px] font-medium text-zinc-900">{h.productName}</span>
                  <span className="text-[12px] text-zinc-600" style={{ fontFamily: "Fragment Mono, monospace" }}>{h.qtyChanged} pcs</span>
                  <span className="text-[11px] text-zinc-400">{h.reference}</span>
                  <span className="ml-auto text-[11px] text-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }}>{h.timestamp}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

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
        {steps.map((s, i) => (
          <button key={s.id} onClick={() => setStep(i)} className={`flex items-center gap-2.5 rounded-full px-5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-all ${i === step ? "bg-zinc-900 text-white shadow-sm" : i < step ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>
            <span className={`grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold ${i === step ? "bg-white/20" : i < step ? "bg-emerald-600 text-white" : "bg-zinc-300 text-white"}`}>{i < step ? "✓" : i + 1}</span>
            {s.label}
          </button>
        ))}
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
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><h2 className="text-[21px] font-semibold">Production</h2><span className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[10px] font-medium text-emerald-700">Live</span></span><p className="mt-1 text-[13px] text-zinc-500">Bake the items. Mark each batch as you go.</p></div>
              {releasedReqs.length > 0 && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200">✓ Stock ready</span>}
            </div>
            {myTasks.length === 0 ? (
              <div className="mt-8 text-center py-8"><p className="text-[14px] text-zinc-400">No tasks assigned.</p></div>
            ) : (
              <div className="mt-4 space-y-3">
                {myTasks.map(task => {
                  const pct = Math.round((task.completed / task.target) * 100);
                  return (
                    <div key={task.id} className="rounded-2xl border border-zinc-200 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-medium">{task.product}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${task.status === "completed" ? "bg-emerald-100 text-emerald-700" : task.status === "in-progress" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>{task.status}</span>
                        </div>
                        <span className="text-[13px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{task.completed}/{task.target} pcs</span>
                      </div>
                      <div className="mt-3"><div className="h-2 rounded-full bg-zinc-100"><div className={`h-full rounded-full transition-all ${task.status === "completed" ? "bg-emerald-500" : "bg-stone-500"}`} style={{ width: `${pct}%` }} /></div></div>
                      <button onClick={() => onCompleteTask(task.id)} disabled={task.status === "completed"} className="mt-3 w-full rounded-xl bg-zinc-900 py-2 text-[13px] text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed">{task.status === "completed" ? "✓ Done" : "Mark Batch Done"}</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-[21px] font-semibold">Store to Freezer</h2>
            <p className="mt-1 text-[13px] text-zinc-500">Move finished products to the freezer for dispatch.</p>
            <div className="mt-6 text-center py-8">
              <p className="text-[14px] text-zinc-400">Go to the Freezer tab to manage your stored products.</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-100">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="rounded-xl border border-zinc-300 px-4 py-2 sm:px-6 sm:py-3 text-[14px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed">← Back</button>
          <div className="text-[14px] text-zinc-400">Step {step + 1} of {steps.length}</div>
          <button onClick={() => setStep(Math.min(steps.length - 1, step + 1))} disabled={step === steps.length - 1} className="rounded-xl bg-zinc-900 px-4 py-2 sm:px-6 sm:py-3 text-[14px] font-medium text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed">Next →</button>
        </div>
      </div>
    </div>
  );
}
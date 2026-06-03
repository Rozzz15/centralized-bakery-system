import { useState } from "react";
import type { ProductionTask, DOSItem, ProductRecipe, FreezerItem, FreezerHistory } from "../types";
import * as db from "../lib/db";

type Props = {
  production: ProductionTask[];
  dosItems: DOSItem[];
  activeTab: string;
  recipes: ProductRecipe[];
  freezerItems?: FreezerItem[];
  onUpdateFreezer?: (cb: FreezerItem[] | ((prev: FreezerItem[]) => FreezerItem[])) => void;
  freezerHistory?: FreezerHistory[];
};

const steps = [
  { id: "queue", label: "My Queue" },
  { id: "produce", label: "Produce" },
  { id: "done", label: "Completed" },
];

export default function PastryDashboard({ production, dosItems, activeTab, recipes, freezerItems = [], onUpdateFreezer, freezerHistory = [] }: Props) {
  const [step, setStep] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

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

  const myTasks = production.filter(t => t.assignedTo === "pastry");
  const pendingTasks = myTasks.filter(t => t.status === "pending" || t.status === "in-progress");
  const doneTasks = myTasks.filter(t => t.status === "completed" || completedIds.has(t.id));
  const activeTasks = step === 0 ? pendingTasks : step === 1 ? pendingTasks : doneTasks;

  const todayDOS = dosItems.filter(d => {
    if (d.status !== "in-progress" && d.status !== "pending") return false;
    const ts = d.id.match(/DOS-(\d+)/)?.[1];
    if (!ts) return true;
    const itemDate = new Date(Number(ts)).toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    const todayStr = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    return itemDate === todayStr;
  });

  const handleComplete = (taskId: string) => {
    setCompletedIds(prev => new Set(prev).add(taskId));
  };

  if (activeTab === "dashboard") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-[24px] font-semibold">Pastry Dashboard</h1>
            <p className="mt-1 text-[13px] text-zinc-600">Manage pastry production tasks and track completion.</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[11px] font-medium text-amber-700">Live</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">My Tasks</div>
            <div className="text-[24px] font-semibold mt-1">{myTasks.length}</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">In Progress</div>
            <div className="text-[24px] font-semibold mt-1 text-amber-600">{pendingTasks.filter(t => t.status === "in-progress").length}</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Completed</div>
            <div className="text-[24px] font-semibold mt-1 text-emerald-600">{doneTasks.length}</div>
          </div>
        </div>

        {/* Step Tabs */}
        <div className="flex gap-1.5 rounded-xl bg-zinc-100 p-1">
          {steps.map((s, i) => (
            <button key={s.id} onClick={() => setStep(i)} className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all ${step === i ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>{s.label}</button>
          ))}
        </div>

        {/* Task Cards */}
        <div className="space-y-3">
          {activeTasks.length === 0 ? (
            <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-8 text-center">
              <p className="text-[14px] text-zinc-400">No tasks here.</p>
            </div>
          ) : activeTasks.map(task => {
            const recipe = recipes.find(r => r.productName === task.product);
            const pct = task.target > 0 ? Math.round((task.completed / task.target) * 100) : 0;
            const isComplete = task.status === "completed" || completedIds.has(task.id);
            return (
              <div key={task.id} className="rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[15px] font-semibold text-zinc-900">{task.product}</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5" style={{ fontFamily: "Fragment Mono, monospace" }}>{task.id}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium border ${isComplete ? "bg-emerald-50 text-emerald-700 border-emerald-200" : task.status === "in-progress" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-zinc-50 text-zinc-600 border-zinc-200"}`}>{isComplete ? "completed" : task.status}</span>
                </div>

                {/* Progress */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="text-zinc-500">Progress</span>
                    <span className="font-medium text-zinc-700" style={{ fontFamily: "Fragment Mono, monospace" }}>{task.completed}/{task.target}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${isComplete ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>

                {/* Recipe Quick View */}
                {recipe && recipe.ingredients.length > 0 && (
                  <div className="mt-3 border-t border-zinc-100 pt-3">
                    <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Ingredients</div>
                    <div className="flex flex-wrap gap-1.5">
                      {recipe.ingredients.map((ing, i) => (
                        <span key={i} className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-600">{ing.name} ({ing.qtyPerBatch} {ing.unit})</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {!isComplete && (
                  <div className="mt-3 flex justify-end">
                    <button onClick={() => handleComplete(task.id)} className="rounded-xl bg-amber-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-amber-700 transition-all">Mark Complete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  

  if (activeTab === "queue") {
    return (
      <div className="space-y-5">
        <h1 className="text-[24px] font-semibold">Production Queue</h1>
        {todayDOS.length === 0 ? (
          <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-8 text-center">
            <p className="text-[14px] text-zinc-400">No items in the production queue.</p>
          </div>
        ) : (
          <div className="rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr className="text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-center">Priority</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {todayDOS.map(d => (
                  <tr key={d.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-5 py-3.5 text-[13px] font-medium text-zinc-900">{d.product}</td>
                    <td className="px-5 py-3.5 text-[13px] text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{d.qty}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${d.priority === "HIGH" ? "bg-red-100 text-red-700" : d.priority === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>{d.priority}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium border ${d.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : d.status === "in-progress" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-zinc-50 text-zinc-600 border-zinc-200"}`}>{d.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  /* ── Freezer Tab ── */
  if (activeTab === "freezer") {
    const myFreezer = freezerItems.filter(i => i.producedBy === "pastry");
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
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div><h1 className="text-[24px] font-semibold">Freezer — Finished Products</h1><p className="mt-1 text-[13px] text-zinc-600">Track pastry products ready for dispatch.</p></div>
          <button onClick={() => setShowAddFreezer(true)} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Add Product</button>
        </div>

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

        {freezerHistory.filter(h => h.producedBy === "pastry").length > 0 && (
          <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
            <h2 className="text-[16px] font-semibold mb-3">Dispatch History</h2>
            <div className="space-y-1.5">
              {freezerHistory.filter(h => h.producedBy === "pastry").map(h => (
                <div key={h.id} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
                  <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-medium">{h.action}</span>
                  <span className="text-[13px] font-medium text-zinc-900">{h.productName}</span>
                  <span className="text-[12px] text-zinc-600" style={{ fontFamily: "Fragment Mono, monospace" }}>{h.qtyChanged} pcs</span>
                  <span className="text-[11px] text-zinc-400">{h.reference}</span>
                  <span className="ml-auto text-[11px] text-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }}>{h.timestamp}</span>
                </div>
              ))}
            </div>
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
                    {["Pandesal", "Loaf Bread", "Choco Moist Cake", "Sponge Fudge", "Ensaymada", "Cupcake", "Brownies", "Cookies"].map(p => <option key={p} value={p}>{p}</option>)}
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
                    {["Pandesal", "Loaf Bread", "Choco Moist Cake", "Sponge Fudge", "Ensaymada", "Cupcake", "Brownies", "Cookies"].map(p => <option key={p} value={p}>{p}</option>)}
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

  return null;
}

import { useState, Fragment } from "react";
import type { DOSItem, ProductRecipe, FreezerItem, FreezerHistory, InventoryItem } from "../types";
import * as db from "../lib/db";

type Props = {
  dosItems: DOSItem[];
  activeTab: string;
  recipes: ProductRecipe[];
  newDOSIds?: Set<string>;
  onMarkDOSSeen?: (ids: string[]) => void;
  freezerItems?: FreezerItem[];
  onUpdateFreezer?: (cb: FreezerItem[] | ((prev: FreezerItem[]) => FreezerItem[])) => void;
  freezerHistory?: FreezerHistory[];
  inventory?: InventoryItem[];
  onUpdateInventory?: (cb: InventoryItem[] | ((prev: InventoryItem[]) => InventoryItem[])) => void;
};

const workflowSteps = [
  { id: "orders", label: "My Orders", icon: "📋" },
  { id: "prepare", label: "Check Ingredients", icon: "🧪" },
  { id: "produce", label: "Produce", icon: "🏭" },
  { id: "done", label: "Done", icon: "✅" },
];

export default function PastryDashboard({ dosItems, activeTab, recipes, newDOSIds, onMarkDOSSeen, freezerItems = [], onUpdateFreezer, freezerHistory = [], inventory = [] }: Props) {
  const [step, setStep] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [selectedDOS, setSelectedDOS] = useState<DOSItem | null>(null);
  const [producedCount, setProducedCount] = useState(0);
  const [expandedDOS, setExpandedDOS] = useState<Set<string>>(new Set());
  const toggleDOS = (id: string) => setExpandedDOS(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

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
  const [freezerTab, setFreezerTab] = useState<"finished" | "prepared" | "my-inventory">("finished");

  const todayDOS = dosItems.filter(d => {
    if (d.status === "scheduled") return false;
    if (d.scheduledDate && d.scheduledDate <= new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0]) return true;
    const ts = d.id.match(/DOS-(\d+)/)?.[1];
    if (!ts) return false;
    const itemDate = new Date(Number(ts)).toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    return itemDate === new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
  });

  const pastryDOS = todayDOS.filter(d => (d.roles ?? []).includes("pastry"));
  const pendingDOS = pastryDOS.filter(d => !completedIds.has(d.id) && d.status !== "completed");
  const doneDOS = pastryDOS.filter(d => completedIds.has(d.id) || d.status === "completed");

  const selectDOS = (item: DOSItem) => {
    setSelectedDOS(item);
    setProducedCount(0);
    setStep(1);
  };

  const handleStartProduce = () => {
    setProducedCount(0);
    setStep(2);
  };

  const handleCompleteTask = () => {
    if (selectedDOS) {
      setCompletedIds(prev => new Set(prev).add(selectedDOS.id));
      setSelectedDOS(null);
      setProducedCount(0);
      setStep(3);
    }
  };

  // Mark new DOS items as seen when viewing dashboard
  if (activeTab === "dashboard" && todayDOS.length > 0 && newDOSIds && onMarkDOSSeen) {
    const unseen = todayDOS.filter(d => newDOSIds.has(d.id));
    if (unseen.length > 0) onMarkDOSSeen(unseen.map(d => d.id));
  }

  if (activeTab === "dashboard") {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-[24px] font-semibold">My Tasks</h1>
            <p className="mt-1 text-[13px] text-zinc-600">Step-by-step pastry production workflow.</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[11px] font-medium text-amber-700">Live</span>
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2">
            {workflowSteps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 flex-1">
                <button onClick={() => { if (i <= step) setStep(i); }} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium transition-all flex-1 ${step === i ? "bg-amber-600 text-white shadow-md" : step > i ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-400"}`}>
                  <span className="text-[14px]">{s.icon}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < workflowSteps.length - 1 && <div className={`w-6 h-0.5 rounded-full shrink-0 ${step > i ? "bg-amber-400" : "bg-zinc-200"}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 0: My Orders */}
        {step === 0 && (
          <div className="space-y-5">
            {/* DOS Received */}
            <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[21px] font-semibold">Your DOS Orders</h2>
                  <p className="mt-1 text-[13px] text-zinc-500">Admin assigned these items for you to produce. Click a row to see ingredients.</p>
                </div>
              </div>
              {pastryDOS.length === 0 ? (
                <div className="mt-8 text-center py-8"><p className="text-[14px] text-zinc-400">No pastry orders yet.</p><p className="text-[12px] text-zinc-400 mt-1">Wait for Admin to create a DOS.</p></div>
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
                      {pastryDOS.map(d => {
                        const recipe = recipes.find(r => r.productName === d.product);
                        const hasIngredients = recipe && recipe.ingredients.length > 0;
                        const isExpanded = expandedDOS.has(d.id);
                        const pColor = d.priority === "HIGH" ? "bg-red-100 text-red-700" : d.priority === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600";
                        const sDot = d.status === "completed" ? "bg-emerald-500" : d.status === "in-progress" ? "bg-amber-500" : "bg-zinc-300";
                        return (
                          <Fragment key={d.id}>
                            <tr className={`border-b border-zinc-700 text-[13px] transition-colors cursor-pointer hover:bg-zinc-800/60`} onClick={() => { if (d.status !== "completed" && !completedIds.has(d.id)) { selectDOS(d); } else { toggleDOS(d.id); } }}>
                              <td className="px-3 py-2.5 text-zinc-500 text-[10px] text-center">{completedIds.has(d.id) || d.status === "completed" ? "✓" : "▸"}</td>
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
                        <td className="px-2 py-2.5 text-right font-mono">{pastryDOS.reduce((s, d) => s + d.qty, 0)}</td>
                        <td className="px-3 py-2.5" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 1: Check Ingredients */}
        {step === 1 && selectedDOS && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep(0)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all">← Back</button>
              <div>
                <h2 className="text-[18px] font-semibold text-zinc-900">Check Ingredients</h2>
                <p className="text-[12px] text-zinc-500">Verify all ingredients are available before producing.</p>
              </div>
            </div>

            {/* Task Summary */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-semibold text-zinc-900">{selectedDOS.product}</h3>
                  <p className="text-[12px] text-zinc-500 mt-0.5" style={{ fontFamily: "Fragment Mono, monospace" }}>{selectedDOS.id}</p>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Target</div>
                  <div className="text-[24px] font-bold text-amber-700" style={{ fontFamily: "Fragment Mono, monospace" }}>{selectedDOS.qty} pcs</div>
                </div>
              </div>
            </div>

            {/* Recipe Ingredients */}
            {(() => {
              const recipe = recipes.find(r => r.productName === selectedDOS.product);
              if (!recipe || recipe.ingredients.length === 0) {
                return (
                  <div className="rounded-[24px] border border-zinc-200 bg-white p-8 text-center">
                    <p className="text-[14px] text-zinc-400">No recipe found for this product.</p>
                    <p className="text-[12px] text-zinc-500 mt-1">Contact admin to set up the recipe.</p>
                  </div>
                );
              }
              const ingredientStatus = recipe.ingredients.map(ing => {
                const inv = inventory.find(i => i.id === ing.inventoryId);
                const available = inv ? inv.onHand : 0;
                const needed = ing.qtyPerBatch * selectedDOS.qty;
                const sufficient = available >= needed;
                return { ...ing, available, needed, sufficient, invName: inv?.name };
              });
              const allSufficient = ingredientStatus.every(i => i.sufficient);
              return (
                <div className="rounded-[24px] border border-zinc-200 bg-white shadow-sm overflow-hidden">
                  <div className="bg-zinc-50 border-b border-zinc-100 px-5 py-3 flex items-center justify-between">
                    <h3 className="text-[13px] font-semibold text-zinc-700 uppercase tracking-wider">Ingredient Checklist</h3>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${allSufficient ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {allSufficient ? "✓ All Ready" : "⚠ Missing Items"}
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {ingredientStatus.map((ing, i) => (
                      <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ing.sufficient ? "bg-emerald-100" : "bg-red-100"}`}>
                          <span className={`text-[14px] ${ing.sufficient ? "text-emerald-600" : "text-red-600"}`}>{ing.sufficient ? "✓" : "✗"}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-zinc-900">{ing.name}</div>
                          <div className="text-[11px] text-zinc-500">{ing.invName || ing.name}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[12px] text-zinc-500">Needed: <span className="font-medium text-zinc-700" style={{ fontFamily: "Fragment Mono, monospace" }}>{ing.needed} {ing.unit}</span></div>
                          <div className="text-[12px] text-zinc-500">Available: <span className={`font-medium ${ing.sufficient ? "text-emerald-600" : "text-red-600"}`} style={{ fontFamily: "Fragment Mono, monospace" }}>{ing.available} {ing.unit}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-zinc-50 border-t border-zinc-100 px-5 py-4 flex justify-end">
                    <button onClick={handleStartProduce} className="rounded-xl bg-amber-600 px-6 py-2.5 text-[13px] font-medium text-white hover:bg-amber-700 transition-all shadow-sm">
                      {allSufficient ? "Start Production →" : "Start Anyway →"}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Step 2: Produce */}
        {step === 2 && selectedDOS && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep(1)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all">← Back</button>
              <div>
                <h2 className="text-[18px] font-semibold text-zinc-900">Producing</h2>
                <p className="text-[12px] text-zinc-500">Track your production progress.</p>
              </div>
            </div>

            {/* Task Card */}
            <div className="rounded-[24px] border-2 border-amber-300 bg-amber-50 p-6 shadow-md">
              <div className="text-center mb-6">
                <h3 className="text-[20px] font-bold text-zinc-900">{selectedDOS.product}</h3>
                <p className="text-[12px] text-zinc-500 mt-0.5" style={{ fontFamily: "Fragment Mono, monospace" }}>{selectedDOS.id}</p>
              </div>

              {/* Progress Ring */}
              <div className="flex justify-center mb-6">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke={producedCount >= selectedDOS.qty ? "#10b981" : "#f59e0b"} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 52}`} strokeDashoffset={`${2 * Math.PI * 52 * (1 - Math.min(producedCount / Math.max(selectedDOS.qty, 1), 1))}`} className="transition-all duration-500" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[32px] font-bold text-zinc-900" style={{ fontFamily: "Fragment Mono, monospace" }}>{producedCount}</span>
                    <span className="text-[12px] text-zinc-500">of {selectedDOS.qty}</span>
                  </div>
                </div>
              </div>

              {/* Counter Controls */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <button onClick={() => setProducedCount(prev => Math.max(0, prev - 1))} disabled={producedCount <= 0} className="w-14 h-14 rounded-2xl border-2 border-zinc-300 bg-white text-[24px] font-bold text-zinc-600 hover:bg-zinc-50 hover:border-zinc-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95">−</button>
                <div className="w-32 text-center">
                  <input type="number" min="0" max={selectedDOS.qty * 2} value={producedCount} onChange={e => setProducedCount(Math.max(0, Math.min(Number(e.target.value) || 0, selectedDOS.qty * 2)))} className="w-full text-center text-[28px] font-bold text-zinc-900 bg-transparent border-b-2 border-zinc-300 focus:border-amber-500 outline-none transition-colors" style={{ fontFamily: "Fragment Mono, monospace" }} />
                  <div className="text-[11px] text-zinc-500 mt-1">pcs produced</div>
                </div>
                <button onClick={() => setProducedCount(prev => Math.min(selectedDOS.qty * 2, prev + 1))} className="w-14 h-14 rounded-2xl border-2 border-amber-300 bg-amber-100 text-[24px] font-bold text-amber-700 hover:bg-amber-200 hover:border-amber-400 transition-all active:scale-95">+</button>
              </div>

              {/* Quick Buttons */}
              <div className="flex justify-center gap-2 mb-6">
                {[1, 5, 10, 25].map(n => (
                  <button key={n} onClick={() => setProducedCount(prev => Math.min(selectedDOS.qty * 2, prev + n))} className="rounded-lg bg-white border border-zinc-200 px-3 py-1.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all">+{n}</button>
                ))}
              </div>

              {/* Status Message */}
              <div className="text-center">
                {producedCount >= selectedDOS.qty ? (
                  <div className="rounded-xl bg-emerald-100 border border-emerald-200 px-4 py-3">
                    <span className="text-[13px] font-semibold text-emerald-700">Target reached! Tap "Mark Complete" to finish.</span>
                  </div>
                ) : (
                  <div className="rounded-xl bg-zinc-100 border border-zinc-200 px-4 py-3">
                    <span className="text-[13px] text-zinc-600">{selectedDOS.qty - producedCount} more to go</span>
                  </div>
                )}
              </div>
            </div>

            {/* Complete Button */}
            <button onClick={handleCompleteTask} className="w-full rounded-2xl bg-emerald-600 py-4 text-[15px] font-bold text-white hover:bg-emerald-700 transition-all shadow-md active:scale-[0.98]">
              Mark Complete ✓
            </button>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="text-center py-6">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-[40px]">✅</span>
              </div>
              <h2 className="text-[22px] font-bold text-zinc-900">Task Completed!</h2>
              <p className="text-[13px] text-zinc-500 mt-1">Great work! Your production has been recorded.</p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center">
                <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Total Tasks</div>
                <div className="text-[24px] font-semibold mt-1">{pastryDOS.length}</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center">
                <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Pending</div>
                <div className="text-[24px] font-semibold mt-1 text-amber-600">{pendingDOS.length}</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center">
                <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Completed</div>
                <div className="text-[24px] font-semibold mt-1 text-emerald-600">{doneDOS.length}</div>
              </div>
            </div>

            {/* Completed Tasks List */}
            {doneDOS.length > 0 && (
              <div className="rounded-[24px] border border-zinc-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-zinc-50 border-b border-zinc-100 px-5 py-3">
                  <h3 className="text-[13px] font-semibold text-zinc-700 uppercase tracking-wider">Completed Today</h3>
                </div>
                <div className="divide-y divide-zinc-100">
                  {doneDOS.map(task => (
                    <div key={task.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <span className="text-[14px] text-emerald-600">✓</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-zinc-900">{task.product}</div>
                        <div className="text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{task.id}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] font-semibold text-zinc-700" style={{ fontFamily: "Fragment Mono, monospace" }}>{0}/{task.qty}</div>
                        <div className="text-[11px] text-zinc-500">pcs</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button onClick={() => { setStep(0); setSelectedDOS(null); }} className="flex-1 rounded-2xl border border-zinc-200 bg-white py-3.5 text-[14px] font-medium text-zinc-700 hover:bg-zinc-50 transition-all">
                ← Back to Orders
              </button>
              {pendingDOS.length > 0 && (
                <button onClick={() => { setSelectedDOS(null); setStep(0); }} className="flex-1 rounded-2xl bg-amber-600 py-3.5 text-[14px] font-bold text-white hover:bg-amber-700 transition-all shadow-md">
                  Next Task →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  

  /* ── Freezer Tab ── */
  if (activeTab === "freezer") {
    const myFreezer = freezerItems.filter(i => i.producedBy === "pastry");
    const stored = myFreezer.filter(i => i.status === "stored");
    const finishedItems = stored.filter(i => !i.notes?.toLowerCase().includes("prepared"));
    const preparedItems = stored.filter(i => i.notes?.toLowerCase().includes("prepared"));
    const pastryAccessInventory = inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("pastry"));
    const tabItems = freezerTab === "finished" ? finishedItems : freezerTab === "prepared" ? preparedItems : [];
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
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div><h1 className="text-[24px] font-semibold">Freezer</h1><p className="mt-1 text-[13px] text-zinc-600">Track pastry products by category.</p></div>
          <button onClick={() => setShowAddFreezer(true)} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Add Product</button>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1.5 rounded-xl bg-zinc-100 p-1">
          <button onClick={() => setFreezerTab("finished")} className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all flex items-center justify-center gap-2 ${freezerTab === "finished" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>Finished Products <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">{finishedItems.length}</span></button>
          <button onClick={() => setFreezerTab("prepared")} className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all flex items-center justify-center gap-2 ${freezerTab === "prepared" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>Prepared Products <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{preparedItems.length}</span></button>
          <button onClick={() => setFreezerTab("my-inventory")} className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all flex items-center justify-center gap-2 ${freezerTab === "my-inventory" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>My Inventory <span className="rounded-full bg-blue-200 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{pastryAccessInventory.length}</span></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">{freezerTab === "my-inventory" ? "Ingredients" : "Products"}</div><div className="text-[24px] font-semibold mt-1">{freezerTab === "my-inventory" ? pastryAccessInventory.length : tabItems.length}</div></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">{freezerTab === "my-inventory" ? "Total Stock" : "Total Qty"}</div><div className="text-[24px] font-semibold mt-1">{freezerTab === "my-inventory" ? pastryAccessInventory.reduce((s, i) => s + i.onHand, 0) : tabItems.reduce((s, i) => s + i.qty, 0)} {freezerTab === "my-inventory" ? (pastryAccessInventory[0]?.unit || "pcs") : "pcs"}</div></div>
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
                  {freezerTab === "my-inventory" ? (
                    <>
                      <th className="px-5 py-3">Ingredient</th>
                      <th className="px-5 py-3 text-right">On Hand</th>
                      <th className="px-5 py-3">Unit</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Supplier</th>
                    </>
                  ) : (
                    <>
                      <th className="px-5 py-3">Product</th>
                      <th className="px-5 py-3 text-right">Qty</th>
                      <th className="px-5 py-3">Batch</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3 text-center">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {freezerTab === "my-inventory" ? (
                  pastryAccessInventory.filter(i => !freezerSearch || i.name.toLowerCase().includes(freezerSearch.toLowerCase())).length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-[13px] text-zinc-400">No ingredients assigned to Pastry.</td></tr>
                  ) : pastryAccessInventory.filter(i => !freezerSearch || i.name.toLowerCase().includes(freezerSearch.toLowerCase())).map(item => (
                    <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-[13px] font-medium text-zinc-900">{item.name}</td>
                      <td className="px-5 py-3.5 text-[13px] text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.onHand}</td>
                      <td className="px-5 py-3.5 text-[12px] text-zinc-600">{item.unit}</td>
                      <td className="px-5 py-3.5 text-[12px] text-zinc-500 capitalize">{item.category}</td>
                      <td className="px-5 py-3.5 text-[12px] text-zinc-500">{item.supplier || "—"}</td>
                    </tr>
                  ))
                ) : (
                  filtered.length === 0 ? (
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
                  ))
                )}
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newNotes.toLowerCase().includes("prepared")} onChange={e => setNewNotes(e.target.checked ? "Prepared" : "")} className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500" />
                  <span className="text-[13px] text-zinc-700 font-medium">Mark as Prepared</span>
                </label>
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

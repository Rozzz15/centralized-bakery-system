import { useEffect, useState, Fragment, useCallback } from "react";
import type { ProductionTask, DOSItem, MaterialRequest, DecoQCResult, DecoSubTask, ProductRecipe } from "../types";
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
};

const steps = [
  { id: "dos", label: "DOS" },
  { id: "plan", label: "Plan Batches" },
  { id: "assign", label: "Assign" },
  { id: "materials", label: "Materials" },
  { id: "execute", label: "Execute" },
  { id: "qc", label: "QC & Handover" },
];

type DecoBatch = { id: string; product: string; batchNum: number; size: number; };

export default function DecoDashboard({ production, dosItems, onCompleteTask, activeTab, productCatalog, recipes, newDOSIds, onMarkDOSSeen }: Props) {
  const todayDOS = dosItems.filter(d => d.status !== "scheduled");
  const decoTaskProducts = new Set(production.filter(p => p.assignedTo === "deco").map(t => t.product));
  const dosForDeco = todayDOS.filter(d => decoTaskProducts.has(d.product));
  const decoProducts = new Set(dosForDeco.map(d => d.product));
  const myTasks = production.filter(p => p.assignedTo === "deco" && decoProducts.has(p.product));

  const [step, setStep] = useState(0);
  const [subTasks, setSubTasks] = useState<DecoSubTask[]>([]);
  const [materialReqs, setMaterialReqs] = useState<MaterialRequest[]>([]);
  const [expandedDOS, setExpandedDOS] = useState<Set<string>>(new Set());
  const toggleDOS = (id: string) => setExpandedDOS(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [expandedSched, setExpandedSched] = useState<Set<string>>(new Set());
  const toggleSched = (date: string) => setExpandedSched(prev => { const n = new Set(prev); if (n.has(date)) n.delete(date); else n.add(date); return n; });
  const [qcResults, setQcResults] = useState<DecoQCResult[]>([]);
  const [completedReport, setCompletedReport] = useState(false);

  const [showMatForm, setShowMatForm] = useState(false);
  const [matDraftItems, setMatDraftItems] = useState<{ name: string; qty: number; unit: string }[]>([]);
  const addMatDraftItem = () => setMatDraftItems(prev => [...prev, { name: "", qty: 1, unit: "kg" }]);
  const updMatDraftItem = (i: number, field: string, val: string | number) => setMatDraftItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  const delMatDraftItem = (i: number) => setMatDraftItems(prev => prev.filter((_, idx) => idx !== i));

  const [batchSizes, setBatchSizes] = useState<Record<string, number>>({});
  const [doneBatches, setDoneBatches] = useState<Set<string>>(new Set());
  const [assignNames, setAssignNames] = useState<Record<string, string>>({});
  const getBatches = useCallback((product: string, qty: number): DecoBatch[] => {
    const size = batchSizes[product] || 10;
    const count = Math.ceil(qty / size);
    return Array.from({ length: count }, (_, i) => ({
      id: `${product}::B${i + 1}`, product, batchNum: i + 1,
      size: i < count - 1 ? size : qty - (i * size),
    }));
  }, [batchSizes]);
  const allBatchesDone = (product: string) => {
    const dos = dosForDeco.find(d => d.product === product);
    if (!dos) return false;
    return getBatches(product, dos.qty).every(b => doneBatches.has(b.id));
  };

  useEffect(() => {
    Promise.all([
      db.fetchDecoSubTasks().then(setSubTasks).catch(() => {}),
      db.fetchMaterialRequests().then(setMaterialReqs).catch(() => {}),
      db.fetchDecoQCResults().then(setQcResults).catch(() => {}),
    ]);
  }, []);

  useEffect(() => {
    if (step === 0 && dosForDeco.length > 0 && newDOSIds && onMarkDOSSeen) {
      const unseen = dosForDeco.filter(d => newDOSIds.has(d.id));
      if (unseen.length > 0) onMarkDOSSeen(unseen.map(d => d.id));
    }
  }, [step]);

  const allDecoTasks = production.filter(p => p.assignedTo === "deco");
  const tomorrowStr = (() => { const t = new Date(); t.setDate(t.getDate() + 1); return t.toISOString().split("T")[0]; })();
  const decoScheduled = dosItems.filter(d => d.status === "scheduled" && d.scheduledDate === tomorrowStr && allDecoTasks.some(t => t.product === d.product));
  const activeMaterialReqs = materialReqs.filter(r => r.status !== "released");
  const qcPassed = qcResults.filter(r => r.status === "passed");
  const qcFailed = qcResults.filter(r => r.status === "failed");
  const handleAssignTask = (product: string, batchCount: number, assignedTo: string) => {
    const newSub: DecoSubTask = { id: `SUB-${Date.now()}`, product, batchCount, assignedTo, status: "pending", dosRef: dosItems.find(d => d.product === product)?.id || "" };
    setSubTasks(prev => {
      const updated = [...prev, newSub];
      db.replaceDecoSubTasks(updated).catch(console.error);
      return updated;
    });
  };
  const handleCompleteSubTask = (id: string) => {
    setSubTasks(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, status: "completed" as const } : s);
      db.replaceDecoSubTasks(updated).catch(console.error);
      return updated;
    });
  };
  const getSuggestedMatItems = () => {
    const items = dosForDeco.flatMap(d => {
      const recipe = recipes.find(r => r.productName === d.product);
      if (!recipe) return [];
      return recipe.ingredients.map(ing => ({ name: ing.name, qty: Math.ceil(ing.qtyPerBatch * (d.qty / 100)), unit: ing.unit }));
    });
    const merged = items.reduce<{ name: string; qty: number; unit: string }[]>((acc, item) => {
      const existing = acc.find(a => a.name === item.name && a.unit === item.unit);
      if (existing) existing.qty += item.qty;
      else acc.push({ ...item });
      return acc;
    }, []);
    if (merged.length === 0) merged.push({ name: "", qty: 1, unit: "kg" }, { name: "", qty: 1, unit: "pcs" });
    return merged;
  };
  const openMatForm = () => { setMatDraftItems(getSuggestedMatItems()); setShowMatForm(true); };
  const submitMatForm = () => {
    const valid = matDraftItems.filter(i => i.name.trim());
    if (valid.length === 0) return;
    const newReq: MaterialRequest = { id: `MATREQ-${Date.now()}`, items: valid, status: "draft", createdAt: new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) };
    setMaterialReqs(prev => {
      const updated = [...prev, newReq];
      db.replaceMaterialRequests(updated).catch(console.error);
      return updated;
    });
    setShowMatForm(false);
  };
  const handleSubmitRequest = (id: string) => {
    setMaterialReqs(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, status: "pending-approval" as const } : r);
      db.replaceMaterialRequests(updated).catch(console.error);
      return updated;
    });
  };
  const handleCancelRequest = (id: string) => {
    setMaterialReqs(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, status: "cancelled" as const } : r);
      db.replaceMaterialRequests(updated).catch(console.error);
      return updated;
    });
  };
  const handleQC = (product: string, batchCountOk: boolean, ingredientUsageOk: boolean, decorationConsistent: boolean, notes: string) => {
    const newQC: DecoQCResult = { batchId: `QC-${Date.now()}`, product, batchCountOk, ingredientUsageOk, decorationConsistent, notes, status: batchCountOk && ingredientUsageOk && decorationConsistent ? "passed" : "failed" };
    setQcResults(prev => {
      const updated = [...prev, newQC];
      db.replaceDecoQCResults(updated).catch(console.error);
      return updated;
    });
  };
  const handleHandover = () => { myTasks.forEach(t => onCompleteTask(t.id)); setCompletedReport(true); };

  const [selectedRecipe, setSelectedRecipe] = useState<typeof recipesData[number] | null>(null);

  const recipesData = [
    { name: "Choco Moist Cake", ingredients: "Flour 2kg, Sugar 1kg, Cocoa 500g, Butter 500g, Eggs 12", batches: 10, time: "45 min" },
    { name: "Sponge Fudge", ingredients: "Flour 1.5kg, Sugar 800g, Butter 400g, Vanilla 100ml", batches: 8, time: "35 min" },
    { name: "Free Mix Base", ingredients: "Flour 3kg, Sugar 1.5kg, Baking Powder 200g, Salt 50g", batches: 15, time: "30 min" },
    { name: "Blue Theme Kit", ingredients: "Blue food color 50ml, White icing 2kg, Sprinkles 200g", batches: 5, time: "20 min" },
  ];

  if (activeTab === "recipes") {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Recipes</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Click a recipe to view full ingredient details.</p>
        </div>
        <div className="space-y-3">
          {recipesData.map((r, i) => (
            <button
              key={i}
              onClick={() => setSelectedRecipe(r)}
              className="w-full text-left rounded-2xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 hover:shadow-sm transition-all active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-medium text-zinc-900">{r.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-zinc-400">{r.time}</span>
                  <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7"/></svg>
                </div>
              </div>
              <div className="mt-1 text-[13px] text-zinc-600 line-clamp-1">{r.ingredients}</div>
              <div className="mt-0.5 text-[12px] text-zinc-400">Yield: {r.batches} batches</div>
            </button>
          ))}
        </div>

        {selectedRecipe && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={() => setSelectedRecipe(null)}>
            <div className="w-full max-w-[480px] rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-100 text-[14px]">○</span>
                    <h3 className="text-[18px] font-semibold text-zinc-900">{selectedRecipe.name}</h3>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[12px] text-zinc-500">
                    <span>⏱ {selectedRecipe.time}</span>
                    <span>•</span>
                    <span>Yield: {selectedRecipe.batches} batches</span>
                  </div>
                </div>
                <button onClick={() => setSelectedRecipe(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700">✕</button>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-3">Ingredients</h4>
                <div className="divide-y divide-zinc-200">
                  {selectedRecipe.ingredients.split(", ").map((ing, i) => {
                    const m = ing.match(/^(.+?)\s([\d.]+)(\w+)$/);
                    const name = m ? m[1] : ing;
                    const qty = m ? m[2] : "";
                    const unit = m ? m[3] : "";
                    return (
                      <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
                          <span className="text-[14px] text-zinc-800">{name}</span>
                        </div>
                        <span className="text-[14px] font-semibold text-zinc-900" style={{ fontFamily: "Fragment Mono, monospace" }}>{qty} {unit}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2 text-[12px] text-amber-800">
                  <span>✦</span>
                  <span>Standard deco recipe — follow exactly per batch.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeTab === "materials") {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div><h1 className="text-[28px] font-semibold tracking-tight">Materials</h1><p className="mt-1 text-[13px] text-zinc-500">Request ingredients from Stockroom.</p></div>
          {!showMatForm && <button onClick={openMatForm} className="rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ New Request</button>}
        </div>

        {showMatForm ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-[15px] font-semibold">New Material Request</h3><p className="text-[12px] text-zinc-500">Add the items Deco needs from Stockroom.</p></div>
              <button onClick={() => setShowMatForm(false)} className="text-[12px] text-zinc-400 hover:text-zinc-700">✕</button>
            </div>
            <div className="space-y-2">
              {matDraftItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={item.name} onChange={e => updMatDraftItem(i, "name", e.target.value)} placeholder="Item name" className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400" />
                  <input type="number" min="1" value={item.qty} onChange={e => updMatDraftItem(i, "qty", Math.max(1, Number(e.target.value)))} className="w-16 rounded-lg border border-zinc-200 px-2 py-2 text-[13px] text-center outline-none focus:border-zinc-400 font-mono" />
                  <input value={item.unit} onChange={e => updMatDraftItem(i, "unit", e.target.value)} placeholder="unit" className="w-20 rounded-lg border border-zinc-200 px-2 py-2 text-[13px] outline-none focus:border-zinc-400" />
                  <button onClick={() => delMatDraftItem(i)} className="shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500">✕</button>
                </div>
              ))}
            </div>
            <button onClick={addMatDraftItem} className="mt-2 text-[12px] font-medium text-rose-600 hover:text-rose-700">+ Add Item</button>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowMatForm(false)} className="flex-1 rounded-xl border border-zinc-200 py-2 text-[13px] text-zinc-600 hover:bg-zinc-50">Cancel</button>
              <button onClick={submitMatForm} disabled={matDraftItems.filter(i => i.name.trim()).length === 0} className="flex-1 rounded-xl bg-zinc-900 py-2 text-[13px] font-medium text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed">Create Request</button>
            </div>
          </div>
        ) : materialReqs.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center"><p className="text-[14px] text-zinc-500">No requests yet.</p></div>
        ) : (
          <div className="space-y-2">
            {materialReqs.map(r => (
              <div key={r.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium">{r.id} <span className="text-zinc-400 text-[12px]">• {r.createdAt}</span></span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase ${r.status === "cancelled" ? "bg-red-100 text-red-700" : r.status === "draft" ? "bg-zinc-100 text-zinc-600" : r.status === "pending-approval" ? "bg-amber-100 text-amber-700" : r.status === "approved" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{r.status}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">{[...r.items].map((item, i) => (<span key={i} className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[12px]">{item.name} x{item.qty} {item.unit}</span>))}</div>
                <div className="mt-2 flex items-center gap-2">{r.status === "draft" && <><button onClick={() => handleSubmitRequest(r.id)} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[12px] text-white hover:bg-zinc-800">Submit for Approval</button><button onClick={() => handleCancelRequest(r.id)} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[12px] text-zinc-500 hover:bg-zinc-50">Cancel</button></>}{r.status === "pending-approval" && <><span className="text-[12px] text-amber-600">Awaiting admin approval</span><button onClick={() => handleCancelRequest(r.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50">Cancel Request</button></>}{r.status === "approved" && <span className="text-[12px] text-blue-600">Approved — awaiting release</span>}{r.status === "released" && <span className="text-[12px] text-emerald-600">Released by Stockroom</span>}{r.status === "cancelled" && <span className="text-[12px] text-red-500">Cancelled</span>}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (activeTab !== "dashboard") return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Deco Workstation</h1>
        <p className="mt-1 text-[13px] text-zinc-500">Follow the steps below — Deco only executes what the DOS says.</p>
      </div>

      {/* Step Progress */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <button key={s.id} onClick={() => setStep(i)} className={`flex items-center gap-2.5 rounded-full px-5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-all ${i === step ? "bg-zinc-900 text-white shadow-sm" : i < step ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>
            <span className={`grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold ${i === step ? "bg-white/20" : i < step ? "bg-emerald-600 text-white" : "bg-zinc-300 text-white"}`}>{i < step ? "✓" : i + 1}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-6 shadow-sm">
        {/* Step 1: DOS Receipt */}
        {step === 0 && (
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[21px] font-semibold">DOS Received</h2>
                <p className="mt-1 text-[13px] text-zinc-500">Admin issued the following items for Deco to execute.</p>
              </div>
              {dosForDeco.length > 0 && (
                <div className="shrink-0 rounded-xl bg-rose-100 px-4 py-2.5 text-center">
                  <div className="text-[10px] text-rose-600 uppercase font-medium tracking-wider">DOS Total</div>
                  <div className="text-[22px] font-bold text-zinc-900 mt-0.5" style={{ fontFamily: "Fragment Mono, monospace" }}>{dosForDeco.reduce((s, d) => s + d.qty, 0)}</div>
                  <div className="text-[10px] text-rose-500">{dosForDeco.length} item{dosForDeco.length > 1 ? "s" : ""}</div>
                </div>
              )}
            </div>
            {dosForDeco.length === 0 ? (
              <div className="mt-6 text-center py-8"><p className="text-[14px] text-zinc-400">No DOS items assigned yet.</p></div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-rose-50 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                      <th className="w-8 px-3 py-2.5"></th>
                      <th className="px-2 py-2.5">Product</th>
                      <th className="px-2 py-2.5">Priority</th>
                      <th className="px-2 py-2.5 text-right">Total</th>
                      <th className="px-2 py-2.5 text-right">Branch 1</th>
                      <th className="px-2 py-2.5 text-right">Branch 2</th>
                      <th className="w-14 px-3 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dosForDeco.map(d => {
                      const recipe = recipes.find(r => r.productName === d.product);
                      const hasIngredients = recipe && recipe.ingredients.length > 0;
                      const isExpanded = expandedDOS.has(d.id);
                      const pColor = d.priority === "HIGH" ? "bg-red-100 text-red-700" : d.priority === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600";
                      const sDot = d.status === "completed" ? "bg-emerald-500" : d.status === "in-progress" ? "bg-amber-500" : "bg-zinc-300";
                      return (
                        <Fragment key={d.id}>
                          <tr className={`border-b border-zinc-50 text-[13px] transition-colors ${hasIngredients ? "cursor-pointer hover:bg-rose-50/60" : ""}`} onClick={() => hasIngredients && toggleDOS(d.id)}>
                            <td className="px-3 py-2.5 text-zinc-400 text-[10px] text-center">{hasIngredients ? (isExpanded ? "▾" : "▸") : ""}</td>
                            <td className="px-2 py-2.5 font-medium text-zinc-900">{d.product} {newDOSIds?.has(d.id) && <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 uppercase tracking-wider">New</span>}</td>
                            <td className="px-2 py-2.5"><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${pColor}`}>{d.priority}</span></td>
                            <td className="px-2 py-2.5 text-right font-mono text-zinc-800">{d.qty}</td>
                            <td className="px-2 py-2.5 text-right font-mono text-zinc-600">{d.branch1}</td>
                            <td className="px-2 py-2.5 text-right font-mono text-zinc-600">{d.branch2}</td>
                            <td className="px-3 py-2.5 text-right"><span className={`inline-block h-2 w-2 rounded-full ${sDot}`} /></td>
                          </tr>
                          {isExpanded && hasIngredients && (
                            <tr key={`${d.id}-ing`}>
                              <td colSpan={7} className="px-3 pb-2.5 pt-0 bg-rose-50/30">
                                <div className="flex flex-wrap items-center gap-1.5 pl-7">
                                  <span className="text-[10px] font-medium text-zinc-400 uppercase mr-0.5">Ingredients:</span>
                                  {recipe!.ingredients.map((ing, i) => (
                                    <span key={i} className="rounded-lg bg-white border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-700">{ing.name} x{ing.qtyPerBatch}{ing.unit}</span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {decoScheduled.length > 0 && (() => {
              const byDate = new Map<string, DOSItem[]>();
              decoScheduled.forEach(i => { const d = i.scheduledDate || "unknown"; if (!byDate.has(d)) byDate.set(d, []); byDate.get(d)!.push(i); });
              return (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[15px] font-semibold text-zinc-700">Scheduled DOS</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 font-mono">{decoScheduled.length} item{decoScheduled.length !== 1 ? "s" : ""}</span>
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

        {/* Step 2: Plan Batches */}
        {step === 1 && (
          <div>
            <h2 className="text-[21px] font-semibold">Plan Batches</h2>
            <p className="mt-1 text-[13px] text-zinc-500">Break each DOS item into batches. Set the pieces per batch — the tile grid updates automatically.</p>
            {dosForDeco.length === 0 ? (
              <div className="mt-6 text-center py-8"><p className="text-[14px] text-zinc-400">No DOS items to plan.</p></div>
            ) : (
              <div className="mt-4 space-y-4">
                {dosForDeco.map(d => {
                  const recipe = recipes.find(r => r.productName === d.product);
                  const batches = getBatches(d.product, d.qty);
                  const size = batchSizes[d.product] || 10;
                  return (
                    <div key={d.id} className="rounded-2xl border border-zinc-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[15px] font-medium text-zinc-900">{d.product}</div>
                          <div className="mt-0.5 text-[12px] text-zinc-400">{d.qty} pcs total</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-zinc-500">per batch:</span>
                          <input type="number" min="1" max={d.qty} value={size}
                            onChange={e => setBatchSizes(prev => ({ ...prev, [d.product]: Math.max(1, Number(e.target.value)) }))}
                            className="w-16 rounded-lg border border-zinc-200 px-2 py-1 text-[13px] text-center outline-none focus:border-zinc-400"
                            style={{ fontFamily: "Fragment Mono, monospace" }} />
                          <span className="text-[12px] text-zinc-400">pcs</span>
                        </div>
                      </div>

                      {/* Batch tile grid */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {batches.map(b => (
                          <div key={b.id} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px]">
                            <span className="grid h-5 w-5 place-items-center rounded bg-rose-100 text-[10px] font-bold text-rose-600">{b.batchNum}</span>
                            <span className="text-zinc-700">{b.size} pcs</span>
                          </div>
                        ))}
                      </div>

                      {/* Ingredients + Decoration */}
                      {recipe && recipe.ingredients.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-zinc-500">
                          <span><span className="font-medium text-zinc-700">Ingredients:</span> {recipe.ingredients.map(i => `${i.name} x${i.qtyPerBatch}${i.unit}`).join(", ")}</span>
                          <span><span className="font-medium text-zinc-700">Decoration:</span> Candles, Blue color, Sprinkles</span>
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-2 text-[11px]">
                        <span className="text-zinc-400">{batches.length} batch{batches.length > 1 ? "es" : ""}</span>
                        <span className="text-zinc-300">•</span>
                        <span className="text-zinc-400">{d.qty} pcs ÷ {size} = {batches.length} batch{batches.length > 1 ? "es" : ""}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Assign */}
        {step === 2 && (
          <div>
            <h2 className="text-[21px] font-semibold">Assign to Team</h2>
            <p className="mt-1 text-[13px] text-zinc-500">Assign each batch to a team member. Type a name and click Assign.</p>
            {dosForDeco.length === 0 ? (
              <div className="mt-6 text-center py-8"><p className="text-[14px] text-zinc-400">No DOS items to assign.</p></div>
            ) : (
              <div className="mt-4 space-y-4">
                {dosForDeco.map(d => {
                  const batches = getBatches(d.product, d.qty);
                  const existingSub = subTasks.find(s => s.product === d.product);
                  return (
                    <div key={d.id} className="rounded-2xl border border-zinc-200 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-[15px] font-medium text-zinc-900">{d.product} <span className="text-[12px] text-zinc-400 font-normal">({batches.length} batches)</span></div>
                        {existingSub ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">Assigned to {existingSub.assignedTo}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input id={`assign-input-${d.id}`} value={assignNames[d.product] || ""} onChange={e => setAssignNames(prev => ({ ...prev, [d.product]: e.target.value }))} placeholder="Name..." className="w-28 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-zinc-400" />
                            <button disabled={!assignNames[d.product]?.trim()} onClick={() => { handleAssignTask(d.product, batches.length, assignNames[d.product].trim()); setAssignNames(prev => ({ ...prev, [d.product]: "" })); }} className="rounded-lg bg-rose-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed">Assign</button>
                          </div>
                        )}
                      </div>

                      {/* Batch tiles with assignee */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {batches.map(b => (
                          <div key={b.id} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] ${existingSub ? "border-emerald-200 bg-emerald-50/50" : "border-zinc-200 bg-white"}`}>
                            <span className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold text-white" style={{ background: existingSub ? "#059669" : "#e11d48" }}>{b.batchNum}</span>
                            <span className="text-zinc-700">Batch {b.batchNum}</span>
                            {existingSub && <span className="text-emerald-600 ml-0.5">→ {existingSub.assignedTo}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {subTasks.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-rose-50/30 p-3">
                    <div className="text-[12px] font-medium text-zinc-700">{subTasks.length} team member{subTasks.length > 1 ? "s" : ""} assigned</div>
                    {subTasks.map(s => (
                      <div key={s.id} className="flex items-center justify-between mt-2 text-[13px]">
                        <span>{s.assignedTo} → {s.product} ({s.batchCount} batches)</span>
                        {s.status === "pending" ? (
                          <button onClick={() => handleCompleteSubTask(s.id)} className="rounded-lg bg-zinc-900 px-3 py-1 text-[11px] text-white hover:bg-zinc-800">Mark Ready</button>
                        ) : <span className="text-[12px] text-emerald-600 font-medium">✓ Ready</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Materials */}
        {step === 3 && (
          <div>
            <div className="flex items-center justify-between">
              <div><h2 className="text-[21px] font-semibold">Request Materials</h2><p className="mt-1 text-[13px] text-zinc-500">Ask Admin for ingredients from Stockroom.</p></div>
              {!showMatForm && <button onClick={openMatForm} className="rounded-xl bg-zinc-900 px-4 py-2 text-[13px] text-white hover:bg-zinc-800">+ New Request</button>}
            </div>

            {showMatForm ? (
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-semibold">New Material Request</h3>
                  <button onClick={() => setShowMatForm(false)} className="text-[12px] text-zinc-400 hover:text-zinc-700">✕</button>
                </div>
                <div className="space-y-2">
                  {matDraftItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={item.name} onChange={e => updMatDraftItem(i, "name", e.target.value)} placeholder="Item name" className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400" />
                      <input type="number" min="1" value={item.qty} onChange={e => updMatDraftItem(i, "qty", Math.max(1, Number(e.target.value)))} className="w-16 rounded-lg border border-zinc-200 px-2 py-2 text-[13px] text-center outline-none focus:border-zinc-400 font-mono" />
                      <input value={item.unit} onChange={e => updMatDraftItem(i, "unit", e.target.value)} placeholder="unit" className="w-20 rounded-lg border border-zinc-200 px-2 py-2 text-[13px] outline-none focus:border-zinc-400" />
                      <button onClick={() => delMatDraftItem(i)} className="shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500">✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={addMatDraftItem} className="mt-2 text-[12px] font-medium text-rose-600 hover:text-rose-700">+ Add Item</button>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setShowMatForm(false)} className="flex-1 rounded-xl border border-zinc-200 py-2 text-[13px] text-zinc-600 hover:bg-zinc-50">Cancel</button>
                  <button onClick={submitMatForm} disabled={matDraftItems.filter(i => i.name.trim()).length === 0} className="flex-1 rounded-xl bg-zinc-900 py-2 text-[13px] font-medium text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed">Create Request</button>
                </div>
              </div>
            ) : activeMaterialReqs.length === 0 ? (
              <div className="mt-6 text-center py-8"><p className="text-[14px] text-zinc-400">No active requests.</p></div>
            ) : (
              <div className="mt-4 space-y-2">
                {activeMaterialReqs.map(r => (
                  <div key={r.id} className="rounded-xl border border-zinc-200 p-3">
                    <div className="flex items-center justify-between"><span className="text-[14px] font-medium">{r.id}</span><span className={`text-[11px] font-medium uppercase ${r.status === "cancelled" ? "text-red-500" : r.status === "draft" ? "text-zinc-500" : "text-amber-600"}`}>{r.status}</span></div>
                    <div className="mt-1 flex flex-wrap gap-1.5">{[...r.items].map((item, i) => (<span key={i} className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px]">{item.name} x{item.qty}{item.unit}</span>))}</div>
                    <div className="mt-2 flex items-center gap-2">{r.status === "draft" && <><button onClick={() => handleSubmitRequest(r.id)} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[12px] text-white hover:bg-zinc-800">Submit</button><button onClick={() => handleCancelRequest(r.id)} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[12px] text-zinc-500 hover:bg-zinc-50">Cancel</button></>}{r.status === "pending-approval" && <><span className="text-[12px] text-amber-600">Waiting for Admin to approve...</span><button onClick={() => handleCancelRequest(r.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50">Cancel</button></>}{r.status === "cancelled" && <span className="text-[12px] text-red-500">Cancelled</span>}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 5: Execute */}
        {step === 4 && (
          <div>
            <h2 className="text-[21px] font-semibold">Execute Batches</h2>
            <p className="mt-1 text-[13px] text-zinc-500">Complete each batch one by one. The assigned person executes per the recipe.</p>
            {dosForDeco.length === 0 ? (
              <div className="mt-6 text-center py-8"><p className="text-[14px] text-zinc-400">No batches to execute.</p></div>
            ) : (
              <div className="mt-4 space-y-4">
                {dosForDeco.map(d => {
                  const task = myTasks.find(t => t.product === d.product);
                  const batches = getBatches(d.product, d.qty);
                  const doneCount = batches.filter(b => doneBatches.has(b.id)).length;
                  const sub = subTasks.find(s => s.product === d.product);
                  const allDone = allBatchesDone(d.product);
                  return (
                    <div key={d.id} className="rounded-2xl border border-zinc-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[15px] font-medium text-zinc-900">{d.product}</span>
                          {sub && <span className="ml-2 text-[12px] text-zinc-400">→ {sub.assignedTo}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-zinc-500 font-mono">{doneCount}/{batches.length}</span>
                          {task?.status === "completed" || allDone ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">✓ All Done</span>
                          ) : (
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${doneCount > 0 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-zinc-100 text-zinc-600"}`}>{doneCount > 0 ? `${Math.round((doneCount / batches.length) * 100)}%` : "Pending"}</span>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-500 transition-all" style={{ width: `${(doneCount / Math.max(1, batches.length)) * 100}%` }} />
                      </div>

                      {/* Batch cards */}
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {batches.map(b => {
                          const isDone = doneBatches.has(b.id);
                          return (
                            <div key={b.id} className={`flex items-center justify-between rounded-xl border p-3 transition-all ${isDone ? "border-emerald-200 bg-emerald-50/60" : "border-zinc-200 bg-white hover:border-rose-200"}`}>
                              <div className="flex items-center gap-2.5">
                                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[12px] font-bold ${isDone ? "bg-emerald-500 text-white" : "bg-rose-100 text-rose-600"}`}>{b.batchNum}</span>
                                <div>
                                  <div className="text-[13px] font-medium text-zinc-800">Batch {b.batchNum}</div>
                                  <div className="text-[11px] text-zinc-500">{b.size} pcs {sub ? `• ${sub.assignedTo}` : ""}</div>
                                </div>
                              </div>
                              {isDone ? (
                                <span className="text-emerald-600 text-[16px] font-bold">✓</span>
                              ) : (
                                <button onClick={() => { setDoneBatches(prev => { const n = new Set(prev); n.add(b.id); return n; }); if (batches.every(bb => doneBatches.has(bb.id) || bb.id === b.id)) { const t = myTasks.find(tt => tt.product === d.product); if (t) onCompleteTask(t.id); } }} className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-rose-700">Complete</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 6: QC & Handover */}
        {step === 5 && (
          <div>
            <h2 className="text-[21px] font-semibold">QC & Handover</h2>
            <p className="mt-1 text-[13px] text-zinc-500">Head Deco inspects completed batches and signs off. Once passed, hand over to Kitchen.</p>

            {/* QC Section */}
            <div className="mt-4 space-y-3">
              {doneBatches.size === 0 ? (
                <p className="text-[14px] text-zinc-400 text-center py-4">Complete batches in the Execute step first.</p>
              ) : (
                dosForDeco.map(d => {
                  const product = d.product;
                  const alreadyQced = qcResults.some(q => q.product === product);
                  if (alreadyQced) return null;
                  const doneCount = getBatches(product, d.qty).filter(b => doneBatches.has(b.id)).length;
                  if (doneCount === 0) return null;
                  return (
                    <DecoQCCard key={product} product={product} batchCount={getBatches(product, d.qty).length} doneCount={doneCount} onSubmit={handleQC} />
                  );
                })
              )}

              {qcPassed.length > 0 && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center text-[13px] font-medium text-emerald-700">✓ {qcPassed.length} product{qcPassed.length > 1 ? "s" : ""} passed QC</div>
              )}
              {qcFailed.length > 0 && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-center text-[13px] font-medium text-red-700">✕ {qcFailed.length} failed — redo needed</div>
              )}
            </div>

            {/* Handover */}
            {completedReport ? (
              <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                <div className="text-[16px] font-bold text-emerald-700">✓ Handed Over to Kitchen</div>
                <div className="text-[12px] text-emerald-600 mt-0.5">All QC-passed products sent to dispatch.</div>
              </div>
            ) : (
              <button onClick={handleHandover} disabled={myTasks.length === 0 || qcPassed.length === 0} className="mt-4 w-full rounded-xl bg-zinc-900 py-3 text-[14px] font-medium text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed">
                Handover to Kitchen & Report to Admin
              </button>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-100">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="rounded-xl border border-zinc-300 px-4 py-2 sm:px-6 sm:py-3 text-[14px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed">← Back</button>
          <div className="text-[14px] text-zinc-400">Step {step + 1} of {steps.length}</div>
          <button onClick={() => setStep(Math.min(steps.length - 1, step + 1))} disabled={step === steps.length - 1} className="rounded-xl bg-zinc-900 px-4 py-2 sm:px-6 sm:py-3 text-[14px] font-medium text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed">Next →</button>
        </div>
      </div>
    </div>
  );
}

/* Sub-components */
function DecoQCCard({ product, batchCount, doneCount, onSubmit }: { product: string; batchCount: number; doneCount: number; onSubmit: (product: string, batchCountOk: boolean, ingredientUsageOk: boolean, decorationConsistent: boolean, notes: string) => void }) {
  const [batchCountOk, setBatchCountOk] = useState(true);
  const [ingredientUsageOk, setIngredientUsageOk] = useState(true);
  const [decorationConsistent, setDecorationConsistent] = useState(true);
  const [notes, setNotes] = useState("");
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[15px] font-medium">{product}</div>
        <span className="text-[12px] text-zinc-500">{doneCount}/{batchCount} batches done</span>
      </div>
      <div className="space-y-2.5">
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={batchCountOk} onChange={e => setBatchCountOk(e.target.checked)} className="rounded border-zinc-300" /> Correct batch count ({doneCount} of {batchCount})</label>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={ingredientUsageOk} onChange={e => setIngredientUsageOk(e.target.checked)} className="rounded border-zinc-300" /> Proper ingredient usage</label>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={decorationConsistent} onChange={e => setDecorationConsistent(e.target.checked)} className="rounded border-zinc-300" /> Decoration matches spec</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-[13px] outline-none" />
        <button onClick={() => onSubmit(product, batchCountOk, ingredientUsageOk, decorationConsistent, notes)} className="w-full rounded-xl bg-zinc-900 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">{batchCountOk && ingredientUsageOk && decorationConsistent ? "✓ Pass & Submit" : "⚠ Flag Issue"}</button>
      </div>
    </div>
  );
}
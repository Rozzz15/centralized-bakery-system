import { useEffect, useState, Fragment } from "react";
import type { ProductionTask, DOSItem, BakerIngredientRequest, ProductRecipe } from "../types";
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
  { id: "materials", label: "Materials" },
  { id: "produce", label: "Produce" },
  { id: "handover", label: "Handover" },
];

export default function BakerDashboard({ production, dosItems, onCompleteTask, activeTab, productCatalog, recipes, newDOSIds, onMarkDOSSeen }: Props) {
  const [step, setStep] = useState(0);
  const [ingredientReqs, setIngredientReqs] = useState<BakerIngredientRequest[]>([]);
  const [sent, setSent] = useState(false);
  const [expandedDOS, setExpandedDOS] = useState<Set<string>>(new Set());
  const toggleDOS = (id: string) => setExpandedDOS(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [expandedSched, setExpandedSched] = useState<Set<string>>(new Set());
  const toggleSched = (date: string) => setExpandedSched(prev => { const n = new Set(prev); if (n.has(date)) n.delete(date); else n.add(date); return n; });
  const [showBakeForm, setShowBakeForm] = useState(false);
  const [bakeDraftItems, setBakeDraftItems] = useState<{ name: string; qty: number; unit: string }[]>([]);
  const addBakeDraftItem = () => setBakeDraftItems(prev => [...prev, { name: "", qty: 1, unit: "kg" }]);
  const updBakeDraftItem = (i: number, field: string, val: string | number) => setBakeDraftItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  const delBakeDraftItem = (i: number) => setBakeDraftItems(prev => prev.filter((_, idx) => idx !== i));

  useEffect(() => {
    db.fetchBakerIngredientRequests().then(setIngredientReqs).catch(() => {});
  }, []);

  useEffect(() => {
    if (step === 0 && bakerDOS.length > 0 && newDOSIds && onMarkDOSSeen) {
      const unseen = bakerDOS.filter(d => newDOSIds.has(d.id));
      if (unseen.length > 0) onMarkDOSSeen(unseen.map(d => d.id));
    }
  }, [step]);

  const todayDOS = dosItems.filter(d => d.status !== "scheduled");
  const bakerTaskProducts = new Set(production.filter(p => p.assignedTo === "baker").map(t => t.product));
  const bakerDOS = todayDOS.filter(d => bakerTaskProducts.has(d.product));
  const bakerProducts = new Set(bakerDOS.map(d => d.product));
  const myTasks = production.filter(p => p.assignedTo === "baker" && bakerProducts.has(p.product));
  const tomorrowStr = (() => { const t = new Date(); t.setDate(t.getDate() + 1); return t.toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0]; })();
  const allBakerTasks = production.filter(p => p.assignedTo === "baker");
  const bakerScheduled = dosItems.filter(d => d.status === "scheduled" && d.scheduledDate === tomorrowStr && allBakerTasks.some(t => t.product === d.product));
  const allDone = myTasks.length > 0 && myTasks.every(t => t.status === "completed");
  const releasedReqs = ingredientReqs.filter(r => r.status === "released");

  const getSuggestedBakerItems = () => {
    const items = bakerDOS.flatMap(d => {
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
    if (merged.length === 0) {
      merged.push({ name: "Flour", qty: 25, unit: "kg" }, { name: "Sugar", qty: 10, unit: "kg" }, { name: "Eggs", qty: 60, unit: "pcs" }, { name: "Butter", qty: 5, unit: "kg" }, { name: "Yeast", qty: 2, unit: "kg" });
    }
    return merged;
  };
  const openBakeForm = () => { setBakeDraftItems(getSuggestedBakerItems()); setShowBakeForm(true); };
  const submitBakeForm = () => {
    const valid = bakeDraftItems.filter(i => i.name.trim());
    if (valid.length === 0) return;
    const newReq: BakerIngredientRequest = {
      id: `BAKREQ-${Date.now()}`,
      items: valid,
      status: "draft",
      createdAt: new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }),
    };
    setIngredientReqs(prev => {
      const updated = [...prev, newReq];
      db.replaceBakerIngredientRequests(updated).catch(console.error);
      return updated;
    });
    setShowBakeForm(false);
  };

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

  const [selectedRecipe, setSelectedRecipe] = useState<{ name: string; ingredients: string; time: string; yield: string } | null>(null);
  const bakerRecipes = [
    { name: "Classic Loaf Bread", ingredients: "Flour 2kg, Yeast 40g, Salt 20g, Water 1.2L, Sugar 100g", time: "90 min", yield: "8 loaves" },
    { name: "Choco Moist Cake", ingredients: "Flour 1.8kg, Cocoa 300g, Sugar 1kg, Eggs 10, Butter 400g", time: "45 min", yield: "4 cakes" },
    { name: "Spanish Bread", ingredients: "Flour 2.5kg, Yeast 50g, Sugar 400g, Butter 300g, Milk 500ml", time: "60 min", yield: "40 pcs" },
    { name: "Pandesal", ingredients: "Flour 3kg, Yeast 60g, Salt 30g, Sugar 500g, Water 1.5L", time: "50 min", yield: "60 pcs" },
    { name: "Ensaymada", ingredients: "Flour 2kg, Eggs 12, Butter 500g, Sugar 600g, Yeast 40g", time: "75 min", yield: "30 pcs" },
    { name: "Sponge Fudge", ingredients: "Flour 1.5kg, Sugar 800g, Cocoa 200g, Butter 400g, Eggs 8", time: "40 min", yield: "24 pcs" },
  ];

  /* ── Recipes Tab ── */
  if (activeTab === "recipes") {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Recipes</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Click a recipe to view full ingredient details.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {bakerRecipes.map((r, i) => (
            <button
              key={i}
              onClick={() => setSelectedRecipe(r)}
              className="text-left rounded-2xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 hover:shadow-sm transition-all active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-medium text-zinc-900">{r.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-zinc-400">{r.time}</span>
                  <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7"/></svg>
                </div>
              </div>
              <div className="mt-1 text-[13px] text-zinc-600 line-clamp-1">{r.ingredients}</div>
              <div className="mt-0.5 text-[12px] text-zinc-400">Yield: {r.yield}</div>
            </button>
          ))}
        </div>

        {selectedRecipe && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={() => setSelectedRecipe(null)}>
            <div className="w-full max-w-[480px] rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-stone-100 text-[14px]">◇</span>
                    <h3 className="text-[18px] font-semibold text-zinc-900">{selectedRecipe.name}</h3>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[12px] text-zinc-500">
                    <span>⏱ {selectedRecipe.time}</span>
                    <span>•</span>
                    <span>Yield: {selectedRecipe.yield}</span>
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
                          <span className="h-1.5 w-1.5 rounded-full bg-stone-400 shrink-0" />
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
                  <span>Standard bakery recipe — follow exactly per batch.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Requests Tab ── */
  if (activeTab === "requests") {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div><h1 className="text-[28px] font-semibold tracking-tight">Ingredient Requests</h1><p className="mt-1 text-[13px] text-zinc-500">Track your stockroom requests and their status.</p></div>
          {!showBakeForm && <button onClick={openBakeForm} className="rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ New Request</button>}
        </div>

        {showBakeForm ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-[15px] font-semibold">New Ingredient Request</h3><p className="text-[12px] text-zinc-500">Review and adjust the suggested ingredients from your DOS recipes.</p></div>
              <button onClick={() => setShowBakeForm(false)} className="text-[12px] text-zinc-400 hover:text-zinc-700">✕</button>
            </div>
            <div className="space-y-2">
              {bakeDraftItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={item.name} onChange={e => updBakeDraftItem(i, "name", e.target.value)} placeholder="Item name" className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400" />
                  <input type="number" min="1" value={item.qty} onChange={e => updBakeDraftItem(i, "qty", Math.max(1, Number(e.target.value)))} className="w-16 rounded-lg border border-zinc-200 px-2 py-2 text-[13px] text-center outline-none focus:border-zinc-400 font-mono" />
                  <input value={item.unit} onChange={e => updBakeDraftItem(i, "unit", e.target.value)} placeholder="unit" className="w-20 rounded-lg border border-zinc-200 px-2 py-2 text-[13px] outline-none focus:border-zinc-400" />
                  <button onClick={() => delBakeDraftItem(i)} className="shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500">✕</button>
                </div>
              ))}
            </div>
            <button onClick={addBakeDraftItem} className="mt-2 text-[12px] font-medium text-stone-600 hover:text-stone-700">+ Add Item</button>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowBakeForm(false)} className="flex-1 rounded-xl border border-zinc-200 py-2 text-[13px] text-zinc-600 hover:bg-zinc-50">Cancel</button>
              <button onClick={submitBakeForm} disabled={bakeDraftItems.filter(i => i.name.trim()).length === 0} className="flex-1 rounded-xl bg-zinc-900 py-2 text-[13px] font-medium text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed">Create Request</button>
            </div>
          </div>
        ) : ingredientReqs.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center"><p className="text-[14px] text-zinc-500">No requests made yet.</p></div>
        ) : (
          <div className="space-y-2">
            {ingredientReqs.map(r => (
              <div key={r.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium">{r.id} <span className="text-zinc-400 text-[12px] font-normal">• {r.createdAt}</span></span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase ${r.status === "cancelled" ? "bg-red-100 text-red-700" : r.status === "draft" ? "bg-zinc-100 text-zinc-600" : r.status === "pending-approval" ? "bg-amber-100 text-amber-700" : r.status === "approved" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{r.status}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">{r.items.map((item, i) => (<span key={i} className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[12px]">{item.name} x{item.qty}{item.unit}</span>))}</div>
                <div className="mt-2 flex items-center gap-2">{r.status === "draft" && <><button onClick={() => handleSubmitRequest(r.id)} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[12px] text-white hover:bg-zinc-800">Submit for Approval</button><button onClick={() => handleCancelRequest(r.id)} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[12px] text-zinc-500 hover:bg-zinc-50">Cancel</button></>}{r.status === "pending-approval" && <><span className="text-[12px] text-amber-600">Awaiting admin approval</span><button onClick={() => handleCancelRequest(r.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50">Cancel Request</button></>}{r.status === "approved" && <span className="text-[12px] text-blue-600">Approved — awaiting release</span>}{r.status === "released" && <span className="text-[12px] text-emerald-600">Released from Stockroom</span>}{r.status === "cancelled" && <span className="text-[12px] text-red-500">Cancelled</span>}</div>
              </div>
            ))}
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
              {bakerDOS.length > 0 && (
                <div className="shrink-0 rounded-xl bg-stone-100 px-4 py-2.5 text-center">
                  <div className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider">DOS Total</div>
                  <div className="text-[22px] font-bold text-zinc-900 mt-0.5" style={{ fontFamily: "Fragment Mono, monospace" }}>{bakerDOS.reduce((s, d) => s + d.qty, 0)}</div>
                  <div className="text-[10px] text-zinc-400">{bakerDOS.length} item{bakerDOS.length > 1 ? "s" : ""}</div>
                </div>
              )}
            </div>
            {bakerDOS.length === 0 ? (
              <div className="mt-8 text-center py-8"><p className="text-[14px] text-zinc-400">No baking orders yet.</p><p className="text-[12px] text-zinc-400 mt-1">Wait for Admin to create a DOS.</p></div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-stone-50 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
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
                    {bakerDOS.map(d => {
                      const recipe = recipes.find(r => r.productName === d.product);
                      const hasIngredients = recipe && recipe.ingredients.length > 0;
                      const isExpanded = expandedDOS.has(d.id);
                      const pColor = d.priority === "HIGH" ? "bg-red-100 text-red-700" : d.priority === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600";
                      const sDot = d.status === "completed" ? "bg-emerald-500" : d.status === "in-progress" ? "bg-amber-500" : "bg-zinc-300";
                      return (
                        <Fragment key={d.id}>
                          <tr className={`border-b border-zinc-50 text-[13px] transition-colors ${hasIngredients ? "cursor-pointer hover:bg-stone-50/60" : ""}`} onClick={() => hasIngredients && toggleDOS(d.id)}>
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
                              <td colSpan={7} className="px-3 pb-2.5 pt-0 bg-stone-50/40">
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
                  <tfoot>
                    <tr className="border-t border-zinc-200 bg-stone-50 text-[13px] font-semibold text-zinc-800">
                      <td colSpan={3} className="px-3 py-2.5">Total</td>
                      <td className="px-2 py-2.5 text-right font-mono">{bakerDOS.reduce((s, d) => s + d.qty, 0)}</td>
                      <td className="px-2 py-2.5 text-right font-mono">{bakerDOS.reduce((s, d) => s + d.branch1, 0)}</td>
                      <td className="px-2 py-2.5 text-right font-mono">{bakerDOS.reduce((s, d) => s + d.branch2, 0)}</td>
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
              <div><h2 className="text-[21px] font-semibold">Request Ingredients</h2><p className="mt-1 text-[13px] text-zinc-500">Tell Admin what you need from the stockroom.</p></div>
              <button onClick={handleRequestIngredients} className="rounded-xl bg-zinc-900 px-4 py-2 text-[13px] text-white hover:bg-zinc-800">+ Request</button>
            </div>
            {ingredientReqs.length === 0 ? (
              <div className="mt-6 text-center py-8"><p className="text-[14px] text-zinc-400">No requests yet.</p></div>
            ) : (
              <div className="mt-4 space-y-2">
                {ingredientReqs.map(r => (
                  <div key={r.id} className="rounded-2xl border border-zinc-200 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-medium">{r.id} <span className="text-zinc-400 text-[12px] font-normal">• {r.createdAt}</span></span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase ${r.status === "cancelled" ? "bg-red-100 text-red-700" : r.status === "draft" ? "bg-zinc-100 text-zinc-600" : r.status === "pending-approval" ? "bg-amber-100 text-amber-700" : r.status === "approved" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{r.status}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">{r.items.map((item, i) => (<span key={i} className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[12px]">{item.name} x{item.qty}{item.unit}</span>))}</div>
<div className="mt-2 flex items-center gap-2">{r.status === "draft" && <><button onClick={() => handleSubmitRequest(r.id)} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[12px] text-white hover:bg-zinc-800">Submit for Approval</button><button onClick={() => handleCancelRequest(r.id)} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[12px] text-zinc-500 hover:bg-zinc-50">Cancel</button></>}{r.status === "pending-approval" && <><span className="text-[12px] text-amber-600">Awaiting admin approval</span><button onClick={() => handleCancelRequest(r.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50">Cancel Request</button></>}{r.status === "approved" && <span className="text-[12px] text-blue-600">Approved — awaiting release</span>}{r.status === "released" && <span className="text-[12px] text-emerald-600">Released from Stockroom</span>}{r.status === "cancelled" && <span className="text-[12px] text-red-500">Cancelled</span>}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
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

        {step === 3 && (
          <div>
            <h2 className="text-[21px] font-semibold">Send to Kitchen</h2>
            <p className="mt-1 text-[13px] text-zinc-500">All baked items go to Kitchen for QC and dispatch.</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-zinc-50 p-3"><div className="text-[11px] text-zinc-500">Total Items</div><div className="text-[20px] font-semibold mt-0.5">{bakerDOS.length}</div></div>
              <div className="rounded-xl bg-zinc-50 p-3"><div className="text-[11px] text-zinc-500">Completed</div><div className="text-[20px] font-semibold mt-0.5 text-emerald-600">{myTasks.filter(t => t.status === "completed").length}</div></div>
              <div className="rounded-xl bg-zinc-50 p-3"><div className="text-[11px] text-zinc-500">Total Output</div><div className="text-[20px] font-semibold mt-0.5">{myTasks.reduce((s, t) => s + t.completed, 0)} pcs</div></div>
              <div className="rounded-xl bg-zinc-50 p-3"><div className="text-[11px] text-zinc-500">Ingredients</div><div className="text-[12px] font-semibold mt-0.5 text-emerald-600">{releasedReqs.length > 0 ? "✓ Released" : "Pending"}</div></div>
            </div>
            <button onClick={handleSendToKitchen} disabled={!allDone} className="mt-6 w-full rounded-xl bg-zinc-900 py-3 text-[14px] font-medium text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed">
              {sent ? "✓ Sent to Kitchen" : allDone ? "Send All to Kitchen" : "Complete all production first"}
            </button>
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
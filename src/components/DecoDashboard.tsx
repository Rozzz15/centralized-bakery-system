import { useEffect, useState, Fragment } from "react";
import type { ProductionTask, DOSItem, MaterialRequest, ProductRecipe, InventoryItem, FreezerItem, FreezerHistory } from "../types";
import * as db from "../lib/db";

type CustomOrder = {
  id: string;
  customer: string;
  product: string;
  request: string;
  status: "pending" | "in-progress" | "completed";
  createdAt: string;
};

type DecoTask = {
  id: string;
  product: string;
  orderRef: string;
  theme: string;
  status: "pending" | "in-progress" | "completed";
  notes: string;
};

type Props = {
  production: ProductionTask[];
  dosItems: DOSItem[];
  onCompleteTask: (taskId: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  productCatalog: string[];
  recipes: ProductRecipe[];
  newDOSIds?: Set<string>;
  onMarkDOSSeen?: (ids: string[]) => void;
  inventory: InventoryItem[];
  onUpdateInventory: (cb: InventoryItem[] | ((prev: InventoryItem[]) => InventoryItem[])) => void;
  onUpdateRecipes?: (cb: ProductRecipe[] | ((prev: ProductRecipe[]) => ProductRecipe[])) => void;
  onAddAuditLog?: (action: string, details: string) => void;
  freezerItems?: FreezerItem[];
  onUpdateFreezer?: (cb: FreezerItem[] | ((prev: FreezerItem[]) => FreezerItem[])) => void;
  freezerHistory?: FreezerHistory[];
};

export default function DecoDashboard({ production, dosItems, onCompleteTask, activeTab, setActiveTab, productCatalog, recipes, inventory, onUpdateInventory, onUpdateRecipes, onAddAuditLog, newDOSIds, onMarkDOSSeen, freezerItems = [], onUpdateFreezer, freezerHistory = [] }: Props) {
  const todayDOS = dosItems.filter(d => {
    if (d.status === "scheduled") return false;
    const ts = d.id.match(/DOS-(\d+)/)?.[1];
    if (!ts) return true;
    const itemDate = new Date(Number(ts)).toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    const todayStr = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    return itemDate === todayStr;
  });
  const decoTaskProducts = new Set(production.filter(p => p.assignedTo === "deco").map(t => t.product));
  const dosForDeco = todayDOS.filter(d => decoTaskProducts.has(d.product));

  useEffect(() => {
    if ((activeTab === "dashboard" || activeTab === "deco-queue") && dosForDeco.length > 0 && newDOSIds && onMarkDOSSeen) {
      const unseen = dosForDeco.filter(d => newDOSIds.has(d.id));
      if (unseen.length > 0) onMarkDOSSeen(unseen.map(d => d.id));
    }
  }, [activeTab]);

  const [editingRecipe, setEditingRecipe] = useState<string | null>(null);
  const [recipeDraft, setRecipeDraft] = useState<{ inventoryId: string; name: string; qtyPerBatch: number; unit: string }[]>([]);
  const [freeMixPrepared, setFreeMixPrepared] = useState<Set<string>>(new Set());
  const [freeMixDone, setFreeMixDone] = useState<Set<string>>(new Set());
  const [materialReqs, setMaterialReqs] = useState<MaterialRequest[]>([]);
  const [showMatForm, setShowMatForm] = useState(false);
  const [matDraftItems, setMatDraftItems] = useState<{ name: string; qty: number; unit: string }[]>([]);

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

  const [customOrders, setCustomOrders] = useState<CustomOrder[]>([
    { id: "CO-001", customer: "Anna Santos", product: "Chocolate Cake", request: "Pink ribbon + gold topper + #21 candle", status: "pending", createdAt: "May 28, 10:30 AM" },
    { id: "CO-002", customer: "Mike Reyes", product: "Choco Moist Cake", request: "Add happy birthday text + sprinkles", status: "in-progress", createdAt: "May 28, 09:15 AM" },
    { id: "CO-003", customer: "Lisa Cruz", product: "Sponge Fudge", request: "Minimalist white icing + fresh flowers", status: "pending", createdAt: "May 28, 11:00 AM" },
  ]);

  const [decoQueue, setDecoQueue] = useState<DecoTask[]>([
    { id: "DQ-001", product: "Chocolate Cake", orderRef: "DOS-001", theme: "Frozen Theme", status: "pending", notes: "Blue icing, snowflake toppers" },
    { id: "DQ-002", product: "Choco Moist Cake", orderRef: "DOS-002", theme: "Minimalist", status: "in-progress", notes: "White base, gold accents" },
    { id: "DQ-003", product: "Sponge Fudge", orderRef: "DOS-003", theme: "Floral", status: "pending", notes: "Pink roses, green leaves" },
  ]);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [summaryModal, setSummaryModal] = useState<"products" | "ingredients" | "packaging" | "deco" | null>(null);

  const allIngredients = inventory.filter(i => i.group === "ingredients" || i.group === "decoration-supplies" || i.group === "packaging-materials");
  const decoMaterials = inventory.filter(i => i.group === "decoration-supplies");
  const ingredientItems = inventory.filter(i => i.group === "ingredients");
  const lowDecoMaterials = decoMaterials.filter(i => i.onHand > 0 && i.onHand < i.threshold);

  useEffect(() => {
    db.fetchMaterialRequests().then(setMaterialReqs).catch(() => {});
  }, []);

  const togglePrepared = (id: string) => setFreeMixPrepared(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const handleEditRecipe = (product: string) => {
    const existing = recipes.find(r => r.productName === product);
    setRecipeDraft(existing ? existing.ingredients.map(i => ({ ...i })) : []);
    setEditingRecipe(product);
  };

  const handleSaveRecipe = () => {
    if (!editingRecipe || !onUpdateRecipes) return;
    const existingRecipe = recipes.find(r => r.productName === editingRecipe);
    const newRecipe: ProductRecipe = {
      productId: editingRecipe, productName: editingRecipe,
      ingredients: recipeDraft.filter(i => i.name.trim()),
      packagingMaterials: existingRecipe?.packagingMaterials ?? [],
      decorationSupplies: existingRecipe?.decorationSupplies ?? [],
    };
    onUpdateRecipes(prev => {
      const idx = prev.findIndex(r => r.productName === editingRecipe);
      if (idx >= 0) { const next = [...prev]; next[idx] = newRecipe; return next; }
      return [...prev, newRecipe];
    });
    db.upsertRecipe(newRecipe).catch(console.error);
    setEditingRecipe(null);
    setRecipeDraft([]);
  };

  const addIngredient = () => setRecipeDraft(prev => [...prev, { inventoryId: "", name: "", qtyPerBatch: 0, unit: "" }]);
  const updIngredient = (i: number, field: string, value: string | number) => setRecipeDraft(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  const delIngredient = (i: number) => setRecipeDraft(prev => prev.filter((_, idx) => idx !== i));

  const handleCompleteMix = async (product: string) => {
    const dos = dosForDeco.find(d => d.product === product);
    const recipe = recipes.find(r => r.productName === product);
    if (!dos || !recipe) return;
    const newInv = [...inventory];
    const deductions: string[] = [];
    recipe.ingredients.forEach(ing => {
      const neededQty = Math.ceil(ing.qtyPerBatch * (dos.qty / 100));
      const idx = newInv.findIndex(i => i.id === ing.inventoryId);
      if (idx >= 0) { newInv[idx] = { ...newInv[idx], onHand: Math.max(0, newInv[idx].onHand - neededQty) }; deductions.push(ing.name); }
    });
    onUpdateInventory(newInv);
    await db.upsertInventory(newInv).catch(console.error);
    onAddAuditLog?.("FREE_MIX_COMPLETED", `${product}: ${deductions.join(", ")}`);
    setFreeMixDone(prev => new Set(prev).add(product));
    recipe.ingredients.forEach(ing => togglePrepared(`${dos.id}-${ing.name}`));
  };

  const openMatForm = () => {
    const suggested: { name: string; qty: number; unit: string }[] = [];
    dosForDeco.forEach(d => {
      const recipe = recipes.find(r => r.productName === d.product);
      if (recipe) recipe.decorationSupplies.forEach(sup => {
        const existing = suggested.find(s => s.name === sup.name && s.unit === sup.unit);
        if (existing) existing.qty += sup.qtyPerBatch;
        else suggested.push({ name: sup.name, qty: sup.qtyPerBatch, unit: sup.unit });
      });
    });
    setMatDraftItems(suggested.length > 0 ? suggested : [{ name: "", qty: 1, unit: "" }]);
    setShowMatForm(true);
  };

  const submitMatForm = async () => {
    const items = matDraftItems.filter(i => i.name.trim());
    if (items.length === 0) return;
    const req: MaterialRequest = { id: `MAT-${Date.now()}`, items, status: "pending-approval", createdAt: new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) };
    setMaterialReqs(prev => [...prev, req]);
    await db.replaceMaterialRequests([...materialReqs, req]).catch(console.error);
    setShowMatForm(false);
  };

  const updateCustomOrder = (id: string, status: CustomOrder["status"]) => {
    setCustomOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  };

  const updateDecoTask = (id: string, status: DecoTask["status"]) => {
    setDecoQueue(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  const pendingRecipes = productCatalog.filter(p => !recipes.some(r => r.productName === p)).length;
  const pendingDecoTasks = decoQueue.filter(t => t.status === "pending").length;
  const pendingCustomOrders = customOrders.filter(o => o.status === "pending").length;

  const totalNeeded = dosForDeco.reduce((s, d) => {
    const recipe = recipes.find(r => r.productName === d.product);
    return s + (recipe?.ingredients.length ?? 0);
  }, 0);
  const totalPrepared = freeMixPrepared.size;
  const allMixesDone = dosForDeco.every(d => freeMixDone.has(d.product));

  const workflowSteps = [
    { id: "dashboard", label: "DOS Received" },
    { id: "recipes", label: "Recipe Formulas" },
    { id: "free-mix", label: "Production Prep" },
    { id: "deco-queue", label: "Decoration Queue" },
    { id: "custom-orders", label: "Custom Orders" },
  ];
  const currentStepIdx = workflowSteps.findIndex(s => s.id === activeTab);
  const nextStep = currentStepIdx >= 0 && currentStepIdx < workflowSteps.length - 1 ? workflowSteps[currentStepIdx + 1] : null;

  /* ── Dashboard ── */
  if (activeTab === "dashboard") {
    const totalPkg = dosForDeco.reduce((s, d) => {
      const recipe = recipes.find(r => r.productName === d.product);
      return s + ((recipe?.packagingMaterials ?? []).length || 0);
    }, 0);
    const totalDecoItems = dosForDeco.reduce((s, d) => {
      const recipe = recipes.find(r => r.productName === d.product);
      return s + ((recipe?.decorationSupplies ?? []).length || 0);
    }, 0);

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">DOS Received</h1>
            <p className="mt-1 text-[13px] text-zinc-500">Admin issued these items. Your job is to prepare the Free Mix (ingredient pre-mixes) for each product.</p>
          </div>
          {dosForDeco.length > 0 && (
            <div className="shrink-0 rounded-xl bg-rose-100 px-4 py-2.5 text-center">
              <div className="text-[10px] text-rose-600 uppercase font-medium tracking-wider">DOS Total</div>
              <div className="text-[22px] font-bold text-zinc-900 mt-0.5" style={{ fontFamily: "Fragment Mono, monospace" }}>{dosForDeco.reduce((s, d) => s + d.qty, 0)}</div>
              <div className="text-[10px] text-rose-500">{dosForDeco.length} item{dosForDeco.length > 1 ? "s" : ""}</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button onClick={() => setSummaryModal("products")} className="rounded-xl border border-zinc-200 bg-white p-3 text-left hover:border-zinc-400 hover:shadow-sm transition-all">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Products to Mix</div>
            <div className="text-[22px] font-semibold mt-0.5">{dosForDeco.length}</div>
            <div className="text-[10px] text-zinc-400 mt-1">Click to view →</div>
          </button>
          <button onClick={() => setSummaryModal("ingredients")} className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-left hover:border-rose-400 hover:shadow-sm transition-all">
            <div className="text-[11px] text-rose-500 uppercase tracking-wider">Ingredients Needed</div>
            <div className="text-[22px] font-semibold mt-0.5 text-rose-700">{totalNeeded}</div>
            <div className="text-[10px] text-rose-400 mt-1">Click to view →</div>
          </button>
          <button onClick={() => setSummaryModal("packaging")} className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-left hover:border-blue-400 hover:shadow-sm transition-all">
            <div className="text-[11px] text-blue-500 uppercase tracking-wider">Packaging Materials</div>
            <div className="text-[22px] font-semibold mt-0.5 text-blue-700">{totalPkg}</div>
            <div className="text-[10px] text-blue-400 mt-1">Click to view →</div>
          </button>
          <button onClick={() => setSummaryModal("deco")} className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 text-left hover:border-purple-400 hover:shadow-sm transition-all">
            <div className="text-[11px] text-purple-500 uppercase tracking-wider">Deco Supplies</div>
            <div className="text-[22px] font-semibold mt-0.5 text-purple-700">{totalDecoItems}</div>
            <div className="text-[10px] text-purple-400 mt-1">Click to view →</div>
          </button>
        </div>

        {dosForDeco.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center"><p className="text-[14px] text-zinc-400">No DOS items assigned for today.</p></div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 bg-rose-50 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  <th className="w-10 px-3 py-2.5"></th>
                  <th className="px-2 py-2.5">Product</th>
                  <th className="px-2 py-2.5">Priority</th>
                  <th className="px-2 py-2.5 text-right">Total</th>
                  <th className="px-2 py-2.5 text-right">Cakes N Styles Gensan</th>
                  <th className="px-2 py-2.5 text-right">Shadrach's Bake & Brew</th>
                  <th className="w-14 px-3 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {dosForDeco.map(d => {
                  const recipe = recipes.find(r => r.productName === d.product);
                  const hasDetails = recipe && ((recipe.ingredients.length > 0) || (recipe.packagingMaterials ?? []).length > 0 || (recipe.decorationSupplies ?? []).length > 0);
                  const isExpanded = expandedRows.has(d.id);
                  const pColor = d.priority === "HIGH" ? "bg-red-100 text-red-700" : d.priority === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600";
                  const sDot = d.status === "completed" ? "bg-emerald-500" : d.status === "in-progress" ? "bg-amber-500" : "bg-zinc-300";
                  return (
                    <Fragment key={d.id}>
                      <tr className="border-b border-zinc-50 text-[13px] hover:bg-zinc-50/50 transition-colors">
                        <td className="px-3 py-2.5 text-center">
                          {hasDetails && (
                            <button onClick={() => setExpandedRows(prev => { const n = new Set(prev); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} className="grid h-6 w-6 place-items-center rounded-lg hover:bg-zinc-200 transition-colors text-zinc-500 text-[10px]">
                              {isExpanded ? "▾" : "▸"}
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-2.5 font-medium text-zinc-900">{d.product} {newDOSIds?.has(d.id) && <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 uppercase tracking-wider">New</span>}</td>
                        <td className="px-2 py-2.5"><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${pColor}`}>{d.priority}</span></td>
                        <td className="px-2 py-2.5 text-right font-mono text-zinc-800">{d.qty}</td>
                        <td className="px-2 py-2.5 text-right font-mono text-zinc-600">{d.branch1}</td>
                        <td className="px-2 py-2.5 text-right font-mono text-zinc-600">{d.branch2}</td>
                        <td className="px-3 py-2.5 text-right"><span className={`inline-block h-2 w-2 rounded-full ${sDot}`} /></td>
                      </tr>
                      {isExpanded && hasDetails && (
                        <tr key={`${d.id}-details`}>
                          <td colSpan={7} className="px-3 pb-3 pt-1">
                            <div className="ml-7 space-y-2">
                              {recipe!.ingredients.length > 0 && (
                                <div className="rounded-lg border border-rose-200 bg-rose-50/50 overflow-hidden">
                                  <div className="flex items-center gap-1.5 bg-rose-100/60 px-2.5 py-1 border-b border-rose-100">
                                    <span className="text-[9px] font-semibold text-rose-500 uppercase tracking-wider">Ingredients</span>
                                    <span className="ml-auto rounded-full bg-rose-100 px-1.5 py-0.5 text-[8px] font-mono text-rose-600">{recipe!.ingredients.length}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 px-2.5 py-1.5">
                                    {recipe!.ingredients.map((ing, i) => {
                                      const neededQty = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
                                      return (
                                        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[10px]">
                                          <span className="text-zinc-700 font-medium">{ing.name}</span>
                                          <span className="text-rose-600 font-mono">×{neededQty}{ing.unit}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {(recipe!.packagingMaterials ?? []).length > 0 && (
                                <div className="rounded-lg border border-blue-200 bg-blue-50/50 overflow-hidden">
                                  <div className="flex items-center gap-1.5 bg-blue-100/60 px-2.5 py-1 border-b border-blue-100">
                                    <span className="text-[9px] font-semibold text-blue-500 uppercase tracking-wider">Packaging</span>
                                    <span className="ml-auto rounded-full bg-blue-100 px-1.5 py-0.5 text-[8px] font-mono text-blue-600">{recipe!.packagingMaterials.length}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 px-2.5 py-1.5">
                                    {recipe!.packagingMaterials.map((mat, i) => (
                                      <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-blue-200 px-1.5 py-0.5 text-[10px]">
                                        <span className="text-zinc-700 font-medium">{mat.name}</span>
                                        <span className="text-blue-600 font-mono">×{mat.qtyPerBatch}{mat.unit}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(recipe!.decorationSupplies ?? []).length > 0 && (
                                <div className="rounded-lg border border-purple-200 bg-purple-50/50 overflow-hidden">
                                  <div className="flex items-center gap-1.5 bg-purple-100/60 px-2.5 py-1 border-b border-purple-100">
                                    <span className="text-[9px] font-semibold text-purple-500 uppercase tracking-wider">Deco Supplies</span>
                                    <span className="ml-auto rounded-full bg-purple-100 px-1.5 py-0.5 text-[8px] font-mono text-purple-600">{recipe!.decorationSupplies.length}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 px-2.5 py-1.5">
                                    {recipe!.decorationSupplies.map((sup, i) => (
                                      <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-purple-200 px-1.5 py-0.5 text-[10px]">
                                        <span className="text-zinc-700 font-medium">{sup.name}</span>
                                        <span className="text-purple-600 font-mono">×{sup.qtyPerBatch}{sup.unit}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-200 bg-rose-50 text-[13px] font-semibold text-zinc-800">
                  <td colSpan={3} className="px-3 py-2.5">Total</td>
                  <td className="px-2 py-2.5 text-right font-mono">{dosForDeco.reduce((s, d) => s + d.qty, 0)}</td>
                  <td className="px-2 py-2.5 text-right font-mono">{dosForDeco.reduce((s, d) => s + d.branch1, 0)}</td>
                  <td className="px-2 py-2.5 text-right font-mono">{dosForDeco.reduce((s, d) => s + d.branch2, 0)}</td>
                  <td className="px-3 py-2.5" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Summary Modals */}
        {summaryModal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={() => setSummaryModal(null)}>
            <div className="w-full max-w-[520px] max-h-[80vh] rounded-[28px] border border-zinc-200 bg-white shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <h3 className="text-[16px] font-semibold">
                  {summaryModal === "products" && "All Products"}
                  {summaryModal === "ingredients" && "Ingredients Needed"}
                  {summaryModal === "packaging" && "Packaging Materials"}
                  {summaryModal === "deco" && "Decoration Supplies"}
                </h3>
                <button onClick={() => setSummaryModal(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600">✕</button>
              </div>
              <div className="overflow-y-auto px-6 py-4 space-y-2">
                {summaryModal === "products" && dosForDeco.map(d => (
                  <div key={d.id} className="flex items-center justify-between rounded-xl border border-zinc-100 px-3.5 py-2.5">
                    <div>
                      <span className="text-[13px] font-medium text-zinc-900">{d.product}</span>
                      <span className="ml-2 text-[12px] text-zinc-400 font-mono">×{d.qty}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${d.priority === "HIGH" ? "bg-red-100 text-red-700" : d.priority === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>{d.priority}</span>
                  </div>
                ))}
                {summaryModal === "ingredients" && dosForDeco.flatMap(d => {
                  const recipe = recipes.find(r => r.productName === d.product);
                  return (recipe?.ingredients ?? []).map(ing => {
                    const neededQty = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
                    return { product: d.product, name: ing.name, qty: neededQty, unit: ing.unit, key: `${d.id}-${ing.name}` };
                  });
                }).map(item => (
                  <div key={item.key} className="flex items-center justify-between rounded-xl border border-rose-100 px-3.5 py-2.5">
                    <div>
                      <span className="text-[13px] font-medium text-zinc-900">{item.name}</span>
                      <span className="ml-2 text-[11px] text-zinc-400">for {item.product}</span>
                    </div>
                    <span className="text-[13px] font-mono font-medium text-rose-600">{item.qty} {item.unit}</span>
                  </div>
                ))}
                {summaryModal === "packaging" && dosForDeco.flatMap(d => {
                  const recipe = recipes.find(r => r.productName === d.product);
                  return (recipe?.packagingMaterials ?? []).map(mat => ({
                    product: d.product, name: mat.name, qty: mat.qtyPerBatch, unit: mat.unit, key: `${d.id}-pkg-${mat.name}`
                  }));
                }).map(item => (
                  <div key={item.key} className="flex items-center justify-between rounded-xl border border-blue-100 px-3.5 py-2.5">
                    <div>
                      <span className="text-[13px] font-medium text-zinc-900">{item.name}</span>
                      <span className="ml-2 text-[11px] text-zinc-400">for {item.product}</span>
                    </div>
                    <span className="text-[13px] font-mono font-medium text-blue-600">{item.qty} {item.unit}</span>
                  </div>
                ))}
                {summaryModal === "deco" && dosForDeco.flatMap(d => {
                  const recipe = recipes.find(r => r.productName === d.product);
                  return (recipe?.decorationSupplies ?? []).map(sup => ({
                    product: d.product, name: sup.name, qty: sup.qtyPerBatch, unit: sup.unit, key: `${d.id}-deco-${sup.name}`
                  }));
                }).map(item => (
                  <div key={item.key} className="flex items-center justify-between rounded-xl border border-purple-100 px-3.5 py-2.5">
                    <div>
                      <span className="text-[13px] font-medium text-zinc-900">{item.name}</span>
                      <span className="ml-2 text-[11px] text-zinc-400">for {item.product}</span>
                    </div>
                    <span className="text-[13px] font-mono font-medium text-purple-600">{item.qty} {item.unit}</span>
                  </div>
                ))}
              </div>
              <div className="px-6 pb-5 pt-2 border-t border-zinc-100">
                <button onClick={() => setSummaryModal(null)} className="w-full rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Workflow Nav */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
          <div className="text-[12px] text-zinc-400">Step {currentStepIdx + 1} of {workflowSteps.length}</div>
          {nextStep && (
            <button onClick={() => setActiveTab(nextStep.id)} className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all">
              Next: {nextStep.label} →
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── Recipe Formulas ── */
  if (activeTab === "recipes") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Recipe Formulas</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Create and manage product recipes, ingredient quantities, and formulations.</p>
        </div>

        {editingRecipe && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={() => setEditingRecipe(null)}>
            <div className="w-full max-w-[520px] rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-[17px] font-semibold text-zinc-900">Recipe: {editingRecipe}</h3>
                  <p className="mt-0.5 text-[12px] text-zinc-500">Define ingredients and quantities per batch.</p>
                </div>
                <button onClick={() => setEditingRecipe(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700">✕</button>
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {recipeDraft.map((ing, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-zinc-100 p-2.5">
                    <div className="flex-1">
                      <input value={ing.name} onChange={e => updIngredient(i, "name", e.target.value)} placeholder="Ingredient name" list="ingredient-list" className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-zinc-400" />
                    </div>
                    <input type="number" min="0" step="0.01" value={ing.qtyPerBatch || ""} onChange={e => updIngredient(i, "qtyPerBatch", Number(e.target.value))} placeholder="Qty" className="w-16 rounded-lg border border-zinc-200 px-2 py-1.5 text-[13px] text-center outline-none focus:border-zinc-400 font-mono" />
                    <input value={ing.unit} onChange={e => updIngredient(i, "unit", e.target.value)} placeholder="Unit" className="w-16 rounded-lg border border-zinc-200 px-2 py-1.5 text-[13px] outline-none focus:border-zinc-400" />
                    <button onClick={() => delIngredient(i)} className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500">✕</button>
                  </div>
                ))}
              </div>
              <datalist id="ingredient-list">
                {allIngredients.map(i => <option key={i.id} value={i.name} />)}
              </datalist>
              <button onClick={addIngredient} className="mt-2 text-[12px] font-medium text-rose-600 hover:text-rose-700">+ Add Ingredient</button>
              <div className="mt-4 flex gap-2">
                <button onClick={() => setEditingRecipe(null)} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={handleSaveRecipe} className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800">Save Recipe</button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {productCatalog.map(product => {
            const recipe = recipes.find(r => r.productName === product);
            return (
              <div key={product} className="rounded-2xl border border-zinc-200 bg-white p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[15px] font-semibold text-zinc-900">{product}</span>
                    {recipe && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Active</span>}
                    {!recipe && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">No Recipe</span>}
                  </div>
                  <button onClick={() => handleEditRecipe(product)} className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 transition-all">
                    {recipe ? "Edit Formula" : "+ Set Formula"}
                  </button>
                </div>
                {recipe && recipe.ingredients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {recipe.ingredients.map((ing, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 px-2 py-0.5 text-[11px]">
                        <span className="text-zinc-700 font-medium">{ing.name}</span>
                        <span className="text-rose-600 font-mono">{ing.qtyPerBatch}{ing.unit}</span>
                      </span>
                    ))}
                  </div>
                )}
                {(!recipe || recipe.ingredients.length === 0) && (
                  <p className="text-[12px] text-zinc-400 italic">No ingredients defined yet.</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Workflow Nav */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
          <div className="text-[12px] text-zinc-400">Step {currentStepIdx + 1} of {workflowSteps.length}</div>
          {nextStep && (
            <button onClick={() => setActiveTab(nextStep.id)} className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all">
              Next: {nextStep.label} →
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── Production Prep ── */
  if (activeTab === "free-mix") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Production Preparation</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Prepare ingredient pre-mixes per DOS product and deduct from Warehouse.</p>
        </div>

        {dosForDeco.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center"><p className="text-[14px] text-zinc-400">No DOS items assigned for today.</p></div>
        ) : (
          <div className="space-y-3">
            {dosForDeco.map(d => {
              const recipe = recipes.find(r => r.productName === d.product);
              const isDone = freeMixDone.has(d.product);
              const allPrepared = recipe ? recipe.ingredients.every(ing => freeMixPrepared.has(`${d.id}-${ing.name}`)) : false;
              return (
                <div key={d.id} className={`rounded-2xl border p-5 ${isDone ? "border-emerald-200 bg-emerald-50/30" : "border-zinc-200 bg-white"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-[15px] font-semibold text-zinc-900">{d.product}</span>
                      <span className="ml-2 text-[12px] text-zinc-500">×{d.qty}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isDone ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700">✓ Mixed & Deducted</span>
                      ) : recipe && allPrepared ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700">✓ All Mixed</span>
                      ) : recipe ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-medium text-amber-700">{recipe.ingredients.filter(ing => freeMixPrepared.has(`${d.id}-${ing.name}`)).length}/{recipe.ingredients.length} Mixed</span>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-medium text-zinc-500">No Recipe</span>
                      )}
                    </div>
                  </div>

                  {!isDone && (
                    <div className="flex items-center gap-2 mb-3">
                      <button onClick={() => handleEditRecipe(d.product)} className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 transition-all">
                        {recipe ? "Edit Recipe" : "+ Set Recipe"}
                      </button>
                    </div>
                  )}

                  {recipe ? (
                    <div className="space-y-3">
                      {recipe.ingredients.length > 0 && (
                        <div className="rounded-xl border border-rose-200 overflow-hidden">
                          <div className="flex items-center gap-2 bg-rose-50 px-3.5 py-2 border-b border-rose-100">
                            <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Ingredients</span>
                            <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-mono font-medium text-rose-600">{recipe.ingredients.length}</span>
                          </div>
                          <div className="divide-y divide-rose-50">
                            {recipe.ingredients.map((ing, i) => {
                              const neededQty = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
                              const invItem = allIngredients.find(ii => ii.id === ing.inventoryId || ii.name.toLowerCase() === ing.name.toLowerCase());
                              const hasStock = invItem ? invItem.onHand >= neededQty : true;
                              const isPrepared = freeMixPrepared.has(`${d.id}-${ing.name}`);
                              return (
                                <div key={i} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-rose-50/30 transition-colors">
                                  {!isDone && (
                                    <button onClick={() => togglePrepared(`${d.id}-${ing.name}`)} className={`shrink-0 grid h-5 w-5 place-items-center rounded-md border text-[10px] transition-all ${isPrepared ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-300 text-transparent hover:border-zinc-400"}`}>{isPrepared ? "✓" : ""}</button>
                                  )}
                                  <span className="flex-1 text-[13px] text-zinc-800">{ing.name}</span>
                                  <span className="text-[12px] font-mono font-medium text-zinc-700">{neededQty} {ing.unit}</span>
                                  <span className={`text-[11px] ${hasStock ? "text-emerald-600" : "text-red-500"}`}>{hasStock ? invItem ? `${invItem.onHand} in stock` : "In stock" : "Low stock!"}</span>
                                  {isDone && <span className="text-[11px] text-emerald-600 font-medium">Deducted ✓</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {(recipe.packagingMaterials ?? []).length > 0 && (
                        <div className="rounded-xl border border-blue-200 overflow-hidden">
                          <div className="flex items-center gap-2 bg-blue-50 px-3.5 py-2 border-b border-blue-100">
                            <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Packaging Materials</span>
                            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-mono font-medium text-blue-600">{recipe.packagingMaterials.length}</span>
                          </div>
                          <div className="divide-y divide-blue-50">
                            {recipe.packagingMaterials.map((mat, i) => {
                              const invItem = inventory.find(ii => ii.id === mat.inventoryId);
                              return (
                                <div key={`pkg-${i}`} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-blue-50/30 transition-colors">
                                  <span className="shrink-0 grid h-5 w-5 place-items-center rounded-md bg-blue-100 text-[10px] text-blue-500">□</span>
                                  <span className="flex-1 text-[13px] text-zinc-800">{mat.name}</span>
                                  <span className="text-[12px] font-mono font-medium text-zinc-700">{mat.qtyPerBatch} {mat.unit}</span>
                                  <span className="text-[11px] text-blue-500">{invItem ? `${invItem.onHand} in stock` : "—"}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {(recipe.decorationSupplies ?? []).length > 0 && (
                        <div className="rounded-xl border border-purple-200 overflow-hidden">
                          <div className="flex items-center gap-2 bg-purple-50 px-3.5 py-2 border-b border-purple-100">
                            <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">Decoration Supplies</span>
                            <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-mono font-medium text-purple-600">{recipe.decorationSupplies.length}</span>
                          </div>
                          <div className="divide-y divide-purple-50">
                            {recipe.decorationSupplies.map((sup, i) => {
                              const invItem = inventory.find(ii => ii.id === sup.inventoryId);
                              return (
                                <div key={`deco-${i}`} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-purple-50/30 transition-colors">
                                  <span className="shrink-0 grid h-5 w-5 place-items-center rounded-md bg-purple-100 text-[10px] text-purple-500">○</span>
                                  <span className="flex-1 text-[13px] text-zinc-800">{sup.name}</span>
                                  <span className="text-[12px] font-mono font-medium text-zinc-700">{sup.qtyPerBatch} {sup.unit}</span>
                                  <span className="text-[11px] text-purple-500">{invItem ? `${invItem.onHand} in stock` : "—"}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-center">
                      <p className="text-[13px] text-zinc-400">No recipe set for {d.product}.</p>
                      <button onClick={() => handleEditRecipe(d.product)} className="mt-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-zinc-800">Create Recipe</button>
                    </div>
                  )}

                  {!isDone && recipe && allPrepared && (
                    <button onClick={() => handleCompleteMix(d.product)} className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-[13px] font-medium text-white hover:bg-emerald-700 transition-all active:scale-[0.98]">
                      Complete Mix & Deduct from Stock
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Workflow Nav */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
          <div className="text-[12px] text-zinc-400">Step {currentStepIdx + 1} of {workflowSteps.length}</div>
          {nextStep && (
            <button onClick={() => setActiveTab(nextStep.id)} className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all">
              Next: {nextStep.label} →
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── Decoration Queue ── */
  if (activeTab === "deco-queue") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Decoration Queue</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Manage decoration tasks for each product order.</p>
        </div>

        <div className="space-y-3">
          {decoQueue.map(task => (
            <div key={task.id} className={`rounded-2xl border p-5 ${task.status === "completed" ? "border-emerald-200 bg-emerald-50/30" : "border-zinc-200 bg-white"}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-[15px] font-semibold text-zinc-900">{task.product}</span>
                  <span className="ml-2 text-[12px] text-zinc-400">{task.orderRef}</span>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${task.status === "completed" ? "bg-emerald-100 text-emerald-700" : task.status === "in-progress" ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-600"}`}>{task.status}</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-zinc-500 mb-3">
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-600">{task.theme}</span>
                <span>{task.notes}</span>
              </div>
              {task.status !== "completed" && (
                <div className="flex gap-2">
                  {task.status === "pending" && (
                    <button onClick={() => updateDecoTask(task.id, "in-progress")} className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-700 transition-all">Start Decorating</button>
                  )}
                  {task.status === "in-progress" && (
                    <button onClick={() => updateDecoTask(task.id, "completed")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700 transition-all">Mark Finished</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Workflow Nav */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
          <div className="text-[12px] text-zinc-400">Step {currentStepIdx + 1} of {workflowSteps.length}</div>
          {nextStep && (
            <button onClick={() => setActiveTab(nextStep.id)} className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all">
              Next: {nextStep.label} →
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── Custom Orders ── */
  if (activeTab === "custom-orders") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Custom Orders</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Manage customer-requested customizations and special designs.</p>
        </div>

        <div className="space-y-3">
          {customOrders.map(order => (
            <div key={order.id} className={`rounded-2xl border p-5 ${order.status === "completed" ? "border-emerald-200 bg-emerald-50/30" : "border-zinc-200 bg-white"}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-[15px] font-semibold text-zinc-900">{order.customer}</span>
                  <span className="ml-2 text-[12px] text-zinc-400">{order.product}</span>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${order.status === "completed" ? "bg-emerald-100 text-emerald-700" : order.status === "in-progress" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{order.status}</span>
              </div>
              <div className="rounded-xl bg-zinc-50 border border-zinc-100 px-3.5 py-2.5 mb-3">
                <div className="text-[11px] text-zinc-400 uppercase tracking-wider mb-1">Request</div>
                <p className="text-[13px] text-zinc-700">{order.request}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">{order.createdAt}</span>
                {order.status !== "completed" && (
                  <div className="flex gap-2">
                    {order.status === "pending" && (
                      <button onClick={() => updateCustomOrder(order.id, "in-progress")} className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-700 transition-all">Start</button>
                    )}
                    {order.status === "in-progress" && (
                      <button onClick={() => updateCustomOrder(order.id, "completed")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700 transition-all">Complete</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Decoration Materials ── */
  if (activeTab === "decoration-supplies") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Decoration Materials</h1>
          <p className="mt-1 text-[13px] text-zinc-500">View decoration supply stock. Contact Admin to replenish.</p>
        </div>
        {decoMaterials.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center"><p className="text-[14px] text-zinc-400">No decoration materials in inventory.</p></div>
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm">
            <table className="w-full">
              <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3 text-right">On Hand</th><th className="px-4 py-3 text-right">Threshold</th><th className="px-4 py-3">Unit</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-[13px]">
                {decoMaterials.map(item => (
                  <tr key={item.id} className="hover:bg-amber-50/40">
                    <td className="px-4 py-3 font-medium text-zinc-900">{item.name}</td>
                    <td className="px-4 py-3 text-zinc-500 font-mono text-[12px]">{item.sku}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium" style={{ color: item.onHand === 0 ? "#ef4444" : item.onHand < item.threshold ? "#f59e0b" : "#16a34a" }}>{item.onHand}</td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-500">{item.threshold}</td>
                    <td className="px-4 py-3 text-zinc-500">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  /* ── Ingredients ── */
  if (activeTab === "ingredients") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Ingredients</h1>
          <p className="mt-1 text-[13px] text-zinc-500">View ingredient stock from the Warehouse.</p>
        </div>
        {ingredientItems.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center"><p className="text-[14px] text-zinc-400">No ingredients in inventory.</p></div>
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm">
            <table className="w-full">
              <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3 text-right">On Hand</th><th className="px-4 py-3 text-right">Threshold</th><th className="px-4 py-3">Unit</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-[13px]">
                {ingredientItems.map(item => (
                  <tr key={item.id} className="hover:bg-amber-50/40">
                    <td className="px-4 py-3 font-medium text-zinc-900">{item.name}</td>
                    <td className="px-4 py-3 text-zinc-500 font-mono text-[12px]">{item.sku}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium" style={{ color: item.onHand === 0 ? "#ef4444" : item.onHand < item.threshold ? "#f59e0b" : "#16a34a" }}>{item.onHand}</td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-500">{item.threshold}</td>
                    <td className="px-4 py-3 text-zinc-500">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  /* ── Materials Request ── */
  if (activeTab === "materials") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Materials Request</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Request decoration materials from the Warehouse.</p>
        </div>

        <button onClick={openMatForm} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800">+ New Request</button>

        {showMatForm && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold">New Material Request</h3>
              <button onClick={() => setShowMatForm(false)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-zinc-100 text-zinc-400">✕</button>
            </div>
            {matDraftItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={item.name} onChange={e => setMatDraftItems(prev => prev.map((it, idx) => idx === i ? { ...it, name: e.target.value } : it))} placeholder="Material name" className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] outline-none focus:border-zinc-400" />
                <input type="number" min="1" value={item.qty} onChange={e => setMatDraftItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: Number(e.target.value) } : it))} className="w-20 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] text-center outline-none focus:border-zinc-400 font-mono" />
                <input value={item.unit} onChange={e => setMatDraftItems(prev => prev.map((it, idx) => idx === i ? { ...it, unit: e.target.value } : it))} placeholder="Unit" className="w-20 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] outline-none focus:border-zinc-400" />
                <button onClick={() => setMatDraftItems(prev => prev.filter((_, idx) => idx !== i))} className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50">✕</button>
              </div>
            ))}
            <div className="flex gap-2">
              <button onClick={() => setMatDraftItems(prev => [...prev, { name: "", qty: 1, unit: "" }])} className="rounded-xl border border-zinc-200 px-3 py-2 text-[12px] font-medium text-zinc-600 hover:bg-zinc-50">+ Add Item</button>
              <button onClick={submitMatForm} className="ml-auto rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">Submit Request</button>
            </div>
          </div>
        )}

        {materialReqs.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center"><p className="text-[14px] text-zinc-400">No material requests yet.</p></div>
        ) : (
          <div className="space-y-3">
            {materialReqs.map(req => (
              <div key={req.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-zinc-400">{req.id}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${req.status === "approved" || req.status === "released" ? "bg-emerald-100 text-emerald-700" : req.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{req.status}</span>
                </div>
                <div className="space-y-1">
                  {req.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-[13px]">
                      <span className="text-zinc-800">{item.name}</span>
                      <span className="font-mono text-zinc-600">{item.qty} {item.unit}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-zinc-400">{req.createdAt}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── Freezer Tab ── */
  if (activeTab === "freezer") {
    const myFreezer = freezerItems.filter(i => i.producedBy === "deco");
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
        producedBy: "deco",
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
          <div><h1 className="text-[24px] font-semibold">Freezer — Finished Products</h1><p className="mt-1 text-[13px] text-zinc-600">Track decorated products ready for dispatch.</p></div>
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

        {freezerHistory.filter(h => h.producedBy === "deco").length > 0 && (
          <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
            <h2 className="text-[16px] font-semibold mb-3">Dispatch History</h2>
            <div className="space-y-1.5">
              {freezerHistory.filter(h => h.producedBy === "deco").map(h => (
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

  return null;
}

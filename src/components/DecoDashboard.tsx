import { useEffect, useState, Fragment } from "react";
import type { ProductionTask, DOSItem, ProductRecipe, InventoryItem, FreezerItem, FreezerHistory } from "../types";
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
  const [advMixSearch, setAdvMixSearch] = useState("");
  const [selectedAdvRecipes, setSelectedAdvRecipes] = useState<Set<string>>(new Set());
  const [advMixQtys, setAdvMixQtys] = useState<Record<string, number>>({});
  const [advMixAdjustments, setAdvMixAdjustments] = useState<Record<string, Record<string, number>>>({});
  const [isAdvLocked, setIsAdvLocked] = useState(false);

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
  const [freezerTab, setFreezerTab] = useState<"Display Cakes" | "Production Recipe" | "My Inventory">("Display Cakes");

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
      const neededQty = Math.ceil(ing.qtyPerBatch * dos.qty);
      const idx = newInv.findIndex(i => i.id === ing.inventoryId);
      if (idx >= 0) { newInv[idx] = { ...newInv[idx], onHand: Math.max(0, newInv[idx].onHand - neededQty) }; deductions.push(ing.name); }
    });
    onUpdateInventory(newInv);
    await db.upsertInventory(newInv).catch(console.error);
    onAddAuditLog?.("FREE_MIX_COMPLETED", `${product}: ${deductions.join(", ")}`);
    setFreeMixDone(prev => new Set(prev).add(product));
    recipe.ingredients.forEach(ing => togglePrepared(`${dos.id}-${ing.name}`));
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

  const getRecipesForProduct = (product: string) => {
    const direct = recipes.filter(r => r.productName === product);
    const linked = recipes.filter(r => (r.linkedProduct ?? []).includes(product) && r.productName !== product);
    return [...direct, ...linked];
  };

  const totalNeeded = dosForDeco.reduce((s, d) => {
    const productRecipes = getRecipesForProduct(d.product);
    return s + productRecipes.reduce((sum, r) => sum + r.ingredients.length, 0);
  }, 0);
  const totalPrepared = freeMixPrepared.size;
  const allMixesDone = dosForDeco.every(d => freeMixDone.has(d.product));

  const workflowSteps = [
    { id: "dashboard", label: "DOS Received" },
    { id: "free-mix", label: "Production Prep" },
    { id: "advanced-premix", label: "Advanced Premix" },
    { id: "deco-queue", label: "Decoration Queue" },
    { id: "freezer", label: "Finished Products" },
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
        <div className="rounded-2xl bg-zinc-900 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-white">DOS Received</h1>
              <p className="mt-1 text-[13px] text-zinc-400">Admin issued these items. Your job is to prepare the Free Mix (ingredient pre-mixes) for each product.</p>
            </div>
            {dosForDeco.length > 0 && (
              <div className="shrink-0 rounded-xl bg-white/10 px-4 py-2.5 text-center">
                <div className="text-[10px] text-zinc-400 uppercase font-medium tracking-wider">DOS Total</div>
                <div className="text-[22px] font-bold text-white mt-0.5" style={{ fontFamily: "Fragment Mono, monospace" }}>{dosForDeco.reduce((s, d) => s + d.qty, 0)}</div>
                <div className="text-[10px] text-zinc-500">{dosForDeco.length} item{dosForDeco.length > 1 ? "s" : ""}</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <button onClick={() => setSummaryModal("products")} className="rounded-xl border border-zinc-700 bg-zinc-800 p-3 text-left hover:border-zinc-500 hover:shadow-sm transition-all">
              <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Products to Mix</div>
              <div className="text-[22px] font-semibold mt-0.5 text-white">{dosForDeco.length}</div>
              <div className="text-[10px] text-zinc-500 mt-1">Click to view →</div>
            </button>
            <button onClick={() => setSummaryModal("ingredients")} className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-left hover:border-rose-600 hover:shadow-sm transition-all">
              <div className="text-[11px] text-rose-400 uppercase tracking-wider">Recipe Needed</div>
              <div className="text-[22px] font-semibold mt-0.5 text-rose-300">{totalNeeded}</div>
              <div className="text-[10px] text-rose-500 mt-1">Click to view →</div>
            </button>
            <button onClick={() => setSummaryModal("packaging")} className="rounded-xl border border-blue-800 bg-blue-950/50 p-3 text-left hover:border-blue-600 hover:shadow-sm transition-all">
              <div className="text-[11px] text-blue-400 uppercase tracking-wider">Packaging Materials</div>
              <div className="text-[22px] font-semibold mt-0.5 text-blue-300">{totalPkg}</div>
              <div className="text-[10px] text-blue-500 mt-1">Click to view →</div>
            </button>
            <button onClick={() => setSummaryModal("deco")} className="rounded-xl border border-purple-800 bg-purple-950/50 p-3 text-left hover:border-purple-600 hover:shadow-sm transition-all">
              <div className="text-[11px] text-purple-400 uppercase tracking-wider">Deco Supplies</div>
              <div className="text-[22px] font-semibold mt-0.5 text-purple-300">{totalDecoItems}</div>
              <div className="text-[10px] text-purple-500 mt-1">Click to view →</div>
            </button>
          </div>
        </div>

        {dosForDeco.length === 0 ? (
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-10 text-center"><p className="text-[14px] text-zinc-400">No DOS items assigned for today.</p></div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700 bg-zinc-800 text-left text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  <th className="w-10 px-3 py-2.5"></th>
                  <th className="px-2 py-2.5">Product</th>
                  <th className="px-2 py-2.5">Priority</th>
                  <th className="px-2 py-2.5 text-right">Total</th>
                  <th className="w-14 px-3 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {dosForDeco.map(d => {
                  const recipe = recipes.find(r => r.productName === d.product);
                  const hasDetails = recipe && ((recipe.ingredients.length > 0) || (recipe.packagingMaterials ?? []).length > 0 || (recipe.decorationSupplies ?? []).length > 0);
                  const isExpanded = expandedRows.has(d.id);
                  const pColor = d.priority === "HIGH" ? "bg-red-900/60 text-red-300" : d.priority === "MEDIUM" ? "bg-amber-900/60 text-amber-300" : "bg-zinc-700 text-zinc-400";
                  const sDot = d.status === "completed" ? "bg-emerald-500" : d.status === "in-progress" ? "bg-amber-500" : "bg-zinc-500";
                  return (
                    <Fragment key={d.id}>
                      <tr className="border-b border-zinc-800 text-[13px] hover:bg-zinc-800/50 transition-colors">
                        <td className="px-3 py-2.5 text-center">
                          {hasDetails && (
                            <button onClick={() => setExpandedRows(prev => { const n = new Set(prev); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} className="grid h-6 w-6 place-items-center rounded-lg hover:bg-zinc-700 transition-colors text-zinc-400 text-[10px]">
                              {isExpanded ? "▾" : "▸"}
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-2.5 font-medium text-zinc-100">{d.product} {newDOSIds?.has(d.id) && <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-900/60 px-1.5 py-0.5 text-[9px] font-bold text-blue-300 uppercase tracking-wider">New</span>}</td>
                        <td className="px-2 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${pColor}`}>{d.priority}</span></td>
                        <td className="px-2 py-2.5 text-right font-mono text-zinc-300">{d.qty}</td>
                        <td className="px-3 py-2.5 text-right"><span className={`inline-flex items-center gap-1.5 ${d.status === "completed" ? "text-emerald-400" : d.status === "in-progress" ? "text-amber-400" : "text-zinc-400"}`}><span className={`h-1.5 w-1.5 rounded-full ${sDot}`} />{d.status === "in-progress" ? "In Progress" : d.status === "completed" ? "Completed" : "Pending"}</span></td>
                      </tr>
                      {isExpanded && recipe && (
                        <tr key={`${d.id}-detail`}>
                          <td colSpan={5} className="px-3 pb-3">
                            <div className="bg-zinc-800 rounded-xl p-3 space-y-2 mt-1">
                              {recipe.ingredients.length > 0 && (
                                <div>
                                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-1">Ingredients</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {recipe.ingredients.map((ing, i) => <span key={i} className="rounded-lg bg-zinc-700 border border-zinc-600 px-2 py-1 text-[11px] text-zinc-200">{ing.name} {ing.qtyPerBatch}{ing.unit}</span>)}
                                  </div>
                                </div>
                              )}
                              {(recipe.packagingMaterials ?? []).length > 0 && (
                                <div>
                                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-1">Packaging</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {recipe.packagingMaterials!.map((p, i) => <span key={i} className="rounded-lg bg-zinc-700 border border-blue-800 px-2 py-1 text-[11px] text-blue-300">{p.name} {p.qtyPerBatch}{p.unit}</span>)}
                                  </div>
                                </div>
                              )}
                              {(recipe.decorationSupplies ?? []).length > 0 && (
                                <div>
                                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-1">Decoration</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {recipe.decorationSupplies!.map((s, i) => <span key={i} className="rounded-lg bg-zinc-700 border border-purple-800 px-2 py-1 text-[11px] text-purple-300">{s.name} {s.qtyPerBatch}{s.unit}</span>)}
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
</table>
          </div>
        )}

        {/* Summary Modals */}
        {summaryModal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={() => setSummaryModal(null)}>
            <div className="w-full max-w-[520px] max-h-[80vh] rounded-[28px] border border-zinc-200 bg-white shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <h3 className="text-[16px] font-semibold">Recipe Formula</h3>
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
                    const neededQty = Math.ceil(ing.qtyPerBatch * d.qty);
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
                              const neededQty = Math.ceil(ing.qtyPerBatch * d.qty);
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

  /* ── Advanced Premix ── */
  if (activeTab === "advanced-premix") {
    const filteredRecipes = recipes.filter(r => r.productName.toLowerCase().includes(advMixSearch.toLowerCase()) || advMixSearch === "").sort((a, b) => a.productName.localeCompare(b.productName));

    function toggleAdvRecipe(name: string) {
      setSelectedAdvRecipes(prev => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name); else next.add(name);
        return next;
      });
    }

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-6 pb-6 border-b border-zinc-100">
          <div>
            <h1 className="text-[32px] font-extrabold tracking-tight text-zinc-900">Advanced Freemix</h1>
            <p className="mt-1 text-[14px] text-zinc-500">Curate recipe batches and fine-tune ingredient compositions.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[14px]">⌕</span>
              <input 
                value={advMixSearch} 
                onChange={e => setAdvMixSearch(e.target.value)} 
                placeholder="Search recipes..." 
                className="w-64 rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 py-2.5 text-[13px] outline-none focus:border-zinc-400 transition-all" 
              />
            </div>
            
            <button 
              onClick={() => setIsAdvLocked(!isAdvLocked)}
              disabled={selectedAdvRecipes.size === 0}
              className={`group relative flex items-center gap-3 rounded-2xl px-6 py-3 text-[14px] font-bold text-white transition-all duration-300 shadow-md ${
                selectedAdvRecipes.size === 0 
                  ? "bg-zinc-200 text-zinc-400 cursor-not-allowed" 
                  : isAdvLocked 
                    ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200" 
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
              }`}
            >
              <span className="text-[18px]">{isAdvLocked ? "🔓" : "🔒"}</span>
              {isAdvLocked ? "Unlock" : "Lock"}
              <span className="flex items-center justify-center rounded-full bg-white/20 w-6 h-6 text-[12px] font-mono group-hover:bg-white/30">
                {selectedAdvRecipes.size}
              </span>
            </button>
          </div>
        </div>

        {/* Locked State View */}
        {isAdvLocked && (
          <div className="rounded-3xl border border-zinc-200 bg-white shadow-sm p-8 space-y-8">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 p-2.5 rounded-xl">
                 <span className="text-[20px]">⚖️</span>
              </div>
              <h2 className="text-[20px] font-bold text-zinc-900">Composition Adjustment</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from(selectedAdvRecipes).map(productName => {
                const recipe = recipes.find(r => r.productName === productName);
                const qty = advMixQtys[productName] || 1;
                if (!recipe) return null;
                return (
                  <div key={productName} className="rounded-2xl bg-zinc-50 p-5 border border-zinc-100 shadow-inner">
                    <div className="flex justify-between items-center mb-5">
                      <span className="font-bold text-[15px] text-zinc-900">{productName}</span>
                      <div className="flex items-center gap-2 bg-white rounded-lg border border-zinc-200 p-1">
                         <span className="text-[11px] font-semibold text-zinc-400 uppercase pl-2">Qty</span>
                         <input 
                            type="number" 
                            min="1"
                            value={qty}
                            onChange={e => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              setAdvMixQtys(prev => ({ ...prev, [productName]: val }));
                            }}
                            className="w-16 text-center rounded-md bg-zinc-100 px-2 py-1 text-[13px] font-bold font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                      </div>
                    </div>
                    <div className="space-y-2">
                      {recipe.ingredients.map((ing, i) => {
                        const baseQty = advMixAdjustments[productName]?.[ing.name] ?? ing.qtyPerBatch;
                        return (
                          <div key={i} className="flex justify-between text-[13px] items-center">
                            <span className="text-zinc-600">{ing.name} <span className="text-[10px] text-zinc-400 font-mono">(+{ing.qtyPerBatch})</span></span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                value={((ing.qtyPerBatch + (advMixAdjustments[productName]?.[ing.name] || 0)) * qty).toFixed(1)}
                                onChange={(e) => {
                                  const total = parseFloat(e.target.value) || 0;
                                  const newVal = (total / qty) - ing.qtyPerBatch;
                                  setAdvMixAdjustments(prev => ({
                                    ...prev,
                                    [productName]: { ...prev[productName], [ing.name]: isNaN(newVal) ? 0 : newVal }
                                  }));
                                }}
                                className="w-20 text-right font-mono font-semibold text-zinc-900 bg-white px-2 py-0.5 rounded border border-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none"
                              />
                              <span className="text-zinc-500 text-[11px] font-mono">{ing.unit}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="pt-6 border-t border-zinc-100 flex justify-end gap-3">
              <button onClick={() => setIsAdvLocked(false)} className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-zinc-600 hover:bg-zinc-100">Cancel</button>
              <button className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-white bg-zinc-900 hover:bg-zinc-800 flex items-center gap-2">
                Save to Freezer 📦
              </button>
            </div>
          </div>
        )}
        
        {/* Original Selection Grid - hide when locked to avoid confusion, or keep visible? User said "when its Locked the Ingredients ... must be Adjustable" */}
        {!isAdvLocked && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredRecipes.length === 0 ? (
              <div className="col-span-full text-center py-8 text-[13px] text-zinc-400">No recipes found.</div>
            ) : filteredRecipes.map(r => {
              const isSelected = selectedAdvRecipes.has(r.productName);
              const maxVisible = 6;
              const showMore = r.ingredients.length > maxVisible;
              const visibleIngredients = r.ingredients.slice(0, maxVisible);
              return (
                <button 
                  key={r.productName} 
                  type="button" 
                  onClick={() => toggleAdvRecipe(r.productName)} 
                  className={`group relative text-left rounded-3xl border p-5 transition-all duration-200 ${
                    isSelected 
                      ? "border-zinc-900 bg-white shadow-xl shadow-zinc-200" 
                      : "border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-lg hover:shadow-zinc-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                        isSelected ? "bg-zinc-900 border-zinc-900" : "border-zinc-300 group-hover:border-zinc-400"
                      }`}>
                        {isSelected && <span className="text-white text-[12px]">✓</span>}
                      </div>
                      <div>
                        <h3 className={`text-[16px] font-bold ${isSelected ? "text-zinc-900" : "text-zinc-800"}`}>{r.productName}</h3>
                        <p className="text-[11px] text-zinc-400 mt-0.5">{r.ingredients.length} Ingredients • {r.ingredients.length} items</p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Qty</span>
                        <input 
                          type="number" 
                          min="1"
                          value={advMixQtys[r.productName] || 1}
                          onClick={e => e.stopPropagation()}
                          onChange={e => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setAdvMixQtys(prev => ({ ...prev, [r.productName]: val }));
                          }}
                          className="w-16 text-center rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[13px] font-bold font-mono outline-none focus:border-zinc-600 focus:bg-white"
                        />
                      </div>
                    )}
                  </div>
                  
                  {r.ingredients.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-zinc-100">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {visibleIngredients.map((ing, i) => (
                          <div key={i} className="flex justify-between items-center text-[11px]">
                            <span className="text-zinc-600 truncate mr-2">{ing.name}</span>
                            <span className="font-mono font-medium text-zinc-900 shrink-0">{ing.qtyPerBatch}{ing.unit}</span>
                          </div>
                        ))}
                      </div>
                      {showMore && (
                        <p className="text-[10px] text-zinc-400 mt-2 font-medium">+ {r.ingredients.length - maxVisible} more ingredients</p>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
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

  /* ── Freezer Tab ── */
  if (activeTab === "freezer") {
    const myFreezer = freezerItems.filter(i => i.producedBy === "deco");
    
    // Categorization logic
    const tabs: ("Display Cakes" | "Production Recipe" | "My Inventory")[] = ["Display Cakes", "Production Recipe", "My Inventory"];
    const getFilteredItems = () => {
        if (freezerTab === "Display Cakes") return myFreezer.filter(i => i.notes?.toLowerCase().includes("cake") || i.productName.toLowerCase().includes("cake"));
        if (freezerTab === "Production Recipe") return myFreezer.filter(i => i.batchRef !== "");
        return myFreezer; // My Inventory
    };
    
    const filtered = getFilteredItems().filter(i => !freezerSearch || i.productName.toLowerCase().includes(freezerSearch.toLowerCase()));

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div><h1 className="text-[24px] font-semibold">Freezer — Finished Products</h1><p className="mt-1 text-[13px] text-zinc-600">Track decorated products ready for dispatch.</p></div>
          <button onClick={() => setShowAddFreezer(true)} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Add Product</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200">
            {tabs.map(tab => (
                <button key={tab} onClick={() => setFreezerTab(tab)} className={`px-4 py-2 text-[13px] font-medium ${freezerTab === tab ? "border-b-2 border-zinc-900 text-zinc-900" : "text-zinc-500 hover:text-zinc-700"}`}>
                    {tab}
                </button>
            ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">{freezerTab}</div><div className="text-[24px] font-semibold mt-1">{filtered.length}</div></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Total Qty</div><div className="text-[24px] font-semibold mt-1">{filtered.reduce((s, i) => s + i.qty, 0)} pcs</div></div>
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

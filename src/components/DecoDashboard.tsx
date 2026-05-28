import { useEffect, useState, Fragment } from "react";
import type { ProductionTask, DOSItem, MaterialRequest, ProductRecipe, InventoryItem, StockTransaction } from "../types";
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
  inventory: InventoryItem[];
  onUpdateInventory: (cb: InventoryItem[] | ((prev: InventoryItem[]) => InventoryItem[])) => void;
  onUpdateRecipes?: (cb: ProductRecipe[] | ((prev: ProductRecipe[]) => ProductRecipe[])) => void;
  onAddAuditLog?: (action: string, details: string) => void;
};

const steps = [
  { id: "dos", label: "DOS" },
  { id: "freemix", label: "Prepare Free Mix" },
  { id: "send", label: "Send to Baker" },
];

export default function DecoDashboard({ production, dosItems, onCompleteTask, activeTab, recipes, newDOSIds, onMarkDOSSeen, inventory, onUpdateInventory, onUpdateRecipes, onAddAuditLog }: Props) {
  const todayDOS = dosItems.filter(d => d.status !== "scheduled");
  const decoTaskProducts = new Set(production.filter(p => p.assignedTo === "deco").map(t => t.product));
  const dosForDeco = todayDOS.filter(d => decoTaskProducts.has(d.product));
  const decoProducts = new Set(dosForDeco.map(d => d.product));
  const myTasks = production.filter(p => p.assignedTo === "deco" && decoProducts.has(p.product));

  const [step, setStep] = useState(0);
  const [materialReqs, setMaterialReqs] = useState<MaterialRequest[]>([]);
  const [expandedSched, setExpandedSched] = useState<Set<string>>(new Set());
  const [selectedRecipe, setSelectedRecipe] = useState<typeof recipesData[number] | null>(null);
  const [freeMixPrepared, setFreeMixPrepared] = useState<Set<string>>(new Set());
  const [editingRecipe, setEditingRecipe] = useState<string | null>(null);
  const [recipeDraft, setRecipeDraft] = useState<{ inventoryId: string; name: string; qtyPerBatch: number; unit: string }[]>([]);
  const [freeMixDone, setFreeMixDone] = useState<Set<string>>(new Set());
  const [sentToBaker, setSentToBaker] = useState(false);
  const [bomOpen, setBomOpen] = useState(false);
  const [bomModal, setBomModal] = useState<{ product: string; category: "ingredients" | "packaging" | "deco"; items: { name: string; qty: number; unit: string; stock?: number }[] } | null>(null);
  const toggleSched = (date: string) => setExpandedSched(prev => { const n = new Set(prev); if (n.has(date)) n.delete(date); else n.add(date); return n; });

  const [showMatForm, setShowMatForm] = useState(false);
  const [matDraftItems, setMatDraftItems] = useState<{ name: string; qty: number; unit: string }[]>([]);
  const addMatDraftItem = () => setMatDraftItems(prev => [...prev, { name: "", qty: 1, unit: "" }]);
  const updMatDraftItem = (i: number, field: string, value: string | number) => setMatDraftItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  const delMatDraftItem = (i: number) => setMatDraftItems(prev => prev.filter((_, idx) => idx !== i));
  const openMatForm = () => {
    const suggested = getSuggestedMatItems();
    setMatDraftItems(suggested.length > 0 ? suggested : [{ name: "", qty: 1, unit: "" }]);
    setShowMatForm(true);
  };
  const submitMatForm = async () => {
    const items = matDraftItems.filter(i => i.name.trim());
    if (items.length === 0) return;
    const req: MaterialRequest = { id: `MAT-${Date.now()}`, items, status: "pending-approval", createdAt: new Date().toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) };
    setMaterialReqs(prev => [...prev, req]);
    await db.replaceMaterialRequests([...materialReqs, req]).catch(console.error);
    setShowMatForm(false);
  };
  const handleSubmitRequest = async (id: string) => {
    const updated = materialReqs.map(r => r.id === id ? { ...r, status: "pending-approval" as const } : r);
    setMaterialReqs(updated);
    await db.replaceMaterialRequests(updated).catch(console.error);
  };
  const handleCancelRequest = async (id: string) => {
    const updated = materialReqs.map(r => r.id === id ? { ...r, status: "cancelled" as const } : r);
    setMaterialReqs(updated);
    await db.replaceMaterialRequests(updated).catch(console.error);
  };

  const decoScheduled = dosItems.filter(d => d.status === "scheduled" && decoTaskProducts.has(d.product));

  const getSuggestedMatItems = () => {
    const map = new Map<string, { name: string; qty: number; unit: string }>();
    dosForDeco.forEach(d => {
      const recipe = recipes.find(r => r.productName === d.product);
      if (recipe) {
        recipe.ingredients.forEach(ing => {
          const qty = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
          const key = `${ing.name}|${ing.unit}`;
          if (map.has(key)) map.get(key)!.qty += qty;
          else map.set(key, { name: ing.name, qty, unit: ing.unit });
        });
      }
    });
    return [...map.values()];
  };

  useEffect(() => {
    db.fetchMaterialRequests().then(setMaterialReqs).catch(() => {});
  }, []);

  useEffect(() => {
    if (step === 0 && dosForDeco.length > 0 && newDOSIds && newDOSIds.size > 0) {
      onMarkDOSSeen?.([...newDOSIds]);
    }
  }, [step]);

  const recipesData = [
    { name: "Choco Moist Cake", ingredients: "Flour 2kg, Sugar 1kg, Cocoa 500g, Butter 500g, Eggs 12", batches: 10, time: "45 min" },
    { name: "Sponge Fudge", ingredients: "Flour 1.5kg, Sugar 800g, Butter 400g, Vanilla 100ml", batches: 8, time: "35 min" },
    { name: "Free Mix Base", ingredients: "Flour 3kg, Sugar 1.5kg, Baking Powder 200g, Salt 50g", batches: 15, time: "30 min" },
    { name: "Blue Theme Kit", ingredients: "Blue food color 50ml, White icing 2kg, Sprinkles 200g", batches: 5, time: "20 min" },
  ];

  const allIngredients = inventory.filter(i => i.group === "ingredients" || i.group === "decoration-supplies" || i.group === "packaging-materials");

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
            </button>
          ))}
        </div>

            {dosForDeco.length > 0 && (() => {
              const bomProducts = dosForDeco.map(d => {
                const recipe = recipes.find(r => r.productName === d.product);
                return { dos: d, recipe };
              }).filter(p => p.recipe);
              if (bomProducts.length === 0) return null;

              const totalIng = bomProducts.reduce((s, p) => s + (p.recipe!.ingredients.length || 0), 0);
              const totalPkg = bomProducts.reduce((s, p) => s + ((p.recipe!.packagingMaterials ?? []).length || 0), 0);
              const totalDeco = bomProducts.reduce((s, p) => s + ((p.recipe!.decorationSupplies ?? []).length || 0), 0);

              return (
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-white overflow-hidden">
                  <button onClick={() => setBomOpen(prev => !prev)} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-[15px] font-semibold text-zinc-900">Full BOM Overview</span>
                      <div className="flex items-center gap-1.5">
                        {totalIng > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-600">{totalIng} ingredients</span>}
                        {totalPkg > 0 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-600">{totalPkg} packaging</span>}
                        {totalDeco > 0 && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-600">{totalDeco} deco</span>}
                      </div>
                    </div>
                    <span className="text-zinc-400 text-[14px]">{bomOpen ? "▾" : "▸"}</span>
                  </button>
                  {bomOpen && (
                    <div className="border-t border-zinc-100 divide-y divide-zinc-100">
                      {bomProducts.map(({ dos, recipe }) => (
                        <div key={dos.id} className="px-5 py-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-[14px] font-semibold text-zinc-900">{dos.product}</span>
                            <span className="text-[12px] text-zinc-400 font-mono">×{dos.qty}</span>
                            <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${dos.priority === "HIGH" ? "bg-red-100 text-red-700" : dos.priority === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>{dos.priority}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {(recipe!.ingredients ?? []).length > 0 && (
                              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                                <div className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider mb-2">Ingredients</div>
                                <div className="space-y-1">
                                  {recipe!.ingredients.map((ing, i) => {
                                    const neededQty = Math.ceil(ing.qtyPerBatch * (dos.qty / 100));
                                    return (
                                      <div key={i} className="flex items-center justify-between text-[11px]">
                                        <span className="text-zinc-700">{ing.name}</span>
                                        <span className="font-mono text-rose-600 font-medium">{neededQty}{ing.unit}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {(recipe!.packagingMaterials ?? []).length > 0 && (
                              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                                <div className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-2">Packaging</div>
                                <div className="space-y-1">
                                  {recipe!.packagingMaterials.map((mat, i) => (
                                    <div key={i} className="flex items-center justify-between text-[11px]">
                                      <span className="text-zinc-700">{mat.name}</span>
                                      <span className="font-mono text-blue-600 font-medium">{mat.qtyPerBatch}{mat.unit}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(recipe!.decorationSupplies ?? []).length > 0 && (
                              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3">
                                <div className="text-[10px] font-semibold text-purple-500 uppercase tracking-wider mb-2">Deco Supplies</div>
                                <div className="space-y-1">
                                  {recipe!.decorationSupplies.map((sup, i) => (
                                    <div key={i} className="flex items-center justify-between text-[11px]">
                                      <span className="text-zinc-700">{sup.name}</span>
                                      <span className="font-mono text-purple-600 font-medium">{sup.qtyPerBatch}{sup.unit}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

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
                              const invItem = inventory.find(ii => ii.id === mat.inventoryId || ii.name.toLowerCase() === mat.name.toLowerCase());
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
                              const invItem = inventory.find(ii => ii.id === sup.inventoryId || ii.name.toLowerCase() === sup.name.toLowerCase());
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
      </div>
    );
  }

  /* ── Free Mix Tab ── */
  if (activeTab === "free-mix") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Free Mix</h1>
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
                              const invItem = inventory.find(ii => ii.id === mat.inventoryId || ii.name.toLowerCase() === mat.name.toLowerCase());
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
                              const invItem = inventory.find(ii => ii.id === sup.inventoryId || ii.name.toLowerCase() === sup.name.toLowerCase());
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
      </div>
    );
  }

  /* ── Ingredients Tab ── */
  if (activeTab === "ingredients") {
    const items = inventory.filter(i => i.group === "ingredients");
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Ingredients</h1>
          <p className="mt-1 text-[13px] text-zinc-500">View ingredient stock from the Warehouse.</p>
        </div>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center"><p className="text-[14px] text-zinc-400">No ingredients in inventory.</p></div>
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm">
            <table className="w-full">
              <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3 text-right">On Hand</th><th className="px-4 py-3 text-right">Threshold</th><th className="px-4 py-3">Unit</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-[13px]">
                {items.map(item => (
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

  /* ── Decoration Supplies Tab ── */
  if (activeTab === "decoration-supplies") {
    const items = inventory.filter(i => i.group === "decoration-supplies");
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Decoration Supplies</h1>
          <p className="mt-1 text-[13px] text-zinc-500">View decoration supply stock from the Warehouse.</p>
        </div>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center"><p className="text-[14px] text-zinc-400">No decoration supplies in inventory.</p></div>
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm">
            <table className="w-full">
              <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3 text-right">On Hand</th><th className="px-4 py-3 text-right">Threshold</th><th className="px-4 py-3">Unit</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-[13px]">
                {items.map(item => (
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

  /* ── Materials Tab ── */
  if (activeTab === "materials") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Materials Request</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Request materials from the Warehouse for production.</p>
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
                <input value={item.name} onChange={e => updMatDraftItem(i, "name", e.target.value)} placeholder="Material name" className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] outline-none focus:border-zinc-400" />
                <input type="number" min="1" value={item.qty} onChange={e => updMatDraftItem(i, "qty", Number(e.target.value))} className="w-20 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] text-center outline-none focus:border-zinc-400 font-mono" />
                <input value={item.unit} onChange={e => updMatDraftItem(i, "unit", e.target.value)} placeholder="Unit" className="w-20 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] outline-none focus:border-zinc-400" />
                <button onClick={() => delMatDraftItem(i)} className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50">✕</button>
              </div>
            ))}
            <div className="flex gap-2">
              <button onClick={addMatDraftItem} className="rounded-xl border border-zinc-200 px-3 py-2 text-[12px] font-medium text-zinc-600 hover:bg-zinc-50">+ Add Item</button>
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

  if (activeTab !== "dashboard") return null;

  const needed: { product: string; name: string; qty: number; unit: string; id: string }[] = [];
  dosForDeco.forEach(d => {
    const recipe = recipes.find(r => r.productName === d.product);
    if (recipe) {
      recipe.ingredients.forEach(ing => {
        const neededQty = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
        const existing = needed.find(n => n.name === ing.name && n.unit === ing.unit);
        if (existing) existing.qty += neededQty;
        else needed.push({ product: d.product, name: ing.name, qty: neededQty, unit: ing.unit, id: `${d.id}-${ing.name}` });
      });
    }
  });

  const togglePrepared = (id: string) => {
    setFreeMixPrepared(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleEditRecipe = (product: string) => {
    const existing = recipes.find(r => r.productName === product);
    setRecipeDraft(existing ? existing.ingredients.map(i => ({ ...i })) : []);
    setEditingRecipe(product);
  };

  const handleSaveRecipe = () => {
    if (!editingRecipe) return;
    if (!onUpdateRecipes) return;
const existingRecipe = recipes.find(r => r.productName === editingRecipe);
    const newRecipe: ProductRecipe = {
        productId: editingRecipe,
        productName: editingRecipe,
        ingredients: recipeDraft.filter(i => i.name.trim()),
        packagingMaterials: existingRecipe?.packagingMaterials ?? [],
        decorationSupplies: existingRecipe?.decorationSupplies ?? [],
      };
      onUpdateRecipes(prev => {
        const idx = prev.findIndex(r => r.productName === editingRecipe);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = newRecipe;
        return next;
      }
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
    if (freeMixDone.has(product)) return;
    const recipe = recipes.find(r => r.productName === product);
    if (!recipe) return;
    const dos = dosForDeco.find(d => d.product === product);
    if (!dos) return;

    const newInv = [...inventory];
    const deductions: string[] = [];
    recipe.ingredients.forEach(ing => {
      const neededQty = Math.ceil(ing.qtyPerBatch * (dos.qty / 100));
      const idx = newInv.findIndex(i => i.id === ing.inventoryId || i.name.toLowerCase() === ing.name.toLowerCase());
      if (idx >= 0) {
        newInv[idx] = { ...newInv[idx], onHand: Math.max(0, newInv[idx].onHand - neededQty) };
        deductions.push(`${ing.name} x${neededQty}${ing.unit}`);
      }
    });

    onUpdateInventory(newInv);
    await db.upsertInventory(newInv).catch(console.error);

    const tx: StockTransaction = {
      id: `TX-${Date.now()}`, type: "out", itemName: deductions.join(", "), itemId: `MIX-${product}`,
      qty: deductions.length, unit: "", reference: `Free Mix — ${product}`, timestamp: new Date().toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), target: "baker",
    };
    await db.insertStockTransaction(tx).catch(console.error);
    onAddAuditLog?.("FREE_MIX_COMPLETED", `${product}: ${deductions.join(", ")}`);

    setFreeMixDone(prev => new Set(prev).add(product));
    recipe.ingredients.forEach(ing => togglePrepared(`${dos.id}-${ing.name}`));
  };

  const totalNeeded = needed.length;
  const totalPrepared = freeMixPrepared.size;
  const allMixesDone = dosForDeco.every(d => freeMixDone.has(d.product));
  const allIngPrepared = dosForDeco.every(d => {
    const recipe = recipes.find(r => r.productName === d.product);
    if (!recipe) return false;
    return recipe.ingredients.every(ing => freeMixPrepared.has(`${d.id}-${ing.name}`));
  });

  const handleSendToBaker = async () => {
    for (const d of dosForDeco) {
      if (!freeMixDone.has(d.product)) {
        await handleCompleteMix(d.product);
      }
    }
    myTasks.forEach(t => onCompleteTask(t.id));
    onAddAuditLog?.("DECO_SENT_TO_BAKER", `All free mixes for ${dosForDeco.map(d => d.product).join(", ")} sent to Baker`);
    setSentToBaker(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Deco Workstation</h1>
        <p className="mt-1 text-[13px] text-zinc-500">Prepare Free Mix ingredients per DOS and send to Baker. Inventory is deducted automatically.</p>
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
        {/* Step 1: DOS */}
        {step === 0 && (
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[21px] font-semibold">DOS Received</h2>
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

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Products to Mix</div>
                <div className="text-[22px] font-semibold mt-0.5">{dosForDeco.length}</div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Ingredients Needed</div>
                <div className="text-[22px] font-semibold mt-0.5">{totalNeeded}</div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Destination</div>
                <div className="text-[14px] font-semibold mt-0.5 text-stone-600">Baker → Production</div>
              </div>
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
                      const pColor = d.priority === "HIGH" ? "bg-red-100 text-red-700" : d.priority === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600";
                      const sDot = d.status === "completed" ? "bg-emerald-500" : d.status === "in-progress" ? "bg-amber-500" : "bg-zinc-300";
                      return (
                        <Fragment key={d.id}>
                          <tr className="border-b border-zinc-50 text-[13px]">
                            <td className="px-3 py-2.5 text-zinc-400 text-[10px] text-center">◈</td>
                            <td className="px-2 py-2.5 font-medium text-zinc-900">{d.product} {newDOSIds?.has(d.id) && <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 uppercase tracking-wider">New</span>}</td>
                            <td className="px-2 py-2.5"><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${pColor}`}>{d.priority}</span></td>
                            <td className="px-2 py-2.5 text-right font-mono text-zinc-800">{d.qty}</td>
                            <td className="px-2 py-2.5 text-right font-mono text-zinc-600">{d.branch1}</td>
                            <td className="px-2 py-2.5 text-right font-mono text-zinc-600">{d.branch2}</td>
                            <td className="px-3 py-2.5 text-right"><span className={`inline-block h-2 w-2 rounded-full ${sDot}`} /></td>
                          </tr>
                          {(hasIngredients || (recipe?.packagingMaterials ?? []).length > 0 || (recipe?.decorationSupplies ?? []).length > 0) && (
                            <tr key={`${d.id}-details`}>
                              <td colSpan={7} className="px-3 pb-3 pt-1">
                                <div className="ml-7 space-y-2">
                                  {hasIngredients && (
                                    <button onClick={() => {
                                      const items = recipe!.ingredients.map(ing => {
                                        const neededQty = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
                                        const invItem = inventory.find(ii => ii.id === ing.inventoryId);
                                        return { name: ing.name, qty: neededQty, unit: ing.unit, stock: invItem?.onHand };
                                      });
                                      setBomModal({ product: d.product, category: "ingredients", items });
                                    }} className="w-full text-left rounded-lg border border-rose-200 bg-rose-50/50 overflow-hidden hover:border-rose-300 hover:bg-rose-50 transition-all cursor-pointer group">
                                      <div className="flex items-center gap-1.5 bg-rose-100/60 px-2.5 py-1 border-b border-rose-100">
                                        <span className="text-[9px] font-semibold text-rose-500 uppercase tracking-wider">Ingredients</span>
                                        <span className="ml-auto text-[9px] text-rose-400 group-hover:text-rose-600 transition-colors">Click to view →</span>
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
                                    </button>
                                  )}
                                  {(recipe?.packagingMaterials ?? []).length > 0 && (
                                    <button onClick={() => {
                                      const items = recipe!.packagingMaterials.map(mat => {
                                        const invItem = inventory.find(ii => ii.id === mat.inventoryId);
                                        return { name: mat.name, qty: mat.qtyPerBatch, unit: mat.unit, stock: invItem?.onHand };
                                      });
                                      setBomModal({ product: d.product, category: "packaging", items });
                                    }} className="w-full text-left rounded-lg border border-blue-200 bg-blue-50/50 overflow-hidden hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer group">
                                      <div className="flex items-center gap-1.5 bg-blue-100/60 px-2.5 py-1 border-b border-blue-100">
                                        <span className="text-[9px] font-semibold text-blue-500 uppercase tracking-wider">Packaging</span>
                                        <span className="ml-auto text-[9px] text-blue-400 group-hover:text-blue-600 transition-colors">Click to view →</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 px-2.5 py-1.5">
                                        {recipe!.packagingMaterials.map((mat, i) => (
                                          <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-blue-200 px-1.5 py-0.5 text-[10px]">
                                            <span className="text-zinc-700 font-medium">{mat.name}</span>
                                            <span className="text-blue-600 font-mono">×{mat.qtyPerBatch}{mat.unit}</span>
                                          </span>
                                        ))}
                                      </div>
                                    </button>
                                  )}
                                  {(recipe?.decorationSupplies ?? []).length > 0 && (
                                    <button onClick={() => {
                                      const items = recipe!.decorationSupplies.map(sup => {
                                        const invItem = inventory.find(ii => ii.id === sup.inventoryId);
                                        return { name: sup.name, qty: sup.qtyPerBatch, unit: sup.unit, stock: invItem?.onHand };
                                      });
                                      setBomModal({ product: d.product, category: "deco", items });
                                    }} className="w-full text-left rounded-lg border border-purple-200 bg-purple-50/50 overflow-hidden hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer group">
                                      <div className="flex items-center gap-1.5 bg-purple-100/60 px-2.5 py-1 border-b border-purple-100">
                                        <span className="text-[9px] font-semibold text-purple-500 uppercase tracking-wider">Deco Supplies</span>
                                        <span className="ml-auto text-[9px] text-purple-400 group-hover:text-purple-600 transition-colors">Click to view →</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 px-2.5 py-1.5">
                                        {recipe!.decorationSupplies.map((sup, i) => (
                                          <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-purple-200 px-1.5 py-0.5 text-[10px]">
                                            <span className="text-zinc-700 font-medium">{sup.name}</span>
                                            <span className="text-purple-600 font-mono">×{sup.qtyPerBatch}{sup.unit}</span>
                                          </span>
                                        ))}
                                      </div>
                                    </button>
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

        {/* Step 2: Prepare Free Mix */}
        {step === 1 && (
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[21px] font-semibold">Prepare Free Mix</h2>
                <p className="mt-1 text-[13px] text-zinc-500">Weigh and prepare the ingredient pre-mixes per DOS product. Check off each ingredient as you prepare it.</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Progress</div>
                <div className={`text-[22px] font-bold mt-0.5 ${totalPrepared === totalNeeded && totalNeeded > 0 ? "text-emerald-600" : "text-amber-600"}`} style={{ fontFamily: "Fragment Mono, monospace" }}>{totalPrepared}/{totalNeeded}</div>
                {totalNeeded > 0 && (
                  <div className="mt-1 h-1.5 w-24 rounded-full bg-zinc-100 ml-auto">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(totalPrepared / totalNeeded) * 100}%` }} />
                  </div>
                )}
              </div>
            </div>

            {/* Recipe Editor Modal */}
            {editingRecipe && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={() => setEditingRecipe(null)}>
                <div className="w-full max-w-[520px] rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-[17px] font-semibold text-zinc-900">Recipe: {editingRecipe}</h3>
                      <p className="mt-0.5 text-[12px] text-zinc-500">Define the ingredients and quantities per batch.</p>
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
                    <button type="button" onClick={() => setEditingRecipe(null)} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                    <button type="button" onClick={handleSaveRecipe} className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800">Save Recipe</button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-[12px] text-amber-800">
                <span>✦</span>
                <span>Check off each ingredient as you prepare it. Once all ingredients for a product are checked, click "Complete Mix" to deduct from Warehouse inventory.</span>
              </div>
            </div>

            {dosForDeco.length === 0 ? (
              <div className="mt-6 text-center py-8"><p className="text-[14px] text-zinc-400">No DOS items assigned for today.</p></div>
            ) : (
              <div className="mt-4 space-y-4">
                {dosForDeco.map(d => {
                  const recipe = recipes.find(r => r.productName === d.product);
                  const isDone = freeMixDone.has(d.product);
                  const allPrepared = recipe ? recipe.ingredients.every(ing => freeMixPrepared.has(`${d.id}-${ing.name}`)) : false;
                  return (
                    <div key={d.id} className={`rounded-2xl border p-5 ${isDone ? "border-emerald-200 bg-emerald-50/30" : "border-zinc-200 bg-white"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="text-[15px] font-semibold text-zinc-900">{d.product}</span>
                          <span className="ml-2 text-[12px] text-zinc-500">×{d.qty} pcs</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isDone ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700">✓ Mixed & Deducted</span>
                          ) : allPrepared ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700">✓ All Prepared</span>
                          ) : recipe ? (
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-medium text-amber-700">{recipe.ingredients.filter(ing => freeMixPrepared.has(`${d.id}-${ing.name}`)).length}/{recipe.ingredients.length} Prepared</span>
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
                                  const invItem = inventory.find(ii => ii.id === mat.inventoryId || ii.name.toLowerCase() === mat.name.toLowerCase());
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
                                  const invItem = inventory.find(ii => ii.id === sup.inventoryId || ii.name.toLowerCase() === sup.name.toLowerCase());
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
                          Complete Mix & Deduct from Warehouse
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Send to Baker */}
        {step === 2 && (
          <div>
            <h2 className="text-[21px] font-semibold">Send Free Mix to Baker</h2>
            <p className="mt-1 text-[13px] text-zinc-500">Once all mixes are complete, send the prepared Free Mix to Baker. This will deduct all ingredients from Warehouse inventory and record the transaction.</p>

            {dosForDeco.length === 0 ? (
              <div className="mt-6 text-center py-8"><p className="text-[14px] text-zinc-400">No items to send.</p></div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-zinc-200 bg-white p-3">
                    <div className="text-[11px] text-zinc-500 uppercase tracking-wider">DOS Items</div>
                    <div className="text-[20px] font-semibold mt-0.5">{dosForDeco.length}</div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-white p-3">
                    <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Mixes Done</div>
                    <div className={`text-[20px] font-semibold mt-0.5 ${freeMixDone.size === dosForDeco.length && dosForDeco.length > 0 ? "text-emerald-600" : "text-zinc-800"}`}>{freeMixDone.size}/{dosForDeco.length}</div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-white p-3">
                    <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Ingredients</div>
                    <div className="text-[20px] font-semibold mt-0.5">{totalNeeded}</div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-white p-3">
                    <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Status</div>
                    <div className={`text-[12px] font-semibold mt-0.5 ${sentToBaker ? "text-emerald-600" : allMixesDone ? "text-amber-600" : "text-zinc-500"}`}>{sentToBaker ? "✓ Sent" : allMixesDone ? "Ready" : "Mixing..."}</div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {dosForDeco.map(d => {
                    const isDone = freeMixDone.has(d.product);
                    const recipe = recipes.find(r => r.productName === d.product);
                    const deductions = recipe ? recipe.ingredients.map(ing => {
                      const neededQty = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
                      return `${ing.name} x${neededQty}${ing.unit}`;
                    }) : [];
                    return (
                      <div key={d.id} className={`rounded-2xl border p-4 ${isDone ? "border-emerald-200 bg-emerald-50/40" : "border-zinc-200 bg-white"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[15px] font-medium text-zinc-900">{d.product}</span>
                            <span className="text-[12px] text-zinc-400">×{d.qty}</span>
                          </div>
                          {isDone ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700">✓ Mixed</span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-medium text-amber-700">Pending</span>
                          )}
                        </div>
                        {deductions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {deductions.map((d, i) => (
                              <span key={i} className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700">{d}</span>
                            ))}
                          </div>
                        )}
                        <div className="mt-1.5 text-[11px] text-zinc-400">
                          {isDone ? "Ingredients deducted from Warehouse ✓" : "Complete mixing in Step 2 first"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {sentToBaker ? (
                  <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                    <div className="text-[16px] font-bold text-emerald-700">✓ Free Mix Sent to Baker</div>
                    <div className="text-[12px] text-emerald-600 mt-0.5">All ingredients deducted from Warehouse. Baker can now use the pre-mixes for production.</div>
                  </div>
                ) : (
                  <button
                    onClick={handleSendToBaker}
                    disabled={!allIngPrepared && dosForDeco.some(d => !freeMixDone.has(d.product))}
                    className="mt-6 w-full rounded-xl bg-stone-700 py-3 text-[14px] font-medium text-white hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.99]"
                  >
                    {allMixesDone ? "Send All Free Mix to Baker & Deduct from Warehouse" : "Complete all mixes in Step 2 first"}
                  </button>
                )}
              </>
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

      {/* BOM Detail Modal */}
      {bomModal && (() => {
        const colorMap = {
          ingredients: { border: "border-rose-200", header: "bg-rose-50", headerText: "text-rose-600", headerBg: "bg-rose-100/60", borderLight: "border-rose-100", dot: "bg-rose-400", text: "text-rose-600" },
          packaging: { border: "border-blue-200", header: "bg-blue-50", headerText: "text-blue-600", headerBg: "bg-blue-100/60", borderLight: "border-blue-100", dot: "bg-blue-400", text: "text-blue-600" },
          deco: { border: "border-purple-200", header: "bg-purple-50", headerText: "text-purple-600", headerBg: "bg-purple-100/60", borderLight: "border-purple-100", dot: "bg-purple-400", text: "text-purple-600" },
        };
        const c = colorMap[bomModal.category];
        const title = bomModal.category === "ingredients" ? "Ingredients" : bomModal.category === "packaging" ? "Packaging Materials" : "Decoration Supplies";
        return (
          <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={() => setBomModal(null)}>
            <div className={`w-full max-w-[480px] rounded-[28px] border ${c.border} bg-white shadow-2xl`} onClick={e => e.stopPropagation()}>
              <div className={`flex items-center justify-between ${c.header} ${c.headerBg} px-6 py-4 rounded-t-[28px]`}>
                <div>
                  <h3 className={`text-[16px] font-semibold ${c.headerText}`}>{title}</h3>
                  <p className="mt-0.5 text-[12px] text-zinc-500">{bomModal.product}</p>
                </div>
                <button onClick={() => setBomModal(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/60 text-zinc-400 hover:text-zinc-600 transition-all">✕</button>
              </div>
              <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                {bomModal.items.length === 0 ? (
                  <div className="text-center py-8 text-[13px] text-zinc-400">No items in this category.</div>
                ) : (
                  <div className="space-y-2">
                    {bomModal.items.map((item, i) => (
                      <div key={i} className={`flex items-center gap-3 rounded-xl border ${c.borderLight} px-4 py-3`}>
                        <span className={`shrink-0 h-2 w-2 rounded-full ${c.dot}`} />
                        <span className="flex-1 text-[13px] font-medium text-zinc-900">{item.name}</span>
                        <span className="text-[13px] font-mono font-medium text-zinc-700">{item.qty} {item.unit}</span>
                        {item.stock !== undefined && (
                          <span className={`text-[11px] ${item.stock >= item.qty ? "text-emerald-600" : "text-red-500"}`}>
                            {item.stock >= item.qty ? `${item.stock} in stock` : `Low (${item.stock})`}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-6 pb-5 pt-2">
                <button onClick={() => setBomModal(null)} className="w-full rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all">Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}


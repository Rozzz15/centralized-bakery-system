import { useState } from "react";
import type { InventoryItem, ProductRecipe, RecipeIngredient, ProductPricing, ProductPricingVariant } from "../types";

type Props = {
  productName: string;
  recipes: ProductRecipe[];
  inventory: InventoryItem[];
  categories: string[];
  initialCategory: string;
  productPricing?: ProductPricing;
  onSave: (originalName: string, newName: string, ingredients: RecipeIngredient[], packaging: RecipeIngredient[], decoration: RecipeIngredient[], linkedIngredients: string[], category: string, pricing?: { sellingPrice: number; wholesalePrice: number; costPrice: number; status: "active" | "draft" | "archived"; variants: ProductPricingVariant[] }) => void;
  onClose: () => void;
};

export default function EditProductModal({ productName, recipes, inventory, categories, initialCategory, productPricing, onSave, onClose }: Props) {
  const existing = recipes.find(r => r.productName === productName);

  const [name, setName] = useState(productName);
  const [category, setCategory] = useState(initialCategory);
  const [linkedIngredients, setLinkedIngredients] = useState<string[]>(existing?.linkedIngredients || []);
  const [ingredientItems, setIngredientItems] = useState<RecipeIngredient[]>(existing?.ingredients || []);
  const [packagingItems, setPackagingItems] = useState<RecipeIngredient[]>(existing?.packagingMaterials || []);
  const [decorationItems, setDecorationItems] = useState<RecipeIngredient[]>(existing?.decorationSupplies || []);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [showPackagingPicker, setShowPackagingPicker] = useState(false);
  const [showDecorationPicker, setShowDecorationPicker] = useState(false);
  const [packagingSearch, setPackagingSearch] = useState("");
  const [decorationSearch, setDecorationSearch] = useState("");
  const [showIngredientPicker, setShowIngredientPicker] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");

  // Pricing state
  const [sellingPrice, setSellingPrice] = useState(productPricing?.sellingPrice?.toString() || "");
  const [wholesalePrice, setWholesalePrice] = useState(productPricing?.wholesalePrice?.toString() || "");
  const [costPrice, setCostPrice] = useState(productPricing?.estimatedCost > 0 ? productPricing.estimatedCost.toString() : "");
  const [status, setStatus] = useState<"active" | "draft" | "archived">(productPricing?.status || "active");
  const [variants, setVariants] = useState<ProductPricingVariant[]>(productPricing?.variants || []);

  function addIngredient(inv: InventoryItem) {
    if (ingredientItems.some(i => i.inventoryId === inv.id)) return;
    setIngredientItems(prev => [...prev, { inventoryId: inv.id, name: inv.name, qtyPerBatch: 1, unit: inv.unit }]);
    setShowIngredientPicker(false);
  }
  function addPackaging(inv: InventoryItem) {
    if (packagingItems.some(i => i.inventoryId === inv.id)) return;
    setPackagingItems(prev => [...prev, { inventoryId: inv.id, name: inv.name, qtyPerBatch: 1, unit: inv.unit }]);
    setShowPackagingPicker(false);
  }
  function addDecoration(inv: InventoryItem) {
    if (decorationItems.some(i => i.inventoryId === inv.id)) return;
    setDecorationItems(prev => [...prev, { inventoryId: inv.id, name: inv.name, qtyPerBatch: 1, unit: inv.unit }]);
    setShowDecorationPicker(false);
  }

  const availableIngredients = inventory.filter(i => i.group === "ingredients" && !ingredientItems.some(ing => ing.inventoryId === i.id) && (i.name.toLowerCase().includes(ingredientSearch.toLowerCase()) || ingredientSearch === ""));
  const availablePackaging = inventory.filter(i => i.group === "packaging-materials" && !packagingItems.some(ing => ing.inventoryId === i.id) && (i.name.toLowerCase().includes(packagingSearch.toLowerCase()) || packagingSearch === ""));
  const availableDecoration = inventory.filter(i => i.group === "decoration-supplies" && !decorationItems.some(ing => ing.inventoryId === i.id) && (i.name.toLowerCase().includes(decorationSearch.toLowerCase()) || decorationSearch === ""));

  function toggleRecipe(r: string) {
    setLinkedIngredients(prev => prev.includes(r) ? prev.filter(p => p !== r) : [...prev, r]);
  }

  const filteredRecipes = recipes.filter(r => (r.ingredients.length > 0 || r.packagingMaterials.length > 0 || r.decorationSupplies.length > 0) && (r.productName.toLowerCase().includes(recipeSearch.toLowerCase()) || recipeSearch === ""));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(productName, name.trim(), ingredientItems, packagingItems, decorationItems, linkedIngredients, category, {
      sellingPrice: Number(sellingPrice) || 0,
      wholesalePrice: Number(wholesalePrice) || 0,
      costPrice: Number(costPrice) || 0,
      status,
      variants,
    });
  }

  // Calculate estimated cost from current recipe items
  const allRecipeItems = [...ingredientItems, ...packagingItems, ...decorationItems];
  const estCost = allRecipeItems.reduce((sum, ing) => {
    const inv = inventory.find(i => i.id === ing.inventoryId);
    return sum + (inv ? inv.cost * ing.qtyPerBatch : 0);
  }, 0);
  const sp = Number(sellingPrice) || 0;
  const cp = Number(costPrice) || 0;
  const effectiveCost = cp > 0 ? cp : estCost;
  const profit = sp > 0 ? sp - effectiveCost : 0;
  const margin = sp > 0 ? ((profit / sp) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto rounded-[28px] border border-[#E8E0D5] bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-semibold">Edit Product</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Product Name</label>
            <input required value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" placeholder="e.g. Pandesal" autoFocus />
          </div>

          <div className="mb-4">
            <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Category</label>
            <select value={String(category || "")} onChange={e => setCategory(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400">
              <option value="">No category</option>
              {(categories || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="mb-4">
            <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Link Recipe</label>
            {linkedIngredients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {linkedIngredients.map(r => (
                  <span key={r} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                    {r}
                    <button type="button" onClick={() => toggleRecipe(r)} className="text-zinc-400 hover:text-red-500 ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input value={recipeSearch} onChange={e => setRecipeSearch(e.target.value)} onFocus={() => setShowRecipePicker(true)} placeholder="Search recipes..." className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-zinc-900 transition-colors" />
              {showRecipePicker && recipeSearch && (
                <>
                  <div className="fixed inset-0 z-0" onClick={() => { setShowRecipePicker(false); setRecipeSearch(""); }} />
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-40 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
                    {filteredRecipes.length === 0 ? (
                      <p className="px-3 py-2 text-[12px] text-zinc-400">No recipes found.</p>
                    ) : filteredRecipes.map(r => (
                      <label key={r.productName} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 cursor-pointer text-[12px]">
                        <input type="checkbox" checked={linkedIngredients.includes(r.productName)} onChange={() => { toggleRecipe(r.productName); setRecipeSearch(""); }} className="rounded border-zinc-300" />
                        <span className="text-zinc-900">{r.productName}</span>
                        <span className="text-zinc-400 ml-auto">{r.ingredients.length} ingredients</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Packaging Tracker</span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-700">{packagingItems.length}</span>
              </div>
              <div className="relative">
                <button type="button" onClick={() => setShowPackagingPicker(!showPackagingPicker)} className="text-[12px] font-medium text-blue-600 hover:text-blue-800">+ Track</button>
                {showPackagingPicker && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowPackagingPicker(false)} />
                    <div className="absolute top-5 right-0 z-20 w-64 rounded-xl border border-zinc-200 bg-white shadow-lg">
                      <div className="p-2 border-b border-zinc-100">
                        <input value={packagingSearch} onChange={e => setPackagingSearch(e.target.value)} placeholder="Search packaging..." className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-400" />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {availablePackaging.length === 0 ? (
                          <p className="px-3 py-3 text-[12px] text-zinc-400 text-center">No packaging items found.</p>
                        ) : availablePackaging.map(i => (
                          <button key={i.id} type="button" onClick={() => { addPackaging(i); setPackagingSearch(""); }} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-50 text-[12px]">
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-zinc-900 block truncate">{i.name}</span>
                              <span className="text-[10px] text-zinc-400">{i.sku || "No SKU"}</span>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <span className={`text-[11px] font-semibold ${i.onHand > i.threshold ? "text-emerald-600" : i.onHand > 0 ? "text-amber-600" : "text-red-500"}`}>{i.onHand}</span>
                              <span className="text-[10px] text-zinc-400 ml-0.5">{i.unit}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            {packagingItems.length === 0 ? (
              <p className="text-[12px] text-zinc-400 py-3 text-center border border-dashed border-zinc-200 rounded-xl">No packaging tracked. Click "+ Track" to add packaging items.</p>
            ) : (
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                {packagingItems.map(item => {
                  const invItem = inventory.find(i => i.id === item.inventoryId);
                  const onHand = invItem?.onHand || 0;
                  const threshold = invItem?.threshold || 0;
                  const isLow = onHand > 0 && onHand < threshold;
                  const isOut = onHand === 0;
                  return (
                    <div key={item.inventoryId} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white px-3 py-2.5">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isOut ? "bg-red-400" : isLow ? "bg-amber-400" : "bg-emerald-400"}`}></div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[12px] font-semibold text-zinc-900 block truncate">{item.name}</span>
                          {invItem?.sku && <span className="text-[10px] text-zinc-400">{invItem.sku}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right">
                          <span className={`text-[13px] font-bold ${isOut ? "text-red-500" : isLow ? "text-amber-600" : "text-emerald-600"}`} style={{ fontFamily: "Fragment Mono, monospace" }}>{onHand}</span>
                          <span className="text-[10px] text-zinc-400 ml-0.5">{item.unit}</span>
                        </div>
                        <button type="button" onClick={() => setPackagingItems(prev => prev.filter(i => i.inventoryId !== item.inventoryId))} className="w-6 h-6 grid place-items-center rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all text-[12px]">×</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Decoration</span>
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">{decorationItems.length}</span>
              </div>
              <div className="relative">
                <button type="button" onClick={() => setShowDecorationPicker(!showDecorationPicker)} className="text-[12px] font-medium text-blue-600 hover:text-blue-800">+ Add</button>
                {showDecorationPicker && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowDecorationPicker(false)} />
                    <div className="absolute top-5 right-0 z-20 w-60 rounded-xl border border-zinc-200 bg-white shadow-lg">
                      <div className="p-2 border-b border-zinc-100">
                        <input value={decorationSearch} onChange={e => setDecorationSearch(e.target.value)} placeholder="Search decoration..." className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-400" />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {availableDecoration.length === 0 ? (
                          <p className="px-3 py-3 text-[12px] text-zinc-400 text-center">No decoration items found.</p>
                        ) : availableDecoration.map(i => (
                          <button key={i.id} type="button" onClick={() => { addDecoration(i); setDecorationSearch(""); }} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-50 text-[12px]">
                            <span className="font-medium text-zinc-900">{i.name}</span>
                            <span className="text-zinc-400 font-mono">{i.unit}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            {decorationItems.length === 0 ? (
              <p className="text-[12px] text-zinc-400 py-3 text-center border border-dashed border-zinc-200 rounded-xl">No decoration added.</p>
            ) : (
              <div className="space-y-1 max-h-[140px] overflow-y-auto">
                {decorationItems.map(item => (
                  <div key={item.inventoryId} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-3 py-2">
                    <span className="text-[12px] font-medium text-zinc-900 truncate flex-1">{item.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input value={item.unit} onChange={e => setDecorationItems(prev => prev.map(i => i.inventoryId === item.inventoryId ? { ...i, unit: e.target.value } : i))} className="w-12 rounded-lg border border-zinc-200 px-1.5 py-1 text-[10px] text-center outline-none focus:border-zinc-900" />
                      <input type="number" min="0" step="any" value={item.qtyPerBatch} onChange={e => setDecorationItems(prev => prev.map(i => i.inventoryId === item.inventoryId ? { ...i, qtyPerBatch: Number(e.target.value) } : i))} className="w-16 rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-center outline-none focus:border-zinc-400" />
                      <button type="button" onClick={() => setDecorationItems(prev => prev.filter(i => i.inventoryId !== item.inventoryId))} className="text-zinc-400 hover:text-red-500 text-[13px]">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing Section */}
          <div className="mb-4 pt-4 border-t border-[#E8E0D5]">
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-3">Pricing & Margins</div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Cost Price (₱)</label>
                <input type="number" min="0" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }} />
                <div className="text-[10px] text-zinc-400 mt-1">{allRecipeItems.length > 0 ? "Override est. cost from recipe" : "Enter cost price"}</div>
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Selling Price (₱)</label>
                <input type="number" min="0" step="0.01" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }} />
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Wholesale Price (₱)</label>
                <input type="number" min="0" step="0.01" value={wholesalePrice} onChange={e => setWholesalePrice(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }} />
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400">
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            {/* Margin Calculation - Always visible */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 mb-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-3">Margin Calculation</div>

              {allRecipeItems.length > 0 && (
                <div className="mb-3 pb-3 border-b border-zinc-200">
                  <div className="text-[11px] font-medium text-zinc-500 mb-2">Estimated Production Cost Breakdown</div>
                  <div className="space-y-1">
                    {allRecipeItems.map((ing, i) => {
                      const inv = inventory.find(iv => iv.id === ing.inventoryId);
                      const lineCost = inv ? inv.cost * ing.qtyPerBatch : 0;
                      return (
                        <div key={i} className="flex items-center justify-between text-[12px]">
                          <span className="text-zinc-600">{ing.name} <span className="text-zinc-400">({ing.qtyPerBatch} {ing.unit})</span></span>
                          <span className="text-zinc-700" style={{ fontFamily: "Fragment Mono, monospace" }}>₱{lineCost.toFixed(2)}</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between text-[12px] font-semibold border-t border-zinc-200 pt-1.5 mt-1.5">
                      <span className="text-zinc-700">Total Est. Cost</span>
                      <span className="text-zinc-800" style={{ fontFamily: "Fragment Mono, monospace" }}>₱{estCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="rounded-xl bg-white border border-zinc-200 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Est. Cost</div>
                  <div className="text-[16px] font-bold text-zinc-700" style={{ fontFamily: "Fragment Mono, monospace" }}>₱{estCost.toFixed(2)}</div>
                </div>
                <div className="rounded-xl bg-white border border-zinc-200 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Cost Price</div>
                  <div className="text-[16px] font-bold text-zinc-700" style={{ fontFamily: "Fragment Mono, monospace" }}>{cp > 0 ? `₱${cp.toFixed(2)}` : "—"}</div>
                </div>
                <div className="rounded-xl bg-white border border-zinc-200 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Profit</div>
                  <div className={`text-[16px] font-bold ${margin >= 30 ? "text-emerald-600" : margin >= 15 ? "text-amber-600" : "text-red-500"}`} style={{ fontFamily: "Fragment Mono, monospace" }}>{sp > 0 ? `₱${profit.toFixed(2)}` : "—"}</div>
                </div>
                <div className="rounded-xl bg-white border border-zinc-200 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Margin</div>
                  <div className={`text-[16px] font-bold ${margin >= 30 ? "text-emerald-600" : margin >= 15 ? "text-amber-600" : "text-red-500"}`} style={{ fontFamily: "Fragment Mono, monospace" }}>{sp > 0 ? `${margin.toFixed(1)}%` : "—"}</div>
                </div>
              </div>

              {sp > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${margin >= 30 ? "bg-emerald-500" : margin >= 15 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, margin)}%` }}></div>
                  </div>
                  <span className={`text-[11px] font-semibold ${margin >= 30 ? "text-emerald-600" : margin >= 15 ? "text-amber-600" : "text-red-500"}`}>{margin.toFixed(1)}%</span>
                </div>
              )}
            </div>

            {/* Variants */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Size Variants</label>
                <button type="button" onClick={() => setVariants(prev => [...prev, { id: `VAR-${Date.now()}`, size: "", sellingPrice: 0, wholesalePrice: 0 }])} className="text-[12px] text-zinc-500 hover:text-zinc-800 font-medium">+ Add Variant</button>
              </div>
              {variants.length === 0 ? (
                <p className="text-[12px] text-zinc-400">No variants. Click "+ Add Variant" for size-based pricing.</p>
              ) : (
                <div className="space-y-2">
                  {variants.map((v, i) => (
                    <div key={v.id} className="flex items-center gap-2">
                      <input value={v.size} onChange={e => { const u = [...variants]; u[i] = { ...u[i], size: e.target.value }; setVariants(u); }} placeholder="Size (e.g. Small, Regular)" className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] outline-none focus:border-zinc-400" />
                      <input type="number" min="0" step="0.01" value={v.sellingPrice || ""} onChange={e => { const u = [...variants]; u[i] = { ...u[i], sellingPrice: Number(e.target.value) || 0 }; setVariants(u); }} placeholder="Selling" className="w-24 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-center outline-none focus:border-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }} />
                      <input type="number" min="0" step="0.01" value={v.wholesalePrice || ""} onChange={e => { const u = [...variants]; u[i] = { ...u[i], wholesalePrice: Number(e.target.value) || 0 }; setVariants(u); }} placeholder="Wholesale" className="w-24 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-center outline-none focus:border-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }} />
                      <button type="button" onClick={() => setVariants(prev => prev.filter((_, idx) => idx !== i))} className="text-zinc-400 hover:text-red-500 text-[13px]">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t border-[#E8E0D5]">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
            <button type="submit" disabled={!name.trim()} className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}

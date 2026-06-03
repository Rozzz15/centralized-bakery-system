import React, { useEffect, useRef, useState } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { createPortal } from "react-dom";
import type { InventoryItem, DOSItem, ProductionTask, Delivery, AuditLog, KPIs, StockTransaction, DeliveryValidation, ProductRecipe, RecipeIngredient, MaterialRequest, BakerIngredientRequest, ProductPricing, Role, FreezerItem, FreezerHistory, Purchase, BillDue, Revenue, WasteLog } from "../types";
import * as db from "../lib/db";
import DOSBuilderModal from "./DOSBuilderModal";
import EditProductModal from "./EditProductModal";

type Props = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  inventory: InventoryItem[];
  onUpdateInventory: (cb: InventoryItem[] | ((prev: InventoryItem[]) => InventoryItem[])) => void;
  dosItems: DOSItem[];
  production: ProductionTask[];
  onUpdateProduction: (taskId: string, updates: Partial<ProductionTask>) => void;
  deliveries: Delivery[];
  auditLogs: AuditLog[];
  kpis: KPIs;
  onOpenDOSBuilder: () => void;
  onCreateDOS: (items: DOSItem[], tasks: ProductionTask[]) => void;
  onAddProduct: (product: InventoryItem) => void;
  onEditDOS: (item: DOSItem) => void;
  onDeleteDOS: (id: string) => void;
  productCatalog: string[];
  onUpdateProductCatalog: (cb: string[] | ((prev: string[]) => string[])) => void;
  recipes: ProductRecipe[];
  onUpdateRecipes: (cb: ProductRecipe[] | ((prev: ProductRecipe[]) => ProductRecipe[])) => void;
  onAddAuditLog?: (action: string, details: string) => void;
  onUpdateDeliveries?: (deliveries: Delivery[] | ((prev: Delivery[]) => Delivery[])) => void;
  productPricing: ProductPricing[];
  onUpdateProductPricing: (cb: ProductPricing[] | ((prev: ProductPricing[]) => ProductPricing[])) => void;
  freezerItems?: FreezerItem[];
  onUpdateFreezer?: (cb: FreezerItem[] | ((prev: FreezerItem[]) => FreezerItem[])) => void;
  purchases: Purchase[];
  onUpdatePurchases: (cb: Purchase[] | ((prev: Purchase[]) => Purchase[])) => void;
  billsAndDues: BillDue[];
  onUpdateBillsAndDues: (cb: BillDue[] | ((prev: BillDue[]) => BillDue[])) => void;
  revenue: Revenue[];
  onUpdateRevenue: (cb: Revenue[] | ((prev: Revenue[]) => Revenue[])) => void;
  wasteLog: WasteLog[];
  onUpdateWasteLog: (cb: WasteLog[] | ((prev: WasteLog[]) => WasteLog[])) => void;
};

export default function AdminDashboard({
  activeTab,
  setActiveTab,
  inventory,
  onUpdateInventory,
  dosItems,
  production,
  onUpdateProduction,
  deliveries,
  auditLogs,
  kpis,
  onOpenDOSBuilder,
  onCreateDOS,
  onAddProduct,
  onEditDOS,
  onDeleteDOS,
  productCatalog,
  onUpdateProductCatalog,
  onAddAuditLog,
  recipes,
  onUpdateRecipes,
  onUpdateDeliveries,
  productPricing,
  onUpdateProductPricing,
  freezerItems = [],
  onUpdateFreezer,
  purchases,
  onUpdatePurchases,
  billsAndDues,
  onUpdateBillsAndDues,
  revenue,
  onUpdateRevenue,
  wasteLog,
  onUpdateWasteLog,
}: Props) {
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [invSearch, setInvSearch] = useState("");
  const [expandedDOS, setExpandedDOS] = useState<Set<string>>(new Set());
  const toggleDOSHistory = (id: string) => setExpandedDOS(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [expandedSched, setExpandedSched] = useState<Set<string>>(new Set());
  const toggleSched = (date: string) => setExpandedSched(prev => { const n = new Set(prev); if (n.has(date)) n.delete(date); else n.add(date); return n; });
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [editingDOS, setEditingDOS] = useState<DOSItem | null>(null);
  const [scheduledAddDate, setScheduledAddDate] = useState<string | null>(null);
  const [todayAddOpen, setTodayAddOpen] = useState(false);
  const [dosRoleFilter, setDosRoleFilter] = useState<"all" | "baker" | "deco" | "pastry">("all");
  const [editingInvItem, setEditingInvItem] = useState<InventoryItem | null>(null);

  // Finance
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [showAddBill, setShowAddBill] = useState(false);
  const [editingBill, setEditingBill] = useState<BillDue | null>(null);
  const [showAddRevenue, setShowAddRevenue] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [showAddWaste, setShowAddWaste] = useState(false);
  const [editingWaste, setEditingWaste] = useState<WasteLog | null>(null);
  const [financeSearch, setFinanceSearch] = useState("");
  const [financeTab, setFinanceTab] = useState<"purchases" | "bills" | "revenue" | "waste" | "analytics">("purchases");
  const [financePeriod, setFinancePeriod] = useState<"today" | "week" | "month" | "year" | "custom">("month");
  const [financeCustomMonth, setFinanceCustomMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Stockroom
  const [warehouseSection, setWarehouseSection] = useState<"ingredients" | "packaging-materials" | "decoration-supplies" | "operational-supplies" | "history">("ingredients");
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [showReceive, setShowReceive] = useState(false);

  // Delivery validation
  const [validations, setValidations] = useState<DeliveryValidation[]>([]);

  // Material requests from Baker & Deco
  const [bakerReqs, setBakerReqs] = useState<BakerIngredientRequest[]>([]);
  const [decoReqs, setDecoReqs] = useState<MaterialRequest[]>([]);

  // Add Delivery modal
  const [showAddDelivery, setShowAddDelivery] = useState(false);
  const [newDeliveryBranch, setNewDeliveryBranch] = useState("Cakes N Styles Gensan");
  const [newDeliveryCustom, setNewDeliveryCustom] = useState("");
  const [newDeliveryDate, setNewDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [newDeliveryItems, setNewDeliveryItems] = useState<{ product: string; qty: number; price?: number }[]>([]);
  const [newDeliveryEta, setNewDeliveryEta] = useState("");
  const [expandedProducers, setExpandedProducers] = useState<Set<string>>(new Set());
  const [deliverySearch, setDeliverySearch] = useState<Record<string, string>>({});
  const [newDeliveryAddress, setNewDeliveryAddress] = useState("");
  const [newDeliveryContact, setNewDeliveryContact] = useState("");
  const [newDeliveryRider, setNewDeliveryRider] = useState("");
  const [newDeliveryPayment, setNewDeliveryPayment] = useState<"unpaid" | "paid" | "half">("unpaid");
  const [newDeliveryMode, setNewDeliveryMode] = useState<"cash" | "check" | "online" | "bank">("cash");
  const [newDeliveryAmount, setNewDeliveryAmount] = useState("");
  const [newDeliveryNotes, setNewDeliveryNotes] = useState("");
  const [showDeliveryDetail, setShowDeliveryDetail] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  // Recalc item prices when destination changes
  useEffect(() => {
    const useWholesale = newDeliveryBranch === "__custom__";
    setNewDeliveryItems(prev => prev.map(item => {
      const pricing = productPricing.find(p => p.productName === item.product);
      const defaultPrice = useWholesale ? (pricing?.wholesalePrice ?? 0) : (pricing?.sellingPrice ?? 0);
      return { ...item, price: defaultPrice };
    }));
  }, [newDeliveryBranch, productPricing]);

  // Helper: filter DOS items created today (by timestamp in ID)
  const getTodayDOS = () => {
    const todayStr = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    return dosItems.filter(i => {
      if (i.status === "scheduled") return false;
      const ts = i.id.match(/DOS-(\d+)/)?.[1];
      if (!ts) return true;
      const itemDate = new Date(Number(ts)).toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
      return itemDate === todayStr;
    });
  };
  const todayDOS = getTodayDOS();

  // Pricing
  const [pricingSearch, setPricingSearch] = useState("");
  const [pricingFilter, setPricingFilter] = useState<"all" | "active" | "draft" | "archived">("all");
  const [editingPricing, setEditingPricing] = useState<ProductPricing | null>(null);
  const [showPricingModal, setShowPricingModal] = useState(false);

  // Products
  const [showRecipe, setShowRecipe] = useState(false);
  const [recipeProduct, setRecipeProduct] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [renamingProduct, setRenamingProduct] = useState("");

  const [showAllProdHistory, setShowAllProdHistory] = useState(false);
  const [showAllDOSHistory, setShowAllDOSHistory] = useState(false);
  const [expandedProdGroups, setExpandedProdGroups] = useState<Set<string>>(new Set());
  const toggleProdGroup = (date: string) => setExpandedProdGroups(prev => { const n = new Set(prev); if (n.has(date)) n.delete(date); else n.add(date); return n; });
  const [recipeSearch, setRecipeSearch] = useState("");
  const [activeProductSubTab, setActiveProductSubTab] = useState("All");

  // Toasts
  type ToastItem = { name: string; detail: string };
  type Toast = { id: string; sections: { type: "low-stock" | "no-stock" | "expired" | "expiring"; items: ToastItem[] }[] };
  const [toast, setToast] = useState<Toast | null>(null);
  const dismissedAlerts = useRef(new Set<string>());
  const showToast = (sections: Omit<Toast, "id">["sections"]) => {
    const filtered = sections.map(s => ({ ...s, items: s.items.filter(i => !dismissedAlerts.current.has(i.name)) })).filter(s => s.items.length > 0);
    if (filtered.length === 0) return;
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    setToast({ id, sections: filtered });
    setTimeout(() => setToast(null), 6000);
  };
  const dismissToast = () => {
    if (toast) toast.sections.forEach(s => s.items.forEach(i => dismissedAlerts.current.add(i.name)));
    setToast(null);
  };

  const [statModal, setStatModal] = useState<"low-stock" | "no-stock" | "expired" | "expiring" | null>(null);

  useEffect(() => {
    Promise.all([
      db.fetchStockTransactions().then(setTransactions).catch(() => {}),
      db.fetchDeliveryValidations().then(setValidations).catch(() => {}),
      db.fetchBakerIngredientRequests().then(setBakerReqs).catch(() => {}),
      db.fetchMaterialRequests().then(setDecoReqs).catch(() => {}),
    ]);
  }, []);

  const prevTab = useRef(activeTab);
  useEffect(() => {
    if (activeTab !== "warehouse" || prevTab.current === "warehouse") { prevTab.current = activeTab; return; }
    prevTab.current = activeTab;
    const now = new Date();
    const todayStr = now.toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    const lowStock = inventory.filter(i => i.onHand > 0 && i.onHand < i.threshold);
    const noStock = inventory.filter(i => i.onHand === 0);
    const expired = inventory.filter(i => i.expiryDate && i.expiryDate < todayStr);
    const expiring = inventory.filter(i => i.expiryDate && i.expiryDate >= todayStr && new Date(i.expiryDate).getTime() - now.getTime() <= 30 * 24 * 60 * 60 * 1000);
    const sections: Toast["sections"] = [];
    if (noStock.length > 0) sections.push({ type: "no-stock", items: noStock.map(i => ({ name: i.name, detail: `${i.unit}` })) });
    if (lowStock.length > 0) sections.push({ type: "low-stock", items: lowStock.map(i => ({ name: i.name, detail: `${i.onHand}/${i.threshold} ${i.unit}` })) });
    if (expired.length > 0) sections.push({ type: "expired", items: expired.map(i => ({ name: i.name, detail: `Expired ${i.expiryDate}` })) });
    if (expiring.length > 0) sections.push({ type: "expiring", items: expiring.map(i => ({ name: i.name, detail: `Expires ${i.expiryDate}` })) });
    if (sections.length > 0) showToast(sections);
  }, [activeTab]);

  /* ── Products Tab ── */
  if (activeTab === "products") {
    const searchTerm = invSearch.toLowerCase();
    const filteredProducts = productCatalog.filter(p => {
      const isCategoryMatch = activeProductSubTab === "All" || activeProductSubTab === "Products" ||
        (activeProductSubTab === "Bakery" && recipes.some(r => r.productName === p)) ||
        (activeProductSubTab === "Other" && !recipes.some(r => r.productName === p));

      if (!isCategoryMatch) return false;
      if (!invSearch) return true;
      if (p.toLowerCase().includes(searchTerm)) return true;
      const recipe = recipes.find(r => r.productName === p);
      if (!recipe) return false;
      return (
        recipe.ingredients.some(i => i.name.toLowerCase().includes(searchTerm)) ||
        (recipe.packagingMaterials ?? []).some(i => i.name.toLowerCase().includes(searchTerm)) ||
        (recipe.decorationSupplies ?? []).some(i => i.name.toLowerCase().includes(searchTerm))
      );
    });

    const computeRecipeCost = (recipe: ProductRecipe) => {
      return recipe.ingredients.reduce((sum, ing) => {
        const inv = inventory.find(i => i.id === ing.inventoryId);
        return sum + (inv ? inv.cost * ing.qtyPerBatch : 0);
      }, 0);
    };

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-[24px] font-semibold">Products</h1>
          <button onClick={() => setShowAddProduct(true)} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800">+ Add Product</button>
        </div>

        <div className="flex items-center gap-2 border-b border-zinc-200 pb-1">
          {["Products", "Recipes"].map(tab => (
            <button key={tab} onClick={() => setActiveProductSubTab(tab)} className={`px-3 py-1.5 text-[13px] font-medium transition-colors ${activeProductSubTab === tab ? "text-zinc-900 border-b-2 border-zinc-900" : "text-zinc-500 hover:text-zinc-900"}`}>{tab}</button>
          ))}
        </div>

        <div className="relative max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
          <input type="text" value={activeProductSubTab === "Recipes" ? recipeSearch : invSearch} onChange={e => activeProductSubTab === "Recipes" ? setRecipeSearch(e.target.value) : setInvSearch(e.target.value)} placeholder={`Search ${activeProductSubTab.toLowerCase()}...`} className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-[13px] outline-none focus:border-zinc-400" />
        </div>

        {activeProductSubTab === "Products" && (
          <div className="overflow-hidden rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Recipe</th><th className="px-4 py-3">Pack</th><th className="px-4 py-3">Deco</th><th className="px-4 py-3 w-32" /></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-[13px]">
                {filteredProducts.map(product => {
                  const recipe = recipes.find(r => r.productName === product);
                  return (
                    <tr key={product} className="hover:bg-zinc-50/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{product}</div>
                      </td>
                      <td className="px-4 py-3">
                        {recipe?.linkedProduct && recipe.linkedProduct.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {recipe.linkedProduct.map(lp => (
                              <span key={lp} className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">{lp}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {recipe?.packagingMaterials && recipe.packagingMaterials.length > 0 ? (
                          <span className="text-[12px] text-zinc-600">{recipe.packagingMaterials.length} pack.</span>
                        ) : (
                          <span className="text-[12px] text-zinc-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {recipe?.decorationSupplies && recipe.decorationSupplies.length > 0 ? (
                          <span className="text-[12px] text-zinc-600">{recipe.decorationSupplies.length} deco.</span>
                        ) : (
                          <span className="text-[12px] text-zinc-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => { setEditingProduct(product); setRenamingProduct(product); }} className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all">Edit</button>
                          <button onClick={() => { if (confirm(`Delete "${product}"?`)) { onUpdateProductCatalog(prev => prev.filter(p => p !== product)); db.removeFromCatalog(product).catch(console.error); const existingRecipe = recipes.find(r => r.productName === product); if (existingRecipe) { onUpdateRecipes(prev => prev.filter(r => r.productName !== product)); db.deleteRecipe(product).catch(console.error); } } }} className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-all">Del</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[14px] text-zinc-500">{productCatalog.length === 0 ? "No products yet. Add one above." : "No products match your search."}</p>
            </div>
          )}
        </div>
        )}

          {activeProductSubTab === "Recipes" && (
            <div className="overflow-hidden rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm">
              {recipes.length === 0 ? (
                <div className="px-5 pb-5">
                  <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center">
                    <p className="text-[13px] text-zinc-500">No recipes yet. Select a product above to add ingredients.</p>
                  </div>
                </div>
              ) : (() => {
                const filteredRecipes = !recipeSearch ? recipes : recipes.filter(r =>
                  r.productName.toLowerCase().includes(recipeSearch.toLowerCase())
                );
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[13px]">
                      <thead className="bg-zinc-50/50 text-zinc-500">
                        <tr>
                          <th className="px-4 py-3">Recipe</th>
                          <th className="px-4 py-3">Items</th>
                          <th className="px-4 py-3">Linked Product</th>
                          <th className="px-4 py-3">Notes</th>
                          <th className="px-4 py-3 text-right">Cost</th>
                          <th className="px-4 py-3 w-32" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {filteredRecipes.map(recipe => (
                          <tr key={recipe.productName} className="hover:bg-zinc-50/60">
                            <td className="px-4 py-3 font-medium text-zinc-900">{recipe.productName}</td>
                            <td className="px-4 py-3 text-zinc-600">{recipe.ingredients.length} items</td>
                            <td className="px-4 py-3 text-zinc-600">{recipe.linkedProduct || "-"}</td>
                            <td className="px-4 py-3 text-zinc-600">{recipe.notes || "-"}</td>
                            <td className="px-4 py-3 text-right font-medium text-zinc-900">₱{computeRecipeCost(recipe).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={() => { setRecipeProduct(recipe.productName); setShowRecipe(true); }} className="text-zinc-500 hover:text-zinc-900">Edit</button>
                                <button onClick={() => { if (confirm(`Delete recipe for "${recipe.productName}"?`)) { onUpdateRecipes(prev => prev.filter(r => r.productName !== recipe.productName)); db.deleteRecipe(recipe.productName).catch(console.error); } }} className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-all">Del</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Add Product Modal */}
          {showAddProduct && (
            <AddProductWithRecipeModal
              inventory={inventory}
              recipes={recipes}
              onSave={(name, packagingMaterials, decorationSupplies, linkedProduct) => {
                onUpdateProductCatalog(prev => prev.includes(name) ? prev : [...prev, name]);
                db.addToCatalog(name).catch(console.error);
                const recipe: ProductRecipe = { productId: name, productName: name, ingredients: [], packagingMaterials, decorationSupplies, notes: "", linkedProduct };
                onUpdateRecipes(prev => {
                  const idx = prev.findIndex(p => p.productId === recipe.productId);
                  if (idx >= 0) { const next = [...prev]; next[idx] = recipe; return next; }
                  return [...prev, recipe];
                });
                db.upsertRecipe(recipe).catch(console.error);
                setShowAddProduct(false);
              }}
              onClose={() => setShowAddProduct(false)}
            />
          )}

          {/* Recipe Modal */}
          {showRecipe && recipeProduct !== null && (
            <RecipeModal
              product={recipeProduct}
              recipes={recipes}
              inventory={inventory}
              onSave={(r) => {
                const originalKey = recipeProduct || r.productName;
                onUpdateRecipes(prev => {
                  const idx = prev.findIndex(p => p.productName === originalKey);
                  if (idx >= 0) { const next = [...prev]; next[idx] = r; return next; }
                  return [...prev, r];
                });
                db.upsertRecipe(r).catch(console.error);
                setShowRecipe(false);
                setRecipeProduct(null);
              }}
              onClose={() => { setShowRecipe(false); setRecipeProduct(null); }}
            />
          )}

          {/* Edit Product Modal */}
          {editingProduct !== null && (
            <EditProductModal
              productName={editingProduct}
              recipes={recipes}
              inventory={inventory}
              onSave={(originalName, newName, packagingMaterials, decorationSupplies, linkedProduct) => {
                if (originalName !== newName) {
                  onUpdateProductCatalog(prev => {
                    const next = prev.filter(p => p !== originalName);
                    return next.includes(newName) ? next : [...next, newName];
                  });
                  db.removeFromCatalog(originalName).catch(console.error);
                  db.addToCatalog(newName).catch(console.error);
                }
                const recipe: ProductRecipe = {
                  productId: newName,
                  productName: newName,
                  ingredients: recipes.find(r => r.productName === originalName)?.ingredients || [],
                  packagingMaterials,
                  decorationSupplies,
                  notes: recipes.find(r => r.productName === originalName)?.notes || "",
                  linkedProduct,
                };
                onUpdateRecipes(prev => {
                  const idx = prev.findIndex(p => p.productName === originalName);
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = recipe;
                    return next;
                  }
                  return [...prev, recipe];
                });
                db.upsertRecipe(recipe).catch(console.error);
                setEditingProduct(null);
                setRenamingProduct("");
              }}
              onClose={() => { setEditingProduct(null); setRenamingProduct(""); }}
            />
          )}
        </div>
      );
    }

    /* ── Stockroom Tab ── */
  if (activeTab === "warehouse") {
    const now = new Date();
    const todayStr = now.toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    const lowStock = inventory.filter(i => i.onHand > 0 && i.onHand < i.threshold);
    const noStock = inventory.filter(i => i.onHand === 0);
    const expired = inventory.filter(i => i.expiryDate && i.expiryDate < todayStr);
    const expiring = inventory.filter(i => i.expiryDate && i.expiryDate >= todayStr && new Date(i.expiryDate).getTime() - now.getTime() <= 30 * 24 * 60 * 60 * 1000);

    const groupItems = (g: typeof warehouseSection) => inventory.filter(i => g === "history" ? false : i.group === g);

    const sidebarItems: { key: typeof warehouseSection; label: string; icon: string }[] = [
      { key: "ingredients", label: "Ingredients", icon: "◇" },
      { key: "packaging-materials", label: "Packaging Materials", icon: "□" },
      { key: "decoration-supplies", label: "Decoration Supplies", icon: "○" },
      { key: "operational-supplies", label: "Operational Supplies", icon: "△" },
      { key: "history", label: "Stock History", icon: "▽" },
    ];

    return (
      <div className="flex gap-5">
        {/* Sidebar */}
        <div className="w-52 shrink-0 space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-2 px-3">Stock Room</div>
          {sidebarItems.map(item => (
            <button key={item.key} onClick={() => setWarehouseSection(item.key)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-left transition-all ${warehouseSection === item.key ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100"}`}>
              <span className="text-[15px]">{item.icon}</span>
              <span>{item.label}</span>
              {item.key !== "history" && (
                <span className="ml-auto rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-mono font-medium text-zinc-600">{groupItems(item.key).length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[24px] font-semibold">
                {warehouseSection === "history" ? "Stock History" : sidebarItems.find(s => s.key === warehouseSection)?.label}
              </h1>
              <p className="mt-1 text-[13px] text-zinc-600">Manage all material IN and OUT movements.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {warehouseSection !== "history" && (
                <>
                  <button onClick={() => setShowReceive(true)} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Receive from Supplier</button>
                  <button onClick={() => setEditingInvItem({ id: `INV-${Date.now()}`, name: "", sku: "", unit: "", onHand: 0, threshold: 10, cost: 0, supplier: "", lastIn: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0], category: warehouseSection === "packaging-materials" ? "packaging" : "dry", group: warehouseSection, accessRoles: [] })} className="rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-[13px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 hover:border-zinc-400 active:scale-[0.97] transition-all">+ New Item</button>
                </>
              )}
            </div>
          </div>

          {/* Quick Stats (shown for group views, not history) */}
          {warehouseSection !== "history" && (
            <div className="grid grid-cols-5 gap-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Total Items</div><div className="text-[24px] font-semibold mt-1">{groupItems(warehouseSection).length}</div></div>
              <button onClick={() => setStatModal("low-stock")} className="rounded-2xl border border-zinc-200 bg-white p-4 text-left hover:border-red-300 hover:bg-red-50/40 transition-all"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Low Stock</div><div className="text-[24px] font-semibold mt-1 text-red-600">{lowStock.filter(i => i.group === warehouseSection).length}</div></button>
              <button onClick={() => setStatModal("no-stock")} className="rounded-2xl border border-zinc-200 bg-white p-4 text-left hover:border-zinc-400 hover:bg-zinc-50/60 transition-all"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">No Stock</div><div className="text-[24px] font-semibold mt-1 text-zinc-800">{noStock.filter(i => i.group === warehouseSection).length}</div></button>
              <button onClick={() => setStatModal("expired")} className="rounded-2xl border border-zinc-200 bg-white p-4 text-left hover:border-purple-300 hover:bg-purple-50/40 transition-all"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Expired</div><div className="text-[24px] font-semibold mt-1 text-purple-600">{expired.filter(i => i.group === warehouseSection).length}</div></button>
              <button onClick={() => setStatModal("expiring")} className="rounded-2xl border border-zinc-200 bg-white p-4 text-left hover:border-amber-300 hover:bg-amber-50/40 transition-all"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Expiring ≤30 Days</div><div className="text-[24px] font-semibold mt-1 text-amber-600">{expiring.filter(i => i.group === warehouseSection).length}</div></button>
            </div>
          )}

          {/* Stock History View */}
          {warehouseSection === "history" ? (
            <div>
              {transactions.length > 0 ? (
                <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[16px] font-semibold text-white">Transaction History</h2>
                    <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-200 font-mono">{transactions.length} entries</span>
                  </div>
                  
                  {/* Container with constrained height */}
                  <div className="max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                    <div className="space-y-0">
                      {/* Compact Header Row */}
                      <div className="grid grid-cols-[auto,1fr,auto] gap-2 px-3 py-1 text-[9px] font-bold text-zinc-500 uppercase tracking-wider sticky top-0 bg-zinc-900/95 backdrop-blur-sm z-10 border-b border-zinc-800">
                        <span>Type</span>
                        <span>Item / Reference</span>
                        <span className="text-right">Qty / Time</span>
                      </div>
                      
                      {[...transactions].reverse().map(tx => (
                        <div key={tx.id} className="grid grid-cols-[auto,1fr,auto] items-center gap-2 px-3 py-1 text-[11px] hover:bg-zinc-800/50 border-b border-zinc-800/50">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${tx.type === "in" ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-300"}`}>{tx.type}</span>
                          <div className="flex flex-col truncate">
                            <span className="font-semibold text-zinc-100 truncate">{tx.itemName}</span>
                            <span className="text-[9px] text-zinc-500 truncate">{tx.reference || "No Ref"} {tx.group && `· ${tx.group.replace(/-/g, " ")}`}</span>
                          </div>
                          <div className="flex flex-col items-end whitespace-nowrap">
                            <span className="font-mono text-zinc-200 font-medium">{tx.type === "in" ? "+" : "-"}{tx.qty} {tx.unit}</span>
                            <span className="text-[9px] text-zinc-600 font-mono">{tx.timestamp.split(' ')[1]}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-10 text-center"><p className="text-[14px] text-zinc-400">No transactions yet.</p></div>
              )}
            </div>
          ) : (
            <>
{/* Items filtered by group */}
              <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[16px] font-semibold text-white">{sidebarItems.find(s => s.key === warehouseSection)?.label}</h2>
                  <div className="flex items-center gap-2">
                    <div className="relative max-w-[220px]">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
                      <input type="text" value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Search items..." className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2 pl-8 pr-3 text-[12px] text-white outline-none focus:border-zinc-500" />
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-[500px] space-y-2">
                  {groupItems(warehouseSection).filter(i => !invSearch || i.name.toLowerCase().includes(invSearch.toLowerCase()) || i.sku.toLowerCase().includes(invSearch.toLowerCase()) || i.supplier.toLowerCase().includes(invSearch.toLowerCase())).map(item => {
                    const pct = Math.min(100, (item.onHand / item.threshold) * 100);
                    const isCritical = item.onHand < item.threshold;
                    const isExpired = item.expiryDate && item.expiryDate < todayStr;
                    const isExpiring = item.expiryDate && item.expiryDate >= todayStr && new Date(item.expiryDate).getTime() - now.getTime() <= 30 * 24 * 60 * 60 * 1000;
                    return (
                      <div key={item.id} className="flex items-center gap-4 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 hover:bg-zinc-700/60">
                        <div className="min-w-[160px]">
                          <div className="text-[13px] font-medium text-white">{item.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-zinc-400">{item.sku} · {item.category}</span>
                            {isExpired && <span className="rounded-full bg-purple-900 px-1.5 py-0.5 text-[9px] font-medium text-purple-200">Expired</span>}
                            {isExpiring && <span className="rounded-full bg-amber-900 px-1.5 py-0.5 text-[9px] font-medium text-amber-200">Expiring</span>}
                          </div>
                        </div>
                        <div className="flex-1"><div className="h-2 rounded-full bg-zinc-700"><div className={`h-full rounded-full ${isExpired ? "bg-purple-500" : isCritical ? "bg-red-500" : item.onHand < item.threshold * 1.5 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} /></div></div>
                        <div className="text-right min-w-[80px]"><div className={`text-[13px] font-semibold ${isCritical ? "text-red-400" : "text-white"}`}>{item.onHand} <span className="text-[11px] font-normal text-zinc-500">/ {item.threshold}</span></div><div className="text-[11px] text-zinc-400">{item.unit}</div></div>
                        <div className="text-[12px] text-zinc-400 min-w-[120px] text-right">{item.supplier}{item.expiryDate ? <span className="block text-[11px] text-zinc-500">Exp: {item.expiryDate}</span> : <span className="block text-[11px] text-zinc-600">No expiry</span>}</div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setEditingInvItem(item)} className="rounded-lg border border-zinc-600 bg-zinc-700 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 hover:bg-zinc-600 hover:border-zinc-500 transition-all">Edit</button>
                          <button onClick={async () => { if (confirm(`Delete "${item.name}"?`)) { await db.deleteInventoryItem(item.id, item.group); onUpdateInventory(inventory.filter(i => i.id !== item.id)); onAddAuditLog?.("INVENTORY_DELETED", `${item.name} removed from ${item.group}`); } }} className="rounded-lg border border-red-800 bg-red-900/30 px-2.5 py-1.5 text-[11px] font-medium text-red-300 hover:bg-red-900/50 hover:border-red-700 transition-all">Del</button>
                        </div>
                      </div>
                    );
                  })}
                  {groupItems(warehouseSection).filter(i => !invSearch || i.name.toLowerCase().includes(invSearch.toLowerCase()) || i.sku.toLowerCase().includes(invSearch.toLowerCase()) || i.supplier.toLowerCase().includes(invSearch.toLowerCase())).length === 0 && <div className="text-center py-10 text-[14px] text-zinc-400">{invSearch ? "No items match your search." : "No items in this group yet."}</div>}
                  </div>
                </div>
              </div>

              {/* Pending Material Requests */}
              {(bakerReqs.filter(r => r.status === "pending-approval" || r.status === "approved").length > 0 ||
                decoReqs.filter(r => r.status === "pending-approval" || r.status === "approved").length > 0) && (
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
            <h2 className="text-[16px] font-semibold mb-4">Pending Material Requests</h2>
            <div className="space-y-3">
              {bakerReqs.filter(r => r.status === "pending-approval" || r.status === "approved").map(req => (
                <div key={req.id} className="rounded-xl border border-stone-200 bg-stone-50/40 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-stone-500 px-2 py-0.5 text-[10px] font-medium text-white">Baker</span>
                        <span className="text-[12px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{req.id}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {req.items.map((item, i) => (
                          <span key={i} className="rounded-lg bg-white border border-stone-200 px-2.5 py-1 text-[12px] text-zinc-700">{item.name} x{item.qty}{item.unit}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {req.status === "pending-approval" && (
                        <button onClick={async () => {
                          const updated = bakerReqs.map(r => r.id === req.id ? { ...r, status: "approved" as const } : r);
                          setBakerReqs(updated);
                          await db.replaceBakerIngredientRequests(updated).catch(console.error);
                        }} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-800">Approve</button>
                      )}
                      {req.status === "approved" && (
                        <button onClick={async () => {
                          const updated = bakerReqs.map(r => r.id === req.id ? { ...r, status: "released" as const } : r);
                          setBakerReqs(updated);
                          await db.replaceBakerIngredientRequests(updated).catch(console.error);
                          // Deduct from inventory
                          const newInv = [...inventory];
                          req.items.forEach(ri => {
                            const idx = newInv.findIndex(i => i.name.toLowerCase() === ri.name.toLowerCase());
                            if (idx >= 0) newInv[idx] = { ...newInv[idx], onHand: Math.max(0, newInv[idx].onHand - ri.qty) };
                          });
                          onUpdateInventory(newInv);
                          await db.upsertInventory(newInv).catch(console.error);
                          const tx: StockTransaction = { id: `TX-${Date.now()}`, type: "out", itemName: req.items.map(i => i.name).join(", "), itemId: req.id, qty: req.items.reduce((s, i) => s + i.qty, 0), unit: "", reference: `Released to Baker`, timestamp: new Date().toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), target: "baker", group: "ingredients" };
                          setTransactions(prev => [...prev, tx]);
                          await db.insertStockTransaction(tx).catch(console.error);
                        }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700">Release</button>
                      )}
                      {req.status === "released" && <span className="text-[11px] text-emerald-600 font-medium">✓ Released</span>}
                    </div>
                  </div>
                </div>
              ))}
              {decoReqs.filter(r => r.status === "pending-approval" || r.status === "approved").map(req => (
                <div key={req.id} className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-medium text-white">Deco</span>
                        <span className="text-[12px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{req.id}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {req.items.map((item, i) => (
                          <span key={i} className="rounded-lg bg-white border border-rose-200 px-2.5 py-1 text-[12px] text-zinc-700">{item.name} x{item.qty} {item.unit}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {req.status === "pending-approval" && (
                        <button onClick={async () => {
                          const updated = decoReqs.map(r => r.id === req.id ? { ...r, status: "approved" as const } : r);
                          setDecoReqs(updated);
                          await db.replaceMaterialRequests(updated).catch(console.error);
                        }} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-800">Approve</button>
                      )}
                      {req.status === "approved" && (
                        <button onClick={async () => {
                          const updated = decoReqs.map(r => r.id === req.id ? { ...r, status: "released" as const } : r);
                          setDecoReqs(updated);
                          await db.replaceMaterialRequests(updated).catch(console.error);
                          // Deduct from inventory
                          const newInv = [...inventory];
                          req.items.forEach(ri => {
                            const idx = newInv.findIndex(i => i.name.toLowerCase() === ri.name.toLowerCase());
                            if (idx >= 0) newInv[idx] = { ...newInv[idx], onHand: Math.max(0, newInv[idx].onHand - ri.qty) };
                          });
                          onUpdateInventory(newInv);
                          await db.upsertInventory(newInv).catch(console.error);
                          const tx: StockTransaction = { id: `TX-${Date.now()}`, type: "out", itemName: req.items.map(i => i.name).join(", "), itemId: req.id, qty: req.items.reduce((s, i) => s + i.qty, 0), unit: "", reference: `Released to Deco`, timestamp: new Date().toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), target: "deco", group: "decoration-supplies" };
                          setTransactions(prev => [...prev, tx]);
                          await db.insertStockTransaction(tx).catch(console.error);
                        }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700">Release</button>
                      )}
                      {req.status === "released" && <span className="text-[11px] text-emerald-600 font-medium">✓ Released</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </>)}

        {/* Receive Modal */}
        {showReceive && <ReceiveModal inventory={inventory} onUpdateInventory={onUpdateInventory} onTransaction={async (tx) => { setTransactions(prev => [...prev, tx]); await db.insertStockTransaction(tx).catch(console.error); onAddAuditLog?.("STOCK_RECEIVED", `${tx.itemName} x${tx.qty} ${tx.unit} — ${tx.reference}`); }} onClose={() => setShowReceive(false)} />}
        {editingInvItem && <EditInventoryModal item={editingInvItem} onSave={async (updated) => { try { const exists = inventory.some(i => i.id === updated.id); if (exists) { const old = inventory.find(i => i.id === updated.id); onUpdateInventory(inventory.map(i => i.id === updated.id ? updated : i)); onAddAuditLog?.("INVENTORY_EDITED", `${updated.name} (${updated.sku}) updated`); if (old && old.onHand !== updated.onHand) { const diff = updated.onHand - old.onHand; const tx: StockTransaction = { id: `STX-${Date.now()}`, type: diff > 0 ? "in" : "out", itemName: updated.name, itemId: updated.id, qty: Math.abs(diff), unit: updated.unit, reference: "Manual adjustment", timestamp: new Date().toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), group: updated.group }; setTransactions(prev => [...prev, tx]); await db.insertStockTransaction(tx).catch(console.error); } } else { onUpdateInventory([...inventory, updated]); onAddAuditLog?.("INVENTORY_ADDED", `${updated.name} (${updated.sku}) added to ${updated.group}`); } } catch (err) { console.error("Save inventory failed:", err); alert("Failed to save item"); } setEditingInvItem(null); }} onClose={() => setEditingInvItem(null)} />}

        {/* Toast Container */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 w-[460px] pointer-events-none animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="pointer-events-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-zinc-800 text-white text-[14px] font-bold">!</div>
                <div className="flex-1 min-w-0 space-y-2">
                      {toast.sections.map((s, si) => {
                    const labelClass = s.type === "no-stock" ? "text-zinc-700" : s.type === "low-stock" ? "text-red-700" : s.type === "expired" ? "text-purple-700" : "text-amber-700";
                    return (
                      <div key={si}>
                        <div className={`text-[13px] font-semibold ${labelClass}`}>{s.items.length} {s.type === "no-stock" ? "out of stock" : s.type === "low-stock" ? "below threshold" : s.type === "expired" ? "expired" : "expiring within 30 days"}</div>
                        <div className="mt-1.5 space-y-1">{s.items.slice(0, 5).map((it, i) => (<div key={i} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2"><span className="text-[12px] font-medium text-zinc-800 truncate">{it.name}</span><span className="text-[11px] text-zinc-500 shrink-0 ml-2">{it.detail}</span></div>))}</div>
                        {s.items.length > 5 && <div className="mt-1 text-[11px] text-zinc-400 font-medium">+{s.items.length - 5} more</div>}
                      </div>
                    );
                  })}
                </div>
                <button onClick={dismissToast} className="shrink-0 grid h-6 w-6 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-all text-[12px]">✕</button>
              </div>
            </div>
          </div>
        )}

        {/* Stat View Modal */}
        {statModal && (() => {
          const items = statModal === "low-stock" ? lowStock.map(i => ({ name: i.name, detail: `${i.onHand}/${i.threshold} ${i.unit}` })) : statModal === "no-stock" ? noStock.map(i => ({ name: i.name, detail: "0 on hand" })) : statModal === "expired" ? expired.map(i => ({ name: i.name, detail: `Expired ${i.expiryDate}` })) : expiring.map(i => ({ name: i.name, detail: `Expires ${i.expiryDate}` }));
          const colors = statModal === "low-stock" ? ["red", "red"] as const : statModal === "no-stock" ? ["zinc", "zinc"] as const : statModal === "expired" ? ["purple", "purple"] as const : ["amber", "amber"] as const;
          return (
            <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/40 p-4 backdrop-blur-sm" onClick={() => setStatModal(null)}>
              <div className="w-full max-w-[420px] rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3"><h3 className="text-[15px] font-semibold text-zinc-900 capitalize">{statModal.replace("-", " ")}</h3><button onClick={() => setStatModal(null)} className="grid h-7 w-7 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-all">✕</button></div>
                {items.length === 0 ? <p className="text-[13px] text-zinc-400 py-2 text-center">No items in this category.</p> : <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">{items.map((it, i) => (<div key={i} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/60 px-3.5 py-2.5"><span className="text-[13px] font-medium text-zinc-800">{it.name}</span><span className={`text-[12px] font-medium ${colors[0] === "red" ? "text-red-600" : colors[0] === "zinc" ? "text-zinc-500" : colors[0] === "purple" ? "text-purple-600" : "text-amber-600"}`}>{it.detail}</span></div>))}</div>}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
    );
  }

  /* ── Audit Tab ── */
  if (activeTab === "audit") {
    return (
      <div className="space-y-5">
        <h1 className="text-[24px] font-semibold">Audit Trail</h1>
        <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
          <div className="space-y-3">
            {auditLogs.length === 0 ? (
              <p className="text-[13px] text-zinc-500 text-center py-8">No audit logs yet. Activity will appear here as you use the system.</p>
            ) : auditLogs.map(log => (
              <div key={log.id} className="flex items-start gap-3 border-b border-zinc-100 pb-3 last:border-0">
                <div className="mt-0.5 text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{log.timestamp}</div>
                <div className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${log.role === "admin" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>{log.role}</div>
                <div className="flex-1"><div className="text-[13px] font-medium text-zinc-900">{log.action.replace("_", " ")}</div><div className="text-[12px] text-zinc-600">{log.details} — {log.userName}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── DOS Tab ── */
  if (activeTab === "dos") {
    const roleColors: Record<string, string> = { baker: "bg-stone-500", deco: "bg-rose-500", kitchen: "bg-emerald-500", pastry: "bg-amber-500" };

    const dosGroups = (() => {
      const groups = new Map<string, DOSItem[]>();
      dosItems.forEach(item => {
        const base = item.id.replace(/-\d+$/, "");
        if (!groups.has(base)) groups.set(base, []);
        groups.get(base)!.push(item);
      });
      return Array.from(groups.entries()).map(([baseId, items]) => {
        const ts = items[0].id.match(/\w+-(\d+)/)?.[1];
        const date = ts ? new Date(Number(ts)) : null;
        return { baseId, items, date, total: items.reduce((s, i) => s + i.qty, 0) };
      }).sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    })();

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-[24px] font-semibold">DOS Builder</h1><p className="mt-1 text-[13px] text-zinc-600">Daily Order Sales management — create and track production tasks.</p></div>
          <button onClick={onOpenDOSBuilder} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800">+ New DOS</button>
        </div>

        {/* Today's DOS */}
        <div className="rounded-[24px] border border-zinc-700 bg-zinc-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-semibold text-white">Today's DOS</span>
              <span className="rounded-full bg-zinc-700 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 font-mono">{new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
            <div className="flex items-center gap-2">
              {(["all", "baker", "deco", "pastry"] as const).map(role => (
                <button key={role} onClick={() => setDosRoleFilter(role)} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${dosRoleFilter === role ? "bg-white text-zinc-900 shadow-sm" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>{role === "all" ? "All" : role.charAt(0).toUpperCase() + role.slice(1)}</button>
              ))}
              <button onClick={() => setTodayAddOpen(true)} className="rounded-lg bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-900 shadow-sm hover:bg-zinc-100 transition-all">+ Add</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }}><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Assigned To</th><th className="px-4 py-3 text-right">Status</th><th className="px-4 py-3 w-10" /></tr></thead>
              <tbody className="divide-y divide-zinc-700 text-[13px]">
                {(() => {
                  const filtered = dosRoleFilter === "all" ? todayDOS : todayDOS.filter(item => {
                    const itemKey = item.id.replace("DOS-", "");
                    return production.some(t => t.id.includes(itemKey) && t.assignedTo === dosRoleFilter);
                  });
                  if (filtered.length === 0) return <tr><td colSpan={6} className="text-center py-10 text-[13px] text-zinc-500">{dosRoleFilter === "all" ? "No DOS for today yet. Click \"+ New DOS\" to create one." : `No items assigned to ${dosRoleFilter} today.`}</td></tr>;
                  return filtered.map(item => {
                    const itemKey = item.id.replace("DOS-", "");
                    const relatedTasks = production.filter(t => t.id.includes(itemKey));
                    const roles = relatedTasks.length > 0 ? [...new Set(relatedTasks.map(t => t.assignedTo))] : (item.roles || []);
                    return (
                      <tr key={item.id} className="hover:bg-zinc-800/60">
                        <td className="px-4 py-3"><div className="font-medium text-white">{item.product}</div><div className="text-[11px] text-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.id}</div></td>
                        <td className="px-4 py-3 text-right font-medium text-white" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.qty}</td>
                        
                        
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${item.priority === "HIGH" ? "bg-red-50 text-red-700 border border-red-200" : item.priority === "MEDIUM" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-zinc-100 text-zinc-700"}`}>{item.priority}</span></td>
                        <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{roles.length > 0 ? roles.map(role => (<span key={role} className={`rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${roleColors[role] || "bg-zinc-500"}`}>{role}</span>)) : <span className="text-zinc-400 text-[11px]">—</span>}</div></td>
                        <td className="px-4 py-3 text-right"><span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${item.status === "completed" ? "text-emerald-400" : item.status === "in-progress" ? "text-amber-400" : "text-zinc-400"}`}><span className={`h-1.5 w-1.5 rounded-full ${item.status === "completed" ? "bg-emerald-500" : item.status === "in-progress" ? "bg-amber-500 animate-pulse" : "bg-zinc-300"}`} />{item.status === "in-progress" ? "In Progress" : item.status === "completed" ? "Completed" : "Pending"}</span></td>
                        <td className="px-4 py-3 text-right"><div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setEditingDOS(item)} className="rounded-lg border border-zinc-600 px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all">Edit</button>
                          <button onClick={async () => { if (confirm(`Delete "${item.product}" from today's DOS?`)) { onDeleteDOS(item.id); } }} className="rounded-lg border border-red-700 px-2 py-1 text-[11px] text-red-400 hover:bg-red-900/30 hover:border-red-500 transition-all">Del</button>
                        </div></td>
                      </tr>
                    );
                  })
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Scheduled DOS */}
        {(() => {
          const scheduled = dosItems.filter(i => i.status === "scheduled");
          if (scheduled.length === 0) return null;
          const byDate = new Map<string, DOSItem[]>();
          scheduled.forEach(i => { const d = i.scheduledDate || "unknown"; if (!byDate.has(d)) byDate.set(d, []); byDate.get(d)!.push(i); });
          const fmtDate = (d: string) => {
            try { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" }); } catch { return d; }
          };
          return (
            <div className="rounded-[24px] border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-semibold text-blue-900">Scheduled DOS</span>
                  <span className="rounded-full bg-blue-200 px-2.5 py-0.5 text-[11px] font-medium text-blue-800 font-mono">{scheduled.length} item{scheduled.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <div className="space-y-4">
                {[...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
                  <div key={date} className="overflow-hidden rounded-xl border border-blue-200 bg-white">
                    <div className="flex items-center justify-between bg-blue-100/60 px-4 py-2">
                      <span className="text-[13px] font-semibold text-blue-900">{fmtDate(date)}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setScheduledAddDate(date)} className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700 transition-all">+ Add</button>
                        <button onClick={() => { if (confirm(`Delete entire scheduled DOS for ${fmtDate(date)} (${items.length} item${items.length !== 1 ? "s" : ""})?`)) { items.forEach(i => onDeleteDOS(i.id)); } }} className="rounded-lg border border-red-300 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-all">Del All</button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                          <tr><th className="px-4 py-2.5">Product</th><th className="px-4 py-2.5 text-right">Qty</th><th className="px-4 py-2.5">Priority</th><th className="px-4 py-2.5">Assigned To</th><th className="px-4 py-2.5 text-right">Status</th><th className="px-4 py-2.5 w-24" /></tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 text-[13px]">
                          {items.map(item => {
                            const roles = item.roles || [];
                            return (
                              <tr key={item.id} className="hover:bg-blue-50/40">
                                <td className="px-4 py-2.5 font-medium text-zinc-900">{item.product}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-zinc-600">{item.qty}</td>
                                <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.priority === "HIGH" ? "bg-red-50 text-red-700 border border-red-200" : item.priority === "MEDIUM" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-zinc-100 text-zinc-600 border border-zinc-200"}`}>{item.priority}</span></td>
                                <td className="px-4 py-2.5">
                                  {roles.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {roles.map(role => (
                                        <span key={role} className={`rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${roleColors[role] || "bg-zinc-500"}`}>{role}</span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-[12px] text-zinc-400 italic">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-right"><span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${item.status === "completed" ? "text-emerald-600" : item.status === "in-progress" ? "text-amber-600" : "text-zinc-400"}`}><span className={`h-1.5 w-1.5 rounded-full ${item.status === "completed" ? "bg-emerald-500" : item.status === "in-progress" ? "bg-amber-500 animate-pulse" : "bg-zinc-300"}`} />{item.status === "in-progress" ? "In Progress" : item.status === "completed" ? "Completed" : "Scheduled"}</span></td>
                                <td className="px-4 py-2.5 text-right">
                                  <div className="flex items-center gap-1 justify-end">
                                    <button onClick={() => setEditingDOS(item)} className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all">Edit</button>
                                    <button onClick={async () => { if (confirm(`Delete "${item.product}" scheduled for ${fmtDate(date)}?`)) { onDeleteDOS(item.id); } }} className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-all">Del</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* DOS History */}
        {dosGroups.filter(g => g.items.some(i => i.status === "completed")).length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[18px] font-semibold">DOS History</h2>
              <div className="flex items-center gap-2">
                <input type="date" value={historyDateFilter} onChange={e => setHistoryDateFilter(e.target.value)} className="rounded-xl border border-zinc-200 px-3 py-1.5 text-[12px] outline-none focus:border-zinc-400" />
                {historyDateFilter && <button onClick={() => setHistoryDateFilter("")} className="text-[12px] text-zinc-500 hover:text-zinc-900 underline underline-offset-2">Clear</button>}
              </div>
            </div>
            <div className="space-y-2">
              {dosGroups.filter(group => {
                if (!historyDateFilter) return true;
                const gd = group.date ? group.date.toISOString().split("T")[0] : "";
                return gd === historyDateFilter;
              }).slice(0, showAllDOSHistory ? undefined : 3).map(group => {
                const dateStr = group.date ? group.date.toLocaleDateString("en-PH", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
                const isExpanded = expandedDOS.has(group.baseId);
                return (
                  <div key={group.baseId} className="rounded-2xl border border-zinc-200 overflow-hidden bg-white">
                    <button onClick={() => toggleDOSHistory(group.baseId)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        <span className="text-[14px] font-medium text-zinc-900">{dateStr}</span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 font-mono">{group.items.length} item{group.items.length > 1 ? "s" : ""} • {group.total} pcs</span>
                      </div>
                      <span className="text-zinc-400 text-[13px]">{isExpanded ? "▾" : "▸"}</span>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-zinc-100">
                        <div className="overflow-x-auto">
                          <table className="w-full text-[13px]">
                            <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                              <tr><th className="px-4 py-2.5">Product</th><th className="px-4 py-2.5 text-right">Qty</th><th className="px-4 py-2.5">Priority</th><th className="px-4 py-2.5 text-right">Status</th></tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              {group.items.map(item => (
                                <tr key={item.id} className="hover:bg-zinc-800/60">
                                  <td className="px-4 py-2 font-medium text-zinc-900">{item.product}</td>
                                  <td className="px-4 py-2 text-right font-mono text-zinc-600">{item.qty}</td>
                                  
                                  
                                  <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.priority === "HIGH" ? "bg-red-50 text-red-700" : item.priority === "MEDIUM" ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>{item.priority}</span></td>
                                  <td className="px-4 py-2 text-right"><span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${item.status === "completed" ? "text-emerald-700" : item.status === "in-progress" ? "text-amber-700" : "text-zinc-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${item.status === "completed" ? "bg-emerald-500" : item.status === "in-progress" ? "bg-amber-500" : "bg-zinc-300"}`} />{item.status === "in-progress" ? "In Progress" : item.status === "completed" ? "Completed" : "Pending"}</span></td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-amber-50/40 text-[12px] font-medium text-zinc-700">
                                <td className="px-4 py-2">Total</td>
                                <td className="px-4 py-2 text-right font-mono">{group.total}</td>
                                <td colSpan={2} />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!showAllDOSHistory && dosGroups.filter(group => {
              if (!historyDateFilter) return true;
              const gd = group.date ? group.date.toISOString().split("T")[0] : "";
              return gd === historyDateFilter;
            }).length > 3 && (
              <button onClick={() => setShowAllDOSHistory(true)} className="w-full rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all mt-2">
                See more ({dosGroups.filter(group => {
                  if (!historyDateFilter) return true;
                  const gd = group.date ? group.date.toISOString().split("T")[0] : "";
                  return gd === historyDateFilter;
                }).length - 3} remaining)
              </button>
            )}
          </div>
        )}

        {editingDOS && <EditDOSModal item={editingDOS} onClose={() => { console.log("EditDOSModal: Closing"); setEditingDOS(null); }} onSave={(item) => { console.log("EditDOSModal: Saving:", item); onEditDOS(item); }} />}
        {scheduledAddDate && (
          <DOSBuilderModal
            onClose={() => setScheduledAddDate(null)}
            onSave={(items, tasks) => { onCreateDOS(items, tasks); setScheduledAddDate(null); }}
            productCatalog={productCatalog}
            onAddToCatalog={(name) => { onUpdateProductCatalog(prev => prev.includes(name) ? prev : [...prev, name]); db.addToCatalog(name).catch(console.error); }}
            hasTodayItems={todayDOS.length > 0}
            presetDate={scheduledAddDate}
            scheduledDates={new Set(dosItems.filter(i => i.status === "scheduled" && i.scheduledDate).map(i => i.scheduledDate!))}
          />
)}
{todayAddOpen && (
  <DOSBuilderModal
    onClose={() => setTodayAddOpen(false)}
    onSave={(items, tasks) => { onCreateDOS(items, tasks); setTodayAddOpen(false); }}
    productCatalog={productCatalog}
    onAddToCatalog={(name) => { onUpdateProductCatalog(prev => prev.includes(name) ? prev : [...prev, name]); db.addToCatalog(name).catch(console.error); }}
    hasTodayItems={todayDOS.length > 0}
            presetDate={new Date().toISOString().split("T")[0]}
            scheduledDates={new Set(dosItems.filter(i => i.status === "scheduled" && i.scheduledDate).map(i => i.scheduledDate!))}
          />
        )}
      </div>
    );
  }

  /* ── Production Tab (Enhanced) ── */
  if (activeTab === "production") {
    const todayProducts = new Set(todayDOS.map(d => d.product));
    const todayTasks = production.filter(t => todayProducts.has(t.product));
    const bakerTasks = todayTasks.filter(t => t.assignedTo === "baker");
    const pastryTasks = todayTasks.filter(t => t.assignedTo === "pastry");
    const decoTasks = todayTasks.filter(t => t.assignedTo === "deco");
    const kitchenTasks = todayTasks.filter(t => t.assignedTo === "kitchen");
    const pendingBaker = todayTasks.filter(t => t.assignedTo === "baker" && t.status === "pending");
    const pendingPastry = todayTasks.filter(t => t.assignedTo === "pastry" && t.status === "pending");
    const pendingDeco = todayTasks.filter(t => t.assignedTo === "deco" && t.status === "pending");

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3"><div><h1 className="text-[24px] font-semibold">Production Control</h1><p className="mt-1 text-[13px] text-zinc-600">Track all tasks across Baker, Pastry, Deco, and Kitchen.</p></div><div className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[11px] font-medium text-emerald-700">Live</span></div></div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3"><div className="text-[10px] text-zinc-500 uppercase tracking-wider">Total Tasks</div><div className="text-[20px] font-semibold mt-0.5">{todayTasks.length}</div></div>
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3"><div className="text-[10px] text-zinc-500 uppercase tracking-wider">In Progress</div><div className="text-[20px] font-semibold mt-0.5 text-amber-600">{todayTasks.filter(t => t.status === "in-progress").length}</div></div>
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3"><div className="text-[10px] text-zinc-500 uppercase tracking-wider">Completed</div><div className="text-[20px] font-semibold mt-0.5 text-emerald-600">{todayTasks.filter(t => t.status === "completed").length}</div></div>
        </div>

        {/* Department Lanes */}
        <div className="grid gap-4 lg:grid-cols-4">
          {[
            { tasks: bakerTasks, label: "Baker", accent: "bg-stone-600", dot: "bg-stone-500", tag: "bg-stone-100 text-stone-700", bar: "bg-stone-500" },
            { tasks: pastryTasks, label: "Pastry", accent: "bg-amber-600", dot: "bg-amber-500", tag: "bg-amber-100 text-amber-700", bar: "bg-amber-500" },
            { tasks: decoTasks, label: "Deco / Free-Mix", accent: "bg-rose-600", dot: "bg-rose-500", tag: "bg-rose-100 text-rose-700", bar: "bg-rose-500" },
            { tasks: kitchenTasks, label: "Kitchen", accent: "bg-emerald-600", dot: "bg-emerald-500", tag: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
          ].map(({ tasks, label, accent, dot, tag, bar }) => {
            const done = tasks.filter(t => t.status === "completed").length;
            const totalPct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
            return (
              <div key={label} className="rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm overflow-hidden">
                <div className={`h-1 ${accent}`} />
                <div className="px-5 pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-3 w-3 rounded-full ${dot}`} />
                      <h2 className="text-[17px] font-semibold text-zinc-900 tracking-tight">{label}</h2>
                    </div>
                    <div className={`rounded-lg ${tag} px-2.5 py-0.5`}>
                      <span className="text-[12px] font-bold font-mono">{done}<span className="text-zinc-400 font-medium">/{tasks.length}</span></span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-[#F3EFE9] mt-3">
                    <div className={`h-full rounded-full ${totalPct === 100 ? "bg-emerald-500" : bar}`} style={{ width: `${totalPct}%` }} />
                  </div>
                </div>
                {tasks.length === 0 ? (
                  <p className="text-[13px] text-zinc-400 text-center py-8">No {label.toLowerCase()} tasks yet.</p>
                ) : (
                  <div className="divide-y divide-[#F3EFE9]/60 border-t border-[#E8E0D5]/50">
                    {tasks.map(task => <CompactTaskCard key={task.id} task={task} color={bar.replace("bg-", "")} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pending Authorization */}
        {(pendingBaker.length > 0 || pendingDeco.length > 0) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-amber-200/60">
              <h2 className="text-[13px] font-semibold text-amber-900">Pending Authorization</h2>
              <p className="text-[11px] text-amber-700">{pendingBaker.length + pendingDeco.length} tasks waiting to start</p>
            </div>
            <div className="divide-y divide-amber-100/60">
              {[...pendingBaker, ...pendingDeco].map(task => (
                <div key={task.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/60 transition-all">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-medium text-zinc-900 truncate">{task.product}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium text-white ${task.assignedTo === "baker" ? "bg-stone-500" : "bg-rose-500"}`}>{task.assignedTo === "baker" ? "Baker" : "Deco"}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-zinc-500 font-mono">{task.target} pcs</span>
                    <button onClick={() => onUpdateProduction(task.id, { status: "in-progress" })} className="rounded-lg bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-zinc-800">Authorize</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Production History */}
        {(() => {
          const todayStr = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
          const prodGroups = (() => {
            const groups = new Map<string, ProductionTask[]>();
            production.forEach(task => {
              const ts = task.id.match(/PRD-(\d+)/)?.[1];
              if (!ts) return;
              const dateKey = new Date(Number(ts)).toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
              if (dateKey === todayStr) return;
              if (!groups.has(dateKey)) groups.set(dateKey, []);
              groups.get(dateKey)!.push(task);
            });
            return Array.from(groups.entries())
              .map(([date, items]) => ({ date, items, total: items.reduce((s, i) => s + i.target, 0), done: items.filter(i => i.status === "completed").length }))
              .sort((a, b) => b.date.localeCompare(a.date));
          })();

          if (prodGroups.length === 0) return null;

          const displayed = showAllProdHistory ? prodGroups : prodGroups.slice(0, 3);

          return (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[18px] font-semibold">Production History</h2>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 font-mono">{prodGroups.length} day{prodGroups.length > 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-2">
                {displayed.map(group => {
                  const isOpen = expandedProdGroups.has(group.date);
                  return (
                  <div key={group.date} className="rounded-2xl border border-zinc-200 overflow-hidden bg-white">
                    <button onClick={() => toggleProdGroup(group.date)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors text-left cursor-pointer">
                      <div className="flex items-center gap-3">
                        <span className="text-[14px] font-medium text-zinc-900">
                          {new Date(group.date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 font-mono">{group.items.length} task{group.items.length > 1 ? "s" : ""} • {group.total} pcs</span>
                        <span className="text-[11px] text-zinc-500">{group.done}/{group.items.length} done</span>
                      </div>
                      <span className="text-zinc-400 text-[13px]">{isOpen ? "▾" : "›"}</span>
                    </button>
                    {isOpen && <div className="border-t border-zinc-100">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                          <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                            <tr><th className="px-4 py-2.5">Product</th><th className="px-4 py-2.5 text-right">Target</th><th className="px-4 py-2.5 text-right">Completed</th><th className="px-4 py-2.5">Assigned To</th><th className="px-4 py-2.5 text-right">Status</th></tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {group.items.map(task => (
                              <tr key={task.id} className="hover:bg-zinc-50">
                                <td className="px-4 py-2 font-medium text-zinc-900">{task.product}</td>
                                <td className="px-4 py-2 text-right font-mono text-zinc-600">{task.target}</td>
                                <td className="px-4 py-2 text-right font-mono text-zinc-600">{task.completed}</td>
                                <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${task.assignedTo === "baker" ? "bg-stone-500" : task.assignedTo === "deco" ? "bg-rose-500" : task.assignedTo === "kitchen" ? "bg-emerald-500" : "bg-zinc-400"}`}>{task.assignedTo || "—"}</span></td>
                                <td className="px-4 py-2 text-right"><span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${task.status === "completed" ? "text-emerald-700" : task.status === "in-progress" ? "text-amber-700" : "text-zinc-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${task.status === "completed" ? "bg-emerald-500" : task.status === "in-progress" ? "bg-amber-500" : "bg-zinc-300"}`} />{task.status === "in-progress" ? "In Progress" : task.status === "completed" ? "Completed" : "Pending"}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>}
                  </div>
                );})}
                {!showAllProdHistory && prodGroups.length > 3 && (
                  <button onClick={() => setShowAllProdHistory(true)} className="w-full rounded-xl border border-dashed border-zinc-200 py-2.5 text-[12px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-all">
                    See all ({prodGroups.length} day{prodGroups.length > 1 ? "s" : ""})
                  </button>
                )}
                {showAllProdHistory && prodGroups.length > 3 && (
                  <button onClick={() => setShowAllProdHistory(false)} className="w-full rounded-xl border border-dashed border-zinc-200 py-2.5 text-[12px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-all">
                    Show less
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  /* ── Deliveries Tab (Enhanced) ── */
  if (activeTab === "deliveries") {
    const pendingValidation = deliveries.filter(d => d.status === "preparing" && !validations.some(v => v.reportId === d.id));

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div><h1 className="text-[24px] font-semibold">Delivery Control</h1><p className="mt-1 text-[13px] text-zinc-600">Validate Kitchen reports and post inventory to branches.</p></div>
          <button onClick={() => { setNewDeliveryBranch("Cakes N Styles Gensan"); setNewDeliveryCustom(""); setNewDeliveryItems([]); setNewDeliveryEta(""); setNewDeliveryAddress(""); setNewDeliveryContact(""); setNewDeliveryRider(""); setNewDeliveryPayment("unpaid"); setNewDeliveryMode("cash"); setNewDeliveryAmount(""); setNewDeliveryNotes(""); setShowAddDelivery(true); db.fetchFreezerItems().then(items => onUpdateFreezer?.(items)).catch(console.error); }} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Add Delivery</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Total Dispatches</div><div className="text-[24px] font-semibold mt-1">{deliveries.length}</div></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">In Transit</div><div className="text-[24px] font-semibold mt-1 text-amber-600">{deliveries.filter(d => d.status === "in-transit").length}</div></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Pending Validation</div><div className="text-[24px] font-semibold mt-1 text-blue-600">{pendingValidation.length}</div></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Branch Posted</div><div className="text-[24px] font-semibold mt-1 text-emerald-600">{validations.filter(v => v.status === "posted").length}</div></div>
        </div>

{/* Delivery Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {deliveries.length === 0 ? (
            <div className="sm:col-span-2 text-center py-12 rounded-[24px] border border-zinc-800 bg-zinc-900"><p className="text-[14px] text-zinc-500">No deliveries yet.</p></div>
          ) : (
            deliveries.map(d => {

              const val = validations.find(v => v.reportId === d.id);
              const statusPill = d.status === "delivered"
                ? "bg-emerald-950 text-emerald-400 border-emerald-900/50"
                : d.status === "in-transit"
                  ? "bg-amber-950 text-amber-400 border-amber-900/50"
                  : d.status === "preparing"
                    ? "bg-sky-950 text-sky-400 border-sky-900/50"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700";

              const dateLine = (() => {
                const ts = d.id.match(/DLV-(\d+)/)?.[1];
                if (!ts) return "";
                return `Date: ${new Date(Number(ts)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
              })();

return (
                <div
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View delivery ${d.id}`}
                  onClick={() => { setSelectedDelivery(d); setShowDeliveryDetail(true); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedDelivery(d);
                      setShowDeliveryDetail(true);
                    }
                  }}
                  className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-5 shadow-sm hover:border-zinc-700 transition-colors cursor-pointer"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[16px] font-semibold text-white truncate">{d.branch}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{d.id}</p>
                        {d.items.length > 0 && (
                          <span className="rounded-full border border-zinc-800 bg-zinc-800/40 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                            {d.items.reduce((s, i) => s + i.qty, 0)} pcs
                          </span>
                        )}
                      </div>
                    </div>

                    <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium ${statusPill}`}>{d.status}</span>
                  </div>

                  {/* Body: Items */}
                  <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/30 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[12px] font-medium text-zinc-400">Items</div>
                      <div className="text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{d.items.length} line{d.items.length !== 1 ? "s" : ""}</div>
                    </div>

                    <div className="space-y-2">
                      {d.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 text-[12px]">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="truncate text-zinc-200">{item.product}</span>
                            {item.source && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-medium text-white ${item.source === "baker" ? "bg-stone-700" : item.source === "deco" ? "bg-rose-800" : "bg-zinc-700"}`}
                              >
                                {item.source}
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.qty} pcs</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer: Date/ETA + actions */}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                        {dateLine ? `${dateLine}  •  ` : ""}ETA: {d.eta}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!val && d.status === "preparing" && (
                        <button
                          onClick={async () => {
                            const id = `VAL-${Date.now()}`;
                            const newVal = {
                              id,
                              reportId: d.id,
                              branch: d.branch,
                              items: [...d.items],
                              status: "validated" as const,
                              timestamp: new Date().toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
                            };
                            setValidations(prev => [...prev, newVal]);
                            await db.replaceDeliveryValidations([...validations, newVal]).catch(console.error);
                            onAddAuditLog?.("DELIVERY_VALIDATED", `${d.id} — ${d.branch} (${d.items.length} items)`);
                          }}
                          className="rounded-xl bg-white px-3.5 py-1.5 text-[11px] font-medium text-zinc-900 hover:bg-zinc-100 transition-colors shadow-sm"
                        >
                          Validate
                        </button>
                      )}

                      {val && val.status === "validated" && (
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-sky-900/40 bg-sky-950/40 px-2 py-0.5 text-[11px] font-medium text-sky-300">✓ Validated</span>
                          <button
                            onClick={async () => {
                              const updated = validations.map(v => (v.id === val.id ? { ...v, status: "posted" as const } : v));
                              setValidations(updated);
                              await db.replaceDeliveryValidations(updated).catch(console.error);
                              onAddAuditLog?.("DELIVERY_POSTED", `${val.branch} — ${val.items.length} items posted to branch inventory`);
                            }}
                            className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm"
                          >
                            Post to Branch
                          </button>
                        </div>
                      )}

                      {val && val.status === "posted" && (
                        <span className="rounded-full border border-emerald-900/50 bg-emerald-950/40 px-3 py-1 text-[11px] font-medium text-emerald-400">✓ Posted to Branch IN</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Validations Log */}
        {validations.length > 0 && (
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
            <h2 className="text-[16px] font-semibold text-white mb-4">Validation Log</h2>
            <div className="space-y-1">
              {[...validations].reverse().map(v => (
                <div key={v.id} className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] hover:bg-zinc-800/40 transition-colors">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${v.status === "posted" ? "bg-emerald-950 text-emerald-400 border border-emerald-900/50" : "bg-sky-950 text-sky-400 border border-sky-900/50"}`}>{v.status}</span>
                  <span className="font-medium text-zinc-200">{v.branch}</span>
                  <span className="text-zinc-500">{v.items.length} item{v.items.length > 1 ? "s" : ""}</span>
                  <span className="text-[11px] text-zinc-600 font-mono">{v.reportId}</span>
                  <span className="ml-auto text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{v.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Delivery Modal */}
        {showAddDelivery && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddDelivery(false)}>
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-[18px] font-semibold mb-1">Add New Delivery</h2>
              <p className="text-[13px] text-zinc-500 mb-5">Create a delivery to any destination.</p>

              {/* 1. Destination */}
              <div className="mb-4">
                <label className="text-[12px] font-medium text-zinc-700 mb-1.5 block">Destination</label>
                <select value={newDeliveryBranch} onChange={e => setNewDeliveryBranch(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400">
                  <option value="Cakes N Styles Gensan">Cakes N Styles Gensan</option>
                  <option value="Shadrach's Bake & Brew">Shadrach's Bake & Brew</option>
                  <option value="__custom__">Custom...</option>
                </select>
                {newDeliveryBranch === "__custom__" && (
                  <input autoFocus value={newDeliveryCustom} onChange={e => setNewDeliveryCustom(e.target.value)} placeholder="Enter destination name" className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400" />
                )}
              </div>

              {/* 2. Date & 3. Time */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[12px] font-medium text-zinc-700 mb-1.5 block">Date</label>
                  <input type="date" value={newDeliveryDate} onChange={e => setNewDeliveryDate(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400" />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-zinc-700 mb-1.5 block">Delivery Time (ETA)</label>
                  <input type="time" value={newDeliveryEta} onChange={e => setNewDeliveryEta(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400" />
                </div>
              </div>

              {/* 4. Delivery Details */}
              <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
                <div className="text-[12px] font-semibold text-zinc-700 mb-3">Delivery Details</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-zinc-500 mb-1 block">Delivery Address</label>
                    <input value={newDeliveryAddress} onChange={e => setNewDeliveryAddress(e.target.value)} placeholder="Full address" className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[12px] focus:outline-none focus:border-zinc-400" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-500 mb-1 block">Contact Number</label>
                    <input value={newDeliveryContact} onChange={e => setNewDeliveryContact(e.target.value)} placeholder="09XXXXXXXXX" className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[12px] focus:outline-none focus:border-zinc-400" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-500 mb-1 block">Assigned Rider</label>
                    <input value={newDeliveryRider} onChange={e => setNewDeliveryRider(e.target.value)} placeholder="Rider name" className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[12px] focus:outline-none focus:border-zinc-400" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-500 mb-1 block">Amount (₱)</label>
                    <input type="number" min={0} step="0.01" value={newDeliveryAmount} onChange={e => setNewDeliveryAmount(e.target.value)} placeholder="0.00" className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[12px] focus:outline-none focus:border-zinc-400" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-500 mb-1 block">Payment Status</label>
                    <select value={newDeliveryPayment} onChange={e => setNewDeliveryPayment(e.target.value as typeof newDeliveryPayment)} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[12px] focus:outline-none focus:border-zinc-400">
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                      <option value="half">Half</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-500 mb-1 block">Mode of Payment</label>
                    <select value={newDeliveryMode} onChange={e => setNewDeliveryMode(e.target.value as typeof newDeliveryMode)} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[12px] focus:outline-none focus:border-zinc-400">
                      <option value="cash">Cash</option>
                      <option value="check">Check</option>
                      <option value="online">Online</option>
                      <option value="bank">Bank Transfer</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-[11px] font-medium text-zinc-500 mb-1 block">Notes / Instructions</label>
                  <textarea value={newDeliveryNotes} onChange={e => setNewDeliveryNotes(e.target.value)} placeholder="Special instructions for this delivery..." rows={2} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[12px] focus:outline-none focus:border-zinc-400 resize-none" />
                </div>
              </div>

              {/* 5. Select Role to View Freezer */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12px] font-medium text-zinc-700">Select Role to View Freezer</label>
                  <button onClick={() => db.fetchFreezerItems().then(items => onUpdateFreezer?.(items)).catch(console.error)} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium">↻ Refresh</button>
                </div>

                <div className="flex items-center justify-center gap-3 mb-3">
                  {(["baker", "deco", "pastry"] as const).map(producer => {
                    const producerItems = freezerItems.filter(i => i.status === "stored" && i.producedBy === producer);
                    const producerLabel = producer === "baker" ? "Baker" : producer === "deco" ? "Deco" : "Pastry";
                    const producerIcon = producer === "baker" ? "◆" : producer === "deco" ? "◆" : "◆";
                    const isActive = expandedProducers.has(producer);
                    const selectedCount = newDeliveryItems.filter(i => producerItems.some(p => p.productName === i.product)).length;
                    return (
                      <button key={producer} onClick={() => setExpandedProducers(prev => { const n = new Set<string>(); if (!prev.has(producer)) n.add(producer); return n; })} className={`flex flex-col items-center gap-1.5 rounded-2xl px-5 py-3 text-[13px] font-medium border-2 transition-all ${isActive ? "bg-zinc-900 border-zinc-900 text-white shadow-md scale-105" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:shadow-sm"}`}>
                        <span className={`text-[18px] ${isActive ? "text-white" : "text-zinc-400"}`}>{producerIcon}</span>
                        <span>{producerLabel}</span>
                        <span className={`text-[10px] ${isActive ? "text-zinc-300" : "text-zinc-400"}`}>{producerItems.length} items</span>
                        {selectedCount > 0 && <span className="rounded-full bg-emerald-500 text-white px-1.5 py-0.5 text-[9px] font-bold">{selectedCount}</span>}
                      </button>
                    );
                  })}
                </div>

                {(["baker", "deco", "pastry"] as const).map(producer => {
                  if (!expandedProducers.has(producer)) return null;
                  const searchKey = `search_${producer}`;
                  const searchVal = deliverySearch[searchKey] || "";
                  const producerItems = freezerItems.filter(i => i.status === "stored" && i.producedBy === producer && (!searchVal || i.productName.toLowerCase().includes(searchVal.toLowerCase())));
                  const producerLabel = producer === "baker" ? "Baker" : producer === "deco" ? "Deco / Free-Mix" : "Pastry";
                  return (
                    <div key={producer} className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 mb-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[12px] font-semibold text-zinc-700">{producerLabel} Freezer</div>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-[11px]">⌕</span>
                          <input value={searchVal} onChange={e => setDeliverySearch(prev => ({ ...prev, [searchKey]: e.target.value }))} placeholder={`Search ${producerLabel.toLowerCase()}...`} className="w-[180px] rounded-lg border border-zinc-200 bg-white pl-7 pr-2 py-1.5 text-[11px] focus:outline-none focus:border-zinc-400" />
                        </div>
                      </div>
                      {producerItems.length === 0 ? (
                        <p className="text-[12px] text-zinc-400 py-2 text-center">No products found.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5">
                          {producerItems.map(item => {
                            const isSelected = newDeliveryItems.some(i => i.product === item.productName);
                            return (
                              <div key={item.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-all cursor-pointer ${isSelected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white hover:border-zinc-400"}`} onClick={() => {
                                if (isSelected) {
                                  setNewDeliveryItems(prev => prev.filter(i => i.product !== item.productName));
                                } else {
                                  const pricing = productPricing.find(p => p.productName === item.productName);
                                  const defaultPrice = newDeliveryBranch === "__custom__" ? (pricing?.wholesalePrice ?? 0) : (pricing?.sellingPrice ?? 0);
                                  setNewDeliveryItems(prev => [...prev.filter(i => i.product.trim()), { product: item.productName, qty: Math.min(item.qty, 10), price: defaultPrice }]);
                                }
                              }}>
                                <span className={`text-[12px] font-medium ${isSelected ? "text-white" : "text-zinc-900"}`}>{item.productName}</span>
                                <span className={`text-[10px] ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>{item.qty} {item.unit}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 6. Selected Items */}
              {(() => {
                const selected = newDeliveryItems.filter(i => i.product.trim());
                const grandTotal = selected.reduce((sum, item) => sum + (item.price ?? 0) * item.qty, 0);
                if (grandTotal > 0 && newDeliveryAmount !== grandTotal.toFixed(2)) {
                  queueMicrotask(() => setNewDeliveryAmount(grandTotal.toFixed(2)));
                }
                return selected.length > 0 ? (
                  <div className="mb-4">
                    <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Selected Items ({selected.length})</div>
                    <div className="space-y-1.5 max-h-[240px] overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/50 p-2">
                      {selected.map((item, idx) => {
                        const lineTotal = (item.price ?? 0) * item.qty;
                        return (
                          <div key={idx} className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-white px-3 py-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-medium text-zinc-900 truncate">{item.product}</div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-zinc-400">₱</span>
                              <input type="number" min={0} step="0.01" value={item.price ?? 0} onChange={e => { const updated = [...newDeliveryItems]; const ri = updated.findIndex(i => i.product === item.product); if (ri >= 0) updated[ri] = { ...updated[ri], price: parseFloat(e.target.value) || 0 }; setNewDeliveryItems(updated); }} className="w-20 rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-center focus:outline-none focus:border-zinc-400 bg-white" />
                              <span className="text-[10px] text-zinc-400">×</span>
                              <input type="number" min={1} value={item.qty} onChange={e => { const updated = [...newDeliveryItems]; const ri = updated.findIndex(i => i.product === item.product); if (ri >= 0) updated[ri] = { ...updated[ri], qty: parseInt(e.target.value) || 1 }; setNewDeliveryItems(updated); }} className="w-14 rounded-lg border border-zinc-200 px-2 py-1 text-[12px] text-center focus:outline-none focus:border-zinc-400 bg-white" />
                              <span className="text-[10px] text-zinc-500 font-mono w-14 text-right">₱{lineTotal.toFixed(2)}</span>
                            </div>
                            <button onClick={() => setNewDeliveryItems(prev => prev.filter(i => i.product !== item.product))} className="text-zinc-400 hover:text-red-500 text-[13px]">×</button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-2 px-1">
                      <span className="text-[11px] text-zinc-500">{newDeliveryBranch === "__custom__" ? "Wholesale" : "Selling"} pricing</span>
                      <span className="text-[15px] font-bold text-zinc-900">₱{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button onClick={() => setShowAddDelivery(false)} className="rounded-xl border border-zinc-200 px-4 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={() => {
                  const validItems = newDeliveryItems.filter(i => i.product.trim());
                  if (validItems.length === 0) return;
                  const destination = newDeliveryBranch === "__custom__" ? newDeliveryCustom.trim() : newDeliveryBranch;
                  if (!destination) return;
                  const newDelivery: Delivery = {
                    id: `DLV-${Date.now()}`,
                    branch: destination,
                    address: newDeliveryAddress.trim(),
                    contactNumber: newDeliveryContact.trim(),
                    assignedRider: newDeliveryRider.trim(),
                    items: validItems.map(i => {
                      const freezer = freezerItems.find(f => f.productName === i.product);
                      return { product: i.product, qty: i.qty, source: freezer?.producedBy || "" };
                    }),
                    status: "preparing",
                    eta: newDeliveryEta || new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true }),
                    paymentStatus: newDeliveryPayment,
                    modeOfPayment: newDeliveryMode,
                    totalAmount: newDeliveryAmount ? parseFloat(newDeliveryAmount) : 0,
                    notes: newDeliveryNotes.trim(),
                    date: newDeliveryDate,
                  };
                  const updated = [...deliveries, newDelivery];
                  onUpdateDeliveries?.(updated);
                  db.upsertDeliveries(updated).catch(console.error);
                  // Deduct from freezer, log history, remove at 0
                  const updatedFreezer = [...freezerItems];
                  const historyEntries: FreezerHistory[] = [];
                  validItems.forEach(item => {
                    const idx = updatedFreezer.findIndex(f => f.productName === item.product && f.status === "stored");
                    if (idx >= 0) {
                      const remaining = updatedFreezer[idx].qty - item.qty;
                      historyEntries.push({
                        id: `FRZH-${Date.now()}-${idx}`,
                        productName: item.product,
                        producedBy: updatedFreezer[idx].producedBy,
                        qtyChanged: -item.qty,
                        action: remaining <= 0 ? "dispatched (removed)" : "dispatched",
                        reference: newDelivery.id,
                        timestamp: new Date().toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
                      });
                      if (remaining <= 0) {
                        updatedFreezer.splice(idx, 1);
                      } else {
                        updatedFreezer[idx] = { ...updatedFreezer[idx], qty: remaining };
                      }
                    }
                  });
                  onUpdateFreezer?.(updatedFreezer);
                  db.upsertFreezerItems(updatedFreezer).catch(console.error);
                  historyEntries.forEach(h => db.insertFreezerHistory(h).catch(console.error));
                  onAddAuditLog?.("DELIVERY_ADDED", `${newDelivery.id} — ${destination} (${validItems.length} items)`);
                  setShowAddDelivery(false);
                }} className="rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">Create Delivery</button>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Detail Modal */}
        {showDeliveryDetail && selectedDelivery && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDeliveryDetail(false)}>
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[18px] font-semibold">Delivery Details</h2>
                <button onClick={() => setShowDeliveryDetail(false)} className="rounded-full p-1 hover:bg-zinc-100 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l10 10M15 5l-10 10"/></svg>
                </button>
              </div>

              {/* ID & Status */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Delivery ID</div>
                  <div className="text-[14px] font-mono text-zinc-800 mt-0.5">{selectedDelivery.id}</div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${selectedDelivery.status === "delivered" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : selectedDelivery.status === "in-transit" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-sky-50 text-sky-700 border-sky-200"}`}>
                  {selectedDelivery.status}
                </span>
              </div>

              {/* Branch & Dates */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Branch</div>
                  <div className="text-[13px] font-medium text-zinc-800 mt-0.5">{selectedDelivery.branch}</div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Delivery Date</div>
                  <div className="text-[13px] font-medium text-zinc-800 mt-0.5">{selectedDelivery.date || "—"}</div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 mb-4">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-2">Contact Information</div>
                <div className="space-y-2 text-[13px]">
                  <div className="flex justify-between"><span className="text-zinc-500">Address</span><span className="text-zinc-800 text-right ml-4">{selectedDelivery.address || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Contact</span><span className="text-zinc-800">{selectedDelivery.contactNumber || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Rider</span><span className="text-zinc-800">{selectedDelivery.assignedRider || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">ETA</span><span className="text-zinc-800">{selectedDelivery.eta || "—"}</span></div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 mb-4">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-2">Payment</div>
                <div className="space-y-3 text-[13px]">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 w-20 shrink-0">Amount</span>
                    <input type="number" min={0} step="0.01" value={selectedDelivery.totalAmount ?? 0} onChange={e => setSelectedDelivery({ ...selectedDelivery, totalAmount: parseFloat(e.target.value) || 0 })} className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] focus:outline-none focus:border-zinc-400" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 w-20 shrink-0">Status</span>
                    <select value={selectedDelivery.paymentStatus} onChange={e => setSelectedDelivery({ ...selectedDelivery, paymentStatus: e.target.value as "unpaid" | "paid" | "half" })} className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] focus:outline-none focus:border-zinc-400">
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                      <option value="half">Half</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 w-20 shrink-0">Mode</span>
                    <select value={selectedDelivery.modeOfPayment || "cash"} onChange={e => setSelectedDelivery({ ...selectedDelivery, modeOfPayment: e.target.value as "cash" | "check" | "online" | "bank" })} className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] focus:outline-none focus:border-zinc-400">
                      <option value="cash">Cash</option>
                      <option value="check">Check</option>
                      <option value="online">Online</option>
                      <option value="bank">Bank Transfer</option>
                    </select>
                  </div>
                  <button onClick={async () => {
                    const updated = deliveries.map(d => d.id === selectedDelivery.id ? selectedDelivery : d);
                    onUpdateDeliveries?.(updated);
                    await db.upsertDeliveries(updated).catch(console.error);
                    const total = selectedDelivery.totalAmount || 0;
                    const revenueAmount = selectedDelivery.paymentStatus === "paid" ? total : selectedDelivery.paymentStatus === "half" ? total / 2 : 0;
                    const existing = revenue.find(r => r.referenceId === selectedDelivery.id);
                    if (revenueAmount > 0) {
                      const revenueEntry: Revenue = existing ? {
                        ...existing,
                        amount: revenueAmount,
                        modeOfPayment: selectedDelivery.modeOfPayment || "cash",
                        date: new Date().toLocaleDateString("en-CA"),
                        remarks: `Payment ${selectedDelivery.paymentStatus} from delivery`,
                      } : {
                        id: `REV-${Date.now()}`,
                        source: "Delivery",
                        particular: `${selectedDelivery.id} — ${selectedDelivery.branch}`,
                        branch: selectedDelivery.branch,
                        amount: revenueAmount,
                        date: new Date().toLocaleDateString("en-CA"),
                        modeOfPayment: selectedDelivery.modeOfPayment || "cash",
                        referenceId: selectedDelivery.id,
                        remarks: `Payment ${selectedDelivery.paymentStatus} from delivery`,
                      };
                      onUpdateRevenue(prev => existing ? prev.map(r => r.id === existing.id ? revenueEntry : r) : [...prev, revenueEntry]);
                      await db.upsertRevenue(existing ? [revenueEntry as Revenue] : [revenueEntry]).catch(console.error);
                    } else if (existing) {
                      onUpdateRevenue(prev => prev.filter(r => r.id !== existing.id));
                      await db.deleteRevenue(existing.id).catch(console.error);
                    }
                    onAddAuditLog?.("DELIVERY_PAYMENT_UPDATED", `${selectedDelivery.id} — ${selectedDelivery.paymentStatus} — ₱${revenueAmount}`);
                  }} className="w-full rounded-lg bg-zinc-900 py-1.5 text-[12px] font-medium text-white hover:bg-zinc-800 transition-colors">
                    Save Payment
                  </button>
                </div>
              </div>

              {/* Items */}
              <div className="rounded-xl border border-zinc-200 p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Items</div>
                  <div className="text-[11px] text-zinc-400 font-mono">{selectedDelivery.items.length} line{selectedDelivery.items.length !== 1 ? "s" : ""}</div>
                </div>
                <div className="space-y-1.5">
                  {selectedDelivery.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-[13px] py-1 border-b border-zinc-100 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-800">{item.product}</span>
                        {item.source && (
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-medium text-white bg-zinc-600">{item.source}</span>
                        )}
                      </div>
                      <span className="text-zinc-500 font-mono">{item.qty} pcs</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {selectedDelivery.notes && (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 mb-4">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1">Notes</div>
                  <p className="text-[13px] text-zinc-700">{selectedDelivery.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col items-center gap-2 pt-2">
                <div className="flex items-center gap-2">
                  {selectedDelivery.status === "preparing" && (
                    <button onClick={async () => {
                      const updated = deliveries.map(d => d.id === selectedDelivery.id ? { ...d, status: "in-transit" as const } : d);
                      onUpdateDeliveries?.(updated);
                      await db.upsertDeliveries(updated).catch(console.error);
                      onAddAuditLog?.("DELIVERY_IN_TRANSIT", `${selectedDelivery.id} — ${selectedDelivery.branch}`);
                      setSelectedDelivery({ ...selectedDelivery, status: "in-transit" });
                    }} className="rounded-xl bg-amber-500 px-4 py-2 text-[13px] font-medium text-white hover:bg-amber-600 transition-colors">
                      Mark In Transit
                    </button>
                  )}
                  {selectedDelivery.status === "in-transit" && (
                    <button onClick={async () => {
                      const updated = deliveries.map(d => d.id === selectedDelivery.id ? { ...d, status: "delivered" as const } : d);
                      onUpdateDeliveries?.(updated);
                      await db.upsertDeliveries(updated).catch(console.error);
                      onAddAuditLog?.("DELIVERY_DELIVERED", `${selectedDelivery.id} — ${selectedDelivery.branch}`);
                      setSelectedDelivery({ ...selectedDelivery, status: "delivered" });
                    }} className="rounded-xl bg-emerald-500 px-4 py-2 text-[13px] font-medium text-white hover:bg-emerald-600 transition-colors">
                      Mark Delivered
                    </button>
                  )}
                </div>
                <button onClick={() => setShowDeliveryDetail(false)} className="rounded-xl border border-zinc-200 px-6 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Pricing Tab ── */
  if (activeTab === "pricing") {
    const calcEstimatedCost = (productName: string) => {
      const recipe = recipes.find(r => r.productName === productName);
      if (!recipe) return 0;
      const allItems = [...recipe.ingredients, ...recipe.packagingMaterials, ...recipe.decorationSupplies];
      return allItems.reduce((sum, ing) => {
        const inv = inventory.find(i => i.id === ing.inventoryId);
        return sum + (inv ? inv.cost * ing.qtyPerBatch : 0);
      }, 0);
    };

    const catalogWithRecipes = productCatalog.map(name => {
      const existing = productPricing.find(p => p.productName === name);
      const cost = calcEstimatedCost(name);
      if (existing) return { ...existing, estimatedCost: cost };
      return {
        id: `PRC-${name.replace(/\s+/g, "-").toLowerCase()}`,
        productName: name,
        category: recipes.find(r => r.productName === name) ? "Bakery" : "",
        estimatedCost: cost,
        sellingPrice: 0,
        wholesalePrice: 0,
        profitMargin: 0,
        status: "draft" as const,
        variants: [],
      };
    });

    const allPricing = catalogWithRecipes;
    const filtered = allPricing.filter(p => {
      if (pricingFilter !== "all" && p.status !== pricingFilter) return false;
      if (pricingSearch && !p.productName.toLowerCase().includes(pricingSearch.toLowerCase())) return false;
      return true;
    });

    const totalProducts = allPricing.length;
    const activeProducts = allPricing.filter(p => p.status === "active").length;
    const avgMargin = allPricing.filter(p => p.sellingPrice > 0).reduce((s, p) => s + p.profitMargin, 0) / (allPricing.filter(p => p.sellingPrice > 0).length || 1);

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div><h1 className="text-[24px] font-semibold">Product Pricing</h1><p className="mt-1 text-[13px] text-zinc-600">Set selling prices, wholesale rates, and manage product variants.</p></div>
          <button onClick={() => { setEditingPricing({ id: `PRC-${Date.now()}`, productName: "", category: "", estimatedCost: 0, sellingPrice: 0, wholesalePrice: 0, profitMargin: 0, status: "draft", variants: [] }); setShowPricingModal(true); }} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Add Product</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Total Products</div><div className="text-[24px] font-semibold mt-1">{totalProducts}</div></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Active</div><div className="text-[24px] font-semibold mt-1 text-emerald-600">{activeProducts}</div></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Drafts</div><div className="text-[24px] font-semibold mt-1 text-amber-600">{allPricing.filter(p => p.status === "draft").length}</div></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Avg Margin</div><div className="text-[24px] font-semibold mt-1 text-blue-600">{avgMargin.toFixed(1)}%</div></div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px]">⌕</span>
            <input value={pricingSearch} onChange={e => setPricingSearch(e.target.value)} placeholder="Search products..." className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-2.5 text-[13px] focus:outline-none focus:border-zinc-400" />
          </div>
          <div className="flex gap-1.5">
            {(["all", "active", "draft", "archived"] as const).map(f => (
              <button key={f} onClick={() => setPricingFilter(f)} className={`rounded-lg px-3 py-2 text-[12px] font-medium transition-all ${pricingFilter === f ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
            ))}
          </div>
        </div>

        {/* Pricing Table */}
        <div className="rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr className="text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3 text-right">Est. Cost</th>
                  <th className="px-5 py-3 text-right">Selling Price</th>
                  <th className="px-5 py-3 text-right">Wholesale</th>
                  <th className="px-5 py-3 text-right">Margin</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-zinc-400">No products found.</td></tr>
                ) : filtered.map(p => {
                  const margin = p.sellingPrice > 0 ? ((p.sellingPrice - p.estimatedCost) / p.sellingPrice * 100) : 0;
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="text-[13px] font-medium text-zinc-900">{p.productName}</div>
                        {p.variants.length > 0 && <div className="text-[11px] text-zinc-400 mt-0.5">{p.variants.length} variant{p.variants.length > 1 ? "s" : ""}</div>}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-zinc-600">{p.category || "—"}</td>
                      <td className="px-5 py-3.5 text-[13px] text-zinc-700 text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>₱{p.estimatedCost.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-[13px] font-medium text-zinc-900 text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{p.sellingPrice > 0 ? `₱${p.sellingPrice.toFixed(2)}` : "—"}</td>
                      <td className="px-5 py-3.5 text-[13px] text-zinc-700 text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{p.wholesalePrice > 0 ? `₱${p.wholesalePrice.toFixed(2)}` : "—"}</td>
                      <td className="px-5 py-3.5 text-right">
                        {p.sellingPrice > 0 ? (
                          <span className={`text-[12px] font-medium ${margin >= 30 ? "text-emerald-600" : margin >= 15 ? "text-amber-600" : "text-red-500"}`}>{margin.toFixed(1)}%</span>
                        ) : <span className="text-[12px] text-zinc-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium uppercase border ${p.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : p.status === "draft" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-zinc-100 text-zinc-500 border-zinc-200"}`}>{p.status}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => { setEditingPricing(p); setShowPricingModal(true); }} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 transition-all">Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pricing Modal */}
        {showPricingModal && editingPricing && (
          <PricingModal
            item={editingPricing}
            recipes={recipes}
            inventory={inventory}
            productCatalog={productCatalog}
            onSave={(updated) => {
              const exists = productPricing.find(p => p.id === updated.id);
              const next = exists ? productPricing.map(p => p.id === updated.id ? updated : p) : [...productPricing, updated];
              onUpdateProductPricing(next);
              db.upsertProductPricing(next).catch(console.error);
              if (!exists && updated.productName && !productCatalog.includes(updated.productName)) {
                onUpdateProductCatalog(prev => [...prev, updated.productName]);
                db.addToCatalog(updated.productName).catch(console.error);
              }
              onAddAuditLog?.("PRICING_UPDATED", `${updated.productName} — ₱${updated.sellingPrice.toFixed(2)} selling, ₱${updated.wholesalePrice.toFixed(2)} wholesale`);
              setShowPricingModal(false);
            }}
            onDelete={(id) => {
              const next = productPricing.filter(p => p.id !== id);
              onUpdateProductPricing(next);
              db.deleteProductPricing(id).catch(console.error);
              setShowPricingModal(false);
            }}
            onClose={() => setShowPricingModal(false)}
          />
        )}
      </div>
    );
  }

  if (activeTab === "finance") {
    const inPeriod = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr + (dateStr.length === 10 ? "T00:00:00" : ""));
      const now = new Date();
      const pht = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      const startOfWeek = new Date(pht); startOfWeek.setDate(pht.getDate() - pht.getDay());
      const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
      switch (financePeriod) {
        case "today": return d.toDateString() === pht.toDateString();
        case "week": return d >= startOfWeek && d <= endOfWeek;
        case "month": return d.getMonth() === pht.getMonth() && d.getFullYear() === pht.getFullYear();
        case "year": return d.getFullYear() === pht.getFullYear();
        case "custom": {
          const [y, m] = financeCustomMonth.split("-").map(Number);
          return d.getFullYear() === y && d.getMonth() === m - 1;
        }
        default: return true;
      }
    };
    const periodLabel = ({ today: "Today", week: "This Week", month: "This Month", year: "This Year", custom: financeCustomMonth } as const)[financePeriod];

    const periodPurchases = purchases.filter(p => inPeriod(p.dateDelivered));
    const periodBills = billsAndDues.filter(b => inPeriod(b.dueDate));
    const periodRevenue = revenue.filter(r => inPeriod(r.date));
    const periodWaste = wasteLog.filter(w => inPeriod(w.date));
    const totalPurchases = periodPurchases.reduce((s, p) => s + p.amount, 0);
    const unpaidPurchases = periodPurchases.filter(p => p.paymentStatus === "unpaid" || p.paymentStatus === "overdue");
    const totalBills = periodBills.reduce((s, b) => s + b.amount, 0);
    const pendingBills = periodBills.filter(b => b.status === "pending" || b.status === "overdue");
    const totalRevenue = periodRevenue.reduce((s, r) => s + r.amount, 0);
    const totalWaste = periodWaste.reduce((s, w) => s + w.totalCost, 0);

    const filteredPurchases = purchases.filter(p => inPeriod(p.dateDelivered) && (p.particular.toLowerCase().includes(financeSearch.toLowerCase()) || p.supplierName.toLowerCase().includes(financeSearch.toLowerCase())));
    const filteredBills = billsAndDues.filter(b => inPeriod(b.dueDate) && b.particular.toLowerCase().includes(financeSearch.toLowerCase()));
    const filteredRevenue = revenue.filter(r => inPeriod(r.date) && r.particular.toLowerCase().includes(financeSearch.toLowerCase()));
    const filteredWaste = wasteLog.filter(w => inPeriod(w.date) && (w.product.toLowerCase().includes(financeSearch.toLowerCase()) || w.reason.toLowerCase().includes(financeSearch.toLowerCase())));

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div><h1 className="text-[24px] font-semibold">Finance</h1><p className="mt-1 text-[13px] text-zinc-600">Track purchases, bills, revenue, and waste across all operations.</p></div>
          <div className="relative">
            <input type="text" placeholder="Search..." value={financeSearch} onChange={e => setFinanceSearch(e.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 pl-9 text-[13px] outline-none focus:border-zinc-400 w-64" />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>

        {/* Period Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {(["today", "week", "month", "year", "custom"] as const).map(p => (
            <button key={p} onClick={() => setFinancePeriod(p)} className={`rounded-xl px-3.5 py-2 text-[12px] font-medium transition-all ${financePeriod === p ? "bg-zinc-900 text-white shadow-sm" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
              {p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : p === "year" ? "This Year" : "Custom"}
            </button>
          ))}
          {financePeriod === "custom" && (
            <input type="month" value={financeCustomMonth} onChange={e => setFinanceCustomMonth(e.target.value)} className="rounded-xl border border-zinc-200 px-3 py-2 text-[12px] outline-none focus:border-zinc-400" />
          )}
          <span className="text-[11px] text-zinc-400 ml-1 font-mono">{periodLabel}</span>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Purchases</div>
            <div className="text-[24px] font-semibold mt-1">₱{totalPurchases.toLocaleString()}</div>
            <div className="text-[11px] text-zinc-400 mt-1">{unpaidPurchases.length} unpaid/overdue</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Bills &amp; Dues</div>
            <div className="text-[24px] font-semibold mt-1">₱{totalBills.toLocaleString()}</div>
            <div className="text-[11px] text-zinc-400 mt-1">{pendingBills.length} pending/overdue</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Revenue</div>
            <div className="text-[24px] font-semibold mt-1 text-emerald-600">₱{totalRevenue.toLocaleString()}</div>
            <div className="text-[11px] text-zinc-400 mt-1">{periodRevenue.length} entries</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Waste Cost</div>
            <div className="text-[24px] font-semibold mt-1 text-red-600">₱{totalWaste.toLocaleString()}</div>
            <div className="text-[11px] text-zinc-400 mt-1">{periodWaste.length} entries</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 border-b border-zinc-200">
          {[
            { id: "purchases", label: "Purchases", count: purchases.length },
            { id: "bills", label: "Bills & Dues", count: billsAndDues.length },
            { id: "revenue", label: "Revenue", count: revenue.length },
            { id: "analytics", label: "Sales Analytics", count: null },
            { id: "waste", label: "Waste Log", count: wasteLog.length },
          ].map(tab => (
            <button key={tab.id} onClick={() => { setFinanceTab(tab.id as any); setFinanceSearch(""); }} className={
              "px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all " +
              (financeTab === tab.id ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700")
            }>{tab.label} {tab.count !== null ? <span className="text-[11px] text-zinc-400">({tab.count})</span> : ""}</button>
          ))}
        </div>

        {/* Tab Content */}
        {financeTab === "purchases" && (
          <div className="space-y-4">
             {/* Purchases Tab Content */}
          </div>
        )}
        {financeTab === "bills" && (
          <div className="space-y-4">
             {/* Bills Tab Content */}
          </div>
        )}
        {financeTab === "revenue" && (
          <div className="space-y-4">
             {/* Revenue Tab Content */}
          </div>
        )}
        {financeTab === "analytics" && (
          <div className="space-y-6">
             {/* Analytics Tab Content */}
          </div>
        )}
        {financeTab === "waste" && (
          <div className="space-y-4">
             {/* Waste Log Tab Content */}
          </div>
        )}

        {/* Purchases Tab */}
        {financeTab === "purchases" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => { setEditingPurchase({ id: "PUR-" + Date.now(), supplierName: "", modeOfPayment: "cash", dateDelivered: new Date().toISOString().slice(0,10), particular: "", amount: 0, dueDate: "", releasedDate: "", paymentStatus: "unpaid", remarks: "" }); setShowAddPurchase(true); }} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Add Purchase</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                  <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Particular</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Due</th><th className="px-4 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-700 text-[13px]">
                  {filteredPurchases.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-zinc-400">No purchases found.</td></tr>
                  ) : filteredPurchases.map(item => (
                    <tr key={item.id} className="hover:bg-zinc-800/60">
                      <td className="px-4 py-3 text-zinc-600 text-[12px]">{item.dateDelivered}</td>
                      <td className="px-4 py-3"><div className="font-medium">{item.supplierName}</div></td>
                      <td className="px-4 py-3 text-zinc-600">{item.particular}</td>
                      <td className="px-4 py-3 text-right font-medium" style={{ fontFamily: "Fragment Mono, monospace" }}>₱{item.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={"inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium " + (item.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" : item.paymentStatus === "overdue" ? "bg-red-100 text-red-700" : item.paymentStatus === "partial" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600")}>{item.paymentStatus}</span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-zinc-500">{item.dueDate || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => { setEditingPurchase(item); setShowAddPurchase(true); }} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all mr-1">Edit</button>
                        <button onClick={() => { if (confirm("Delete this purchase?")) { onUpdatePurchases(prev => prev.filter(p => p.id !== item.id)); db.deletePurchase(item.id).catch(console.error); } }} className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-all">Delete</button>
                      </td>
                    </tr>
                  ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-300 bg-zinc-50">
                      <td colSpan={3} className="px-4 py-3 text-[12px] font-semibold text-zinc-700 uppercase tracking-wider">Total</td>
                      <td className="px-4 py-3 text-right font-semibold font-mono text-zinc-900">₱{filteredPurchases.reduce((s, p) => s + p.amount, 0).toLocaleString()}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                  </table>
                  </div>
                  </div>
                  )}

                  {/* Waste Log Tab */}
        {financeTab === "bills" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => { setEditingBill({ id: "BILL-" + Date.now(), dueDate: "", particular: "", amount: 0, modeOfPayment: "cash", remarks: "", status: "pending", category: "utilities", branch: "" }); setShowAddBill(true); }} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Add Bill</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                  <tr><th className="px-4 py-3">Due Date</th><th className="px-4 py-3">Particular</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-700 text-[13px]">
                  {filteredBills.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-zinc-400">No bills found.</td></tr>
                  ) : filteredBills.map(item => (
                    <tr key={item.id} className="hover:bg-zinc-800/60">
                      <td className="px-4 py-3 text-[12px] text-zinc-600">{item.dueDate}</td>
                      <td className="px-4 py-3"><div className="font-medium">{item.particular}</div></td>
                      <td className="px-4 py-3"><span className="text-[12px] text-zinc-500 capitalize">{item.category.replace('_', ' ')}</span></td>
                      <td className="px-4 py-3 text-[12px] text-zinc-500">{item.branch || "—"}</td>
                      <td className="px-4 py-3 text-right font-medium" style={{ fontFamily: "Fragment Mono, monospace" }}>₱{item.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={"inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium " + (item.status === "paid" ? "bg-emerald-100 text-emerald-700" : item.status === "overdue" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>{item.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => { setEditingBill(item); setShowAddBill(true); }} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all mr-1">Edit</button>
                        <button onClick={() => { if (confirm("Delete this bill?")) { onUpdateBillsAndDues(prev => prev.filter(b => b.id !== item.id)); db.deleteBillDue(item.id).catch(console.error); } }} className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-all">Delete</button>
                      </td>
                    </tr>
                  ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-300 bg-zinc-50">
                      <td colSpan={4} className="px-4 py-3 text-[12px] font-semibold text-zinc-700 uppercase tracking-wider">Total</td>
                      <td className="px-4 py-3 text-right font-semibold font-mono text-zinc-900">₱{filteredBills.reduce((s, b) => s + b.amount, 0).toLocaleString()}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                  </table>
                  </div>
                  </div>
                  )}

                  {/* Waste Log Tab */}
        {financeTab === "analytics" && (
          <div className="space-y-6">
            <h2 className="text-[18px] font-bold text-zinc-900 border-b border-zinc-200 pb-2">Sales Analytics</h2>
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2 min-h-[300px]">
                <h3 className="mb-4 text-[14px] font-semibold text-zinc-900">Revenue Trends</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredRevenue.map(r => ({ date: r.date, amount: r.amount }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                      <XAxis dataKey="date" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm min-h-[300px]">
                <h3 className="mb-4 text-[14px] font-semibold text-zinc-900">Source Breakdown</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={Object.entries(filteredRevenue.reduce((acc, r) => ({ ...acc, [r.source]: (acc[r.source] || 0) + r.amount }), {} as Record<string, number>)).map(([source, amount]) => ({ source, amount }))} dataKey="amount" nameKey="source" cx="50%" cy="50%" outerRadius={80} label>
                        {Object.entries(filteredRevenue.reduce((acc, r) => ({ ...acc, [r.source]: (acc[r.source] || 0) + r.amount }), {} as Record<string, number>)).map((_, index) => <Cell key={`cell-${index}`} fill={['#10b981', '#f59e0b', '#3b82f6'][index % 3]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend fontSize={10} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-3 min-h-[300px]">
                <h3 className="mb-4 text-[14px] font-semibold text-zinc-900">Daily Revenue</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredRevenue.map(r => ({ date: r.date, amount: r.amount }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                      <XAxis dataKey="date" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Revenue Tab */}
        {financeTab === "revenue" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => { setEditingRevenue({ id: "REV-" + Date.now(), source: "manual", particular: "", branch: "", amount: 0, date: new Date().toISOString().slice(0,10), modeOfPayment: "cash", referenceId: "", remarks: "" }); setShowAddRevenue(true); }} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Add Revenue</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                  <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Particular</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-700 text-[13px]">
                  {filteredRevenue.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-zinc-400">No revenue entries found.</td></tr>
                  ) : filteredRevenue.map(item => (
                    <tr key={item.id} className="hover:bg-zinc-800/60">
                      <td className="px-4 py-3 text-[12px] text-zinc-600">{item.date}</td>
                      <td className="px-4 py-3"><div className="font-medium">{item.particular}</div></td>
                      <td className="px-4 py-3"><span className="text-[12px] text-zinc-500 capitalize">{item.source.replace('_', ' ')}</span></td>
                      <td className="px-4 py-3 text-[12px] text-zinc-500">{item.branch || "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600" style={{ fontFamily: "Fragment Mono, monospace" }}>₱{item.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 capitalize">{item.modeOfPayment}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => { setEditingRevenue(item); setShowAddRevenue(true); }} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all mr-1">Edit</button>
                        <button onClick={() => { if (confirm("Delete this revenue entry?")) { onUpdateRevenue(prev => prev.filter(r => r.id !== item.id)); } }} className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-all">Delete</button>
                      </td>
                    </tr>
                  ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-300 bg-zinc-50">
                      <td colSpan={4} className="px-4 py-3 text-[12px] font-semibold text-zinc-700 uppercase tracking-wider">Total</td>
                      <td className="px-4 py-3 text-right font-semibold font-mono text-emerald-600">₱{filteredRevenue.reduce((s, r) => s + r.amount, 0).toLocaleString()}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

                    {/* Waste Log Tab */}
        {financeTab === "waste" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => { setEditingWaste({ id: "WST-" + Date.now(), product: "", qtyRejected: 0, unitCost: 0, totalCost: 0, reason: "", source: "", referenceId: "", date: new Date().toISOString().slice(0,10) }); setShowAddWaste(true); }} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Log Waste</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                  <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Unit Cost</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Source</th><th className="px-4 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-700 text-[13px]">
                  {filteredWaste.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-[13px] text-zinc-400">No waste entries found.</td></tr>
                  ) : filteredWaste.map(item => (
                    <tr key={item.id} className="hover:bg-zinc-800/60">
                      <td className="px-4 py-3 text-[12px] text-zinc-600">{item.date}</td>
                      <td className="px-4 py-3"><div className="font-medium">{item.product}</div></td>
                      <td className="px-4 py-3 text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.qtyRejected}</td>
                      <td className="px-4 py-3 text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>₱{item.unitCost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-600" style={{ fontFamily: "Fragment Mono, monospace" }}>₱{item.totalCost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-[12px] text-zinc-500 max-w-[200px] truncate">{item.reason}</td>
                      <td className="px-4 py-3 text-[12px] text-zinc-500">{item.source}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => { setEditingWaste(item); setShowAddWaste(true); }} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all mr-1">Edit</button>
                        <button onClick={() => { if (confirm("Delete this waste entry?")) { onUpdateWasteLog(prev => prev.filter(w => w.id !== item.id)); } }} className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-all">Delete</button>
                      </td>
                    </tr>
                  ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-300 bg-zinc-50">
                      <td colSpan={4} className="px-4 py-3 text-[12px] font-semibold text-zinc-700 uppercase tracking-wider">Total</td>
                      <td className="px-4 py-3 text-right font-semibold font-mono text-red-600">₱{filteredWaste.reduce((s, w) => s + w.totalCost, 0).toLocaleString()}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Purchase Modal */}
        {showAddPurchase && editingPurchase && (
          <Modal title={purchases.find(p => p.id === editingPurchase.id) ? "Edit Purchase" : "Add Purchase"} onClose={() => setShowAddPurchase(false)}>
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Supplier</label><input value={editingPurchase.supplierName} onChange={e => setEditingPurchase({...editingPurchase, supplierName: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" placeholder="Supplier name" /></div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Amount</label><input type="number" value={editingPurchase.amount || ""} onChange={e => setEditingPurchase({...editingPurchase, amount: Number(e.target.value)})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" placeholder="0" /></div>
              </div>
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Particular</label><input value={editingPurchase.particular} onChange={e => setEditingPurchase({...editingPurchase, particular: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" placeholder="What was purchased?" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Date Delivered</label><input type="date" value={editingPurchase.dateDelivered} onChange={e => setEditingPurchase({...editingPurchase, dateDelivered: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Due Date</label><input type="date" value={editingPurchase.dueDate} onChange={e => setEditingPurchase({...editingPurchase, dueDate: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Payment Mode</label>
                  <select value={editingPurchase.modeOfPayment} onChange={e => setEditingPurchase({...editingPurchase, modeOfPayment: e.target.value as any})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1">
                    <option value="cash">Cash</option><option value="online">Online</option><option value="check">Check</option>
                  </select>
                </div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Payment Status</label>
                  <select value={editingPurchase.paymentStatus} onChange={e => setEditingPurchase({...editingPurchase, paymentStatus: e.target.value as any})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1">
                    <option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Released Date</label><input type="date" value={editingPurchase.releasedDate} onChange={e => setEditingPurchase({...editingPurchase, releasedDate: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              </div>
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Remarks</label><input value={editingPurchase.remarks} onChange={e => setEditingPurchase({...editingPurchase, remarks: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowAddPurchase(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={() => { onUpdatePurchases(prev => { const idx = prev.findIndex(p => p.id === editingPurchase.id); if (idx >= 0) { const next = [...prev]; next[idx] = editingPurchase; return next; } return [...prev, editingPurchase]; }); db.upsertPurchases([editingPurchase]).catch(console.error); setShowAddPurchase(false); }} className="rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">Save</button>
              </div>
            </div>
          </Modal>
        )}

        {/* Bill Modal */}
        {showAddBill && editingBill && (
          <Modal title={billsAndDues.find(b => b.id === editingBill.id) ? "Edit Bill" : "Add Bill"} onClose={() => setShowAddBill(false)}>
            <div className="space-y-3 p-4">
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Particular</label><input value={editingBill.particular} onChange={e => setEditingBill({...editingBill, particular: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Amount</label><input type="number" value={editingBill.amount || ""} onChange={e => setEditingBill({...editingBill, amount: Number(e.target.value)})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" placeholder="0" /></div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Due Date</label><input type="date" value={editingBill.dueDate} onChange={e => setEditingBill({...editingBill, dueDate: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Category</label>
                  <select value={editingBill.category} onChange={e => setEditingBill({...editingBill, category: e.target.value as any})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1">
                    <option value="utilities">Utilities</option><option value="rent">Rent</option><option value="internet">Internet</option><option value="payroll">Payroll</option><option value="maintenance">Maintenance</option><option value="supplier_dues">Supplier Dues</option><option value="miscellaneous">Miscellaneous</option>
                  </select>
                </div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Status</label>
                  <select value={editingBill.status} onChange={e => setEditingBill({...editingBill, status: e.target.value as any})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1">
                    <option value="pending">Pending</option><option value="paid">Paid</option><option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Branch</label><input value={editingBill.branch} onChange={e => setEditingBill({...editingBill, branch: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Remarks</label><input value={editingBill.remarks} onChange={e => setEditingBill({...editingBill, remarks: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowAddBill(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={() => { onUpdateBillsAndDues(prev => { const idx = prev.findIndex(b => b.id === editingBill.id); if (idx >= 0) { const next = [...prev]; next[idx] = editingBill; return next; } return [...prev, editingBill]; }); db.upsertBillsAndDues([editingBill]).catch(console.error); setShowAddBill(false); }} className="rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">Save</button>
              </div>
            </div>
          </Modal>
        )}

        {/* Revenue Modal */}
        {showAddRevenue && editingRevenue && (
          <Modal title={revenue.find(r => r.id === editingRevenue.id) ? "Edit Revenue" : "Add Revenue"} onClose={() => setShowAddRevenue(false)}>
            <div className="space-y-3 p-4">
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Particular</label><input value={editingRevenue.particular} onChange={e => setEditingRevenue({...editingRevenue, particular: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Amount</label><input type="number" value={editingRevenue.amount || ""} onChange={e => setEditingRevenue({...editingRevenue, amount: Number(e.target.value)})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" placeholder="0" /></div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Date</label><input type="date" value={editingRevenue.date} onChange={e => setEditingRevenue({...editingRevenue, date: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Source</label>
                  <select value={editingRevenue.source} onChange={e => setEditingRevenue({...editingRevenue, source: e.target.value as any})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1">
                    <option value="delivery">Delivery</option><option value="manual">Manual</option><option value="branch_sales">Branch Sales</option>
                  </select>
                </div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Payment Mode</label>
                  <select value={editingRevenue.modeOfPayment} onChange={e => setEditingRevenue({...editingRevenue, modeOfPayment: e.target.value as any})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1">
                    <option value="cash">Cash</option><option value="online">Online</option><option value="check">Check</option>
                  </select>
                </div>
              </div>
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Branch</label><input value={editingRevenue.branch} onChange={e => setEditingRevenue({...editingRevenue, branch: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Remarks</label><input value={editingRevenue.remarks} onChange={e => setEditingRevenue({...editingRevenue, remarks: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowAddRevenue(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={() => { onUpdateRevenue(prev => { const idx = prev.findIndex(r => r.id === editingRevenue.id); if (idx >= 0) { const next = [...prev]; next[idx] = editingRevenue; return next; } return [...prev, editingRevenue]; }); db.upsertRevenue([editingRevenue]).catch(console.error); setShowAddRevenue(false); }} className="rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">Save</button>
              </div>
            </div>
          </Modal>
        )}

        {/* Waste Log Modal */}
        {showAddWaste && editingWaste && (
          <Modal title={wasteLog.find(w => w.id === editingWaste.id) ? "Edit Waste Entry" : "Log Waste"} onClose={() => setShowAddWaste(false)}>
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Product</label><input value={editingWaste.product} onChange={e => setEditingWaste({...editingWaste, product: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Qty Rejected</label><input type="number" value={editingWaste.qtyRejected || ""} onChange={e => setEditingWaste({...editingWaste, qtyRejected: Number(e.target.value)})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" placeholder="0" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Unit Cost</label><input type="number" value={editingWaste.unitCost || ""} onChange={e => { const c = Number(e.target.value); setEditingWaste({...editingWaste, unitCost: c, totalCost: c * editingWaste.qtyRejected}); }} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" placeholder="0" /></div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Total Cost</label><div className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] mt-1 bg-zinc-50">₱{editingWaste.totalCost.toLocaleString()}</div></div>
              </div>
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Reason</label><input value={editingWaste.reason} onChange={e => setEditingWaste({...editingWaste, reason: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" placeholder="Why was this wasted?" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Source</label><input value={editingWaste.source} onChange={e => setEditingWaste({...editingWaste, source: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Date</label><input type="date" value={editingWaste.date} onChange={e => setEditingWaste({...editingWaste, date: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowAddWaste(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={() => { onUpdateWasteLog(prev => { const idx = prev.findIndex(w => w.id === editingWaste.id); if (idx >= 0) { const next = [...prev]; next[idx] = editingWaste; return next; } return [...prev, editingWaste]; }); db.upsertWasteLog([editingWaste]).catch(console.error); setShowAddWaste(false); }} className="rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">Save</button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  /* ── Default: Admin Dashboard ── */

  function handleExport() {
    const rows: string[][] = [];

    rows.push(["BAKEFLOW ERP — FULL EXPORT", "", "", ""]);
    rows.push([`Generated: ${new Date().toLocaleString('en-PH')}`, "", "", ""]);
    rows.push([]);

    rows.push(["=== INVENTORY ===", "", "", ""]);
    rows.push(["ID", "Name", "SKU", "On Hand", "Threshold", "Unit", "Cost", "Supplier", "Category", "Group"]);
    inventory.forEach(i => rows.push([i.id, i.name, i.sku, String(i.onHand), String(i.threshold), i.unit, String(i.cost), i.supplier, i.category, i.group]));
    rows.push([]);

    rows.push(["=== DOS ITEMS ===", "", "", ""]);
rows.push(["ID", "Product", "Qty", "Priority", "Status"]);
dosItems.forEach(d => rows.push([d.id, d.product, String(d.qty), d.priority, d.status]));
    rows.push([]);

    rows.push(["=== PRODUCTION ===", "", "", ""]);
    rows.push(["ID", "Product", "Target", "Completed", "Assigned To", "Status"]);
    production.forEach(p => rows.push([p.id, p.product, String(p.target), String(p.completed), p.assignedTo, p.status]));
    rows.push([]);

    rows.push(["=== DELIVERIES ===", "", "", ""]);
    rows.push(["ID", "Branch", "Status", "ETA", "Items"]);
    deliveries.forEach(d => rows.push([d.id, d.branch, d.status, d.eta, d.items.map(i => `${i.product}(${i.qty})`).join(", ")]));

    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;header=present" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bakeflow-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[28px] font-semibold tracking-tight text-zinc-900" style={{ fontFamily: "Instrument Sans, system-ui" }}>Admin Dashboard</h1><p className="mt-1 text-[13px] text-zinc-600">Real-time bakery ERP • Single source of truth</p></div>
        <div className="flex items-center gap-2">
          <button onClick={onOpenDOSBuilder} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800">+ New DOS</button>
          <button onClick={handleExport} className="rounded-xl border border-[#E8E0D5] bg-white px-3.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50">Export</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(() => {
          const criticalItem = inventory.filter(i => i.onHand < i.threshold).sort((a, b) => (a.onHand / a.threshold) - (b.onHand / b.threshold))[0];
          const delivered = deliveries.filter(d => d.status === "delivered").length;
          const onTimePct = deliveries.length > 0 ? Math.round((delivered / deliveries.length) * 100) : 0;
          return [
            { label: "Production Rate", value: `${kpis.productionRate}%`, sub: `${production.filter(p => p.status === "completed").length} of ${production.length} tasks done`, trend: `${kpis.productionRate}%` },
            { label: "Inventory Value", value: `₱${(kpis.inventoryValue / 1000).toFixed(1)}k`, sub: `${inventory.length} SKUs tracked`, trend: `${kpis.lowStockCount > 0 ? kpis.lowStockCount + " below threshold" : "All healthy"}` },
            { label: "Low Stock Alerts", value: kpis.lowStockCount.toString(), sub: criticalItem ? `${criticalItem.name} (${criticalItem.onHand}/${criticalItem.threshold})` : "All stocked", trend: "!", tone: kpis.lowStockCount > 0 ? "red" : undefined },
            { label: "Active Deliveries", value: kpis.activeDeliveries.toString(), sub: `${[...new Set(deliveries.map(d => d.branch))].length} branches`, trend: onTimePct > 0 ? `${onTimePct}% on-time` : "No data" },
          ];
        })().map((kpi) => (
          <div key={kpi.label} className="group relative overflow-hidden rounded-[20px] border border-[#E8E0D5] bg-white p-4 shadow-sm">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `radial-gradient(#000 1px, transparent 1px)`, backgroundSize: "16px 16px" }} />
            <div className="relative">
              <div className="flex items-start justify-between">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{kpi.label}</div>
                <div className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${kpi.tone === "red" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{kpi.trend}</div>
              </div>
              <div className="mt-2 text-[26px] font-semibold tracking-tight text-zinc-900">{kpi.value}</div>
              <div className="text-[12px] text-zinc-500">{kpi.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Today's DOS */}
      <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div><h2 className="text-[16px] font-semibold text-white" style={{ fontFamily: "Instrument Sans, system-ui" }}>Today's DOS • {new Date().toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" })}</h2><p className="text-[12px] text-zinc-400">Daily Order Sales — auto-generates production tasks</p></div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-amber-500 border border-amber-900/50">LOCKED</span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-900">{todayDOS.length} items</span>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-800">
          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              <div className="grid grid-cols-12 gap-2 border-b border-zinc-800 bg-zinc-950/50 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                <div className="col-span-4">Product</div><div className="col-span-2 text-right">Qty</div><div className="col-span-2 text-center">Assigned</div><div className="col-span-2 text-right">Pri</div><div className="col-span-2 text-right">Status</div>
              </div>
              <div className="divide-y divide-zinc-800">
                {todayDOS.map(item => {
                  // Enhanced matching: link by unique ID suffix OR by product name (fallback for older entries)
                  const itemSuffix = item.id.split('-').pop(); // e.g. "0"
                  const itemTimestamp = item.id.split('-')[1]; // e.g. "1780388834830"
                  const relatedTasks = production.filter(t => 
                    (t.id.includes(itemTimestamp) && t.id.split('-').includes(itemSuffix)) ||
                    (t.product === item.product && t.id.includes(itemTimestamp))
                  );
                  const roles = relatedTasks.length > 0 ? [...new Set(relatedTasks.map(t => t.assignedTo))] : (item.roles || []);
                  return (
                    <div key={item.id} className="grid grid-cols-12 items-center gap-2 px-3 py-3 hover:bg-zinc-800/40 transition-colors">
                      <div className="col-span-4"><div className="text-[13px] font-medium text-white truncate">{item.product}</div><div className="text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.id}</div></div>
                      <div className="col-span-2 text-right text-[13px] font-medium text-white font-mono">{item.qty}</div>
                      
                      
                      <div className="col-span-2 flex justify-center gap-1 flex-wrap">{roles.map(r => <span key={r} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r === "baker" ? "bg-stone-800 text-stone-300" : r === "deco" ? "bg-rose-900/40 text-rose-300" : r === "pastry" ? "bg-amber-900/40 text-amber-300" : "bg-sky-900/40 text-sky-300"}`}>{r === "baker" ? "Baker" : r === "deco" ? "Deco" : r === "pastry" ? "Pastry" : "Kitchen"}</span>)}{roles.length === 0 && <span className="text-[11px] text-zinc-600">—</span>}</div>
                      <div className="col-span-2 text-right"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.priority === "HIGH" ? "bg-red-950 text-red-400 border border-red-900/50" : item.priority === "MEDIUM" ? "bg-amber-950 text-amber-400 border border-amber-900/50" : "bg-zinc-800 text-zinc-400"}`}>{item.priority === "HIGH" ? "H" : item.priority === "MEDIUM" ? "M" : "L"}</span></div>
                      <div className="col-span-2 flex justify-end"><span className={`h-2 w-2 rounded-full ${item.status === "completed" ? "bg-emerald-500" : item.status === "in-progress" ? "bg-amber-500 animate-pulse" : "bg-zinc-700"}`} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-950/40 px-3 py-2.5">
          <div className="text-[12px] text-zinc-500">Baker: {production.filter(t => t.assignedTo === "baker").length} tasks • Deco: {production.filter(t => t.assignedTo === "deco").length} tasks • Kitchen: {production.filter(t => t.assignedTo === "kitchen").length}</div>
          <button onClick={() => setActiveTab("dos")} className="text-[12px] font-medium text-white underline underline-offset-4 hover:text-zinc-300 transition-colors">Manage DOS</button>
        </div>
      </div>

      {/* Inventory + Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold text-zinc-900">Inventory Alerts</h3>
            <button onClick={() => setActiveTab("products")} className="text-[12px] font-medium text-zinc-700 hover:underline">View all</button>
          </div>
          {(() => {
            const now = new Date();
            const todayStr = now.toISOString().split("T")[0];
            const noStock = inventory.filter(i => i.onHand === 0);
            const lowStock = inventory.filter(i => i.onHand > 0 && i.onHand < i.threshold);
            const expired = inventory.filter(i => i.expiryDate && i.expiryDate < todayStr);
            const expiring = inventory.filter(i => i.expiryDate && i.expiryDate >= todayStr && new Date(i.expiryDate).getTime() - now.getTime() <= 30 * 24 * 60 * 60 * 1000);
            const sections: { type: string; label: string; items: typeof inventory; icon: string; color: string; border: string; bg: string; iconBg: string }[] = [];
            if (noStock.length) sections.push({ type: "out", label: "Out of Stock", items: noStock, icon: "0", color: "text-zinc-700", border: "border-zinc-200", bg: "bg-zinc-50/80", iconBg: "bg-zinc-500" });
            if (lowStock.length) sections.push({ type: "low", label: "Low Stock", items: lowStock, icon: "!", color: "text-red-700", border: "border-red-200", bg: "bg-red-50/80", iconBg: "bg-red-600" });
            if (expired.length) sections.push({ type: "exp", label: "Expired", items: expired, icon: "✕", color: "text-purple-700", border: "border-purple-200", bg: "bg-purple-50/80", iconBg: "bg-purple-600" });
            if (expiring.length) sections.push({ type: "expg", label: "Expiring Soon", items: expiring, icon: "~", color: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50/80", iconBg: "bg-amber-600" });
            if (sections.length === 0) return <p className="text-[13px] text-zinc-400 text-center py-6">All inventory items are healthy.</p>;
            const allAlerts = [...sections].flatMap(s => s.items.map(item => ({ ...item, alertType: s })));
            const totalAlerts = allAlerts.length;
            const displayed = allAlerts.slice(0, 5);
            return <div className="space-y-2.5">{displayed.map((item) => {
              const s = item.alertType;
              return (
              <div key={item.id + s.type} className={`flex items-center gap-3 rounded-2xl border ${s.border} ${s.bg} p-3`}>
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${s.iconBg} text-white text-[12px] font-bold`} style={{ fontFamily: "Fragment Mono, monospace" }}>{s.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-[13px] font-medium text-zinc-900">{item.name}</div>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${s.color} ${s.bg} border ${s.border}`}>{s.label}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-600">
                    {s.type === "out" ? "0 on hand — reorder needed"
                    : s.type === "low" ? `${item.onHand} / ${item.threshold} ${item.unit} — below threshold`
                    : s.type === "exp" ? `Expired ${item.expiryDate} — dispose or mark as waste`
                    : `Expires ${item.expiryDate} — use within 30 days`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px] font-medium text-white">₱{item.cost}</div>
                  <div className="text-[11px] text-zinc-500">{item.supplier}</div>
                </div>
              </div>
            )})}{totalAlerts > 5 && <button onClick={() => setActiveTab("warehouse")} className="w-full rounded-xl border border-dashed border-zinc-800 py-2 text-[12px] font-medium text-zinc-500 hover:text-white hover:border-zinc-600 hover:bg-zinc-800/40 transition-all">See all {totalAlerts} alerts</button>}</div>;
          })()}
        </div>

        <div className="lg:col-span-5 rounded-[24px] border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
          <h3 className="text-[15px] font-semibold text-white">Activity Feed</h3>
          <div className="mt-4 space-y-1">
            {auditLogs.slice(0, 5).map(log => {
              const typeConfig = log.action.includes("ALERT") ? { label: "Alert", color: "bg-red-950 text-red-400 border border-red-900/50", dot: "bg-red-500" }
                : log.action.includes("COMPLETE") ? { label: "Done", color: "bg-emerald-950 text-emerald-400 border border-emerald-900/50", dot: "bg-emerald-500" }
                : log.action.includes("DISPATCH") ? { label: "Dispatch", color: "bg-sky-950 text-sky-400 border border-sky-900/50", dot: "bg-sky-500" }
                : { label: "Update", color: "bg-zinc-800 text-zinc-300 border border-zinc-700", dot: "bg-zinc-400" };
              return (
                <div key={log.id} onClick={() => setSelectedLog(log)} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-zinc-800/40 transition-all cursor-pointer">
                  <div className={`mt-1 grid h-2 w-2 shrink-0 place-items-center rounded-full ${typeConfig.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="text-[13px] font-medium text-white">{log.userName}</span><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${typeConfig.color}`}>{typeConfig.label}</span></div>
                    <div className="mt-0.5 text-[12px] leading-snug text-zinc-400">{log.details}</div>
                  </div>
                  <div className="shrink-0 text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{log.timestamp}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Deliveries + Scheduled DOS */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-6 rounded-[24px] border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-white">Delivery Status</h3>
            <button onClick={() => setActiveTab("deliveries")} className="text-[12px] font-medium text-zinc-400 hover:text-white transition-colors">View all</button>
          </div>
          {deliveries.filter(d => d.status !== "delivered").length === 0 ? (
            <p className="text-[13px] text-zinc-500 text-center py-6">No active deliveries.</p>
          ) : (
            <div className="space-y-2.5">
              {deliveries.filter(d => d.status !== "delivered").map(d => (
                <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 hover:bg-zinc-800/40 transition-colors">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${d.status === "in-transit" ? "bg-amber-600/20 text-amber-500 border border-amber-500/30" : "bg-sky-600/20 text-sky-500 border border-sky-500/30"} text-[12px] font-bold`}>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20m10-10H2" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-white truncate">{d.branch}</span>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${d.status === "in-transit" ? "bg-amber-950 text-amber-400 border border-amber-900/50" : "bg-sky-950 text-sky-400 border border-sky-900/50"}`}>{d.status === "in-transit" ? "In Transit" : "Preparing"}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">{d.items.length} item{d.items.length > 1 ? "s" : ""} • ETA {d.eta}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[12px] font-medium text-white">{d.items.reduce((s, i) => s + i.qty, 0)} pcs</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold text-zinc-900">Upcoming Scheduled DOS</h3>
            <button onClick={() => setActiveTab("dos")} className="text-[12px] font-medium text-zinc-700 hover:underline">Manage</button>
          </div>
          {(() => {
            const scheduled = dosItems.filter(i => i.status === "scheduled").sort((a, b) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));
            if (scheduled.length === 0) return <p className="text-[13px] text-zinc-400 text-center py-6">No scheduled DOS items.</p>;
            const byDate = new Map<string, typeof scheduled>();
            scheduled.forEach(i => { const d = i.scheduledDate || "unknown"; if (!byDate.has(d)) byDate.set(d, []); byDate.get(d)!.push(i); });
            return <div className="space-y-2.5">{[...byDate.entries()].slice(0, 4).map(([date, items]) => {
              const label = (() => { const d = new Date(date + "T00:00:00"); const today = new Date(); today.setHours(0, 0, 0, 0); const diff = Math.round((d.getTime() - today.getTime()) / 86400000); if (diff === 0) return "Today"; if (diff === 1) return "Tomorrow"; return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); })();
              return (
                <div key={date} className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white text-[11px] font-bold font-mono">{items.length}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-zinc-900">{label}</span>
                      <span className="shrink-0 rounded-full bg-blue-200 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">{date}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-600">{items.map(i => i.product).join(", ")}</div>
                  </div>
                  <div className="text-right shrink-0 text-[12px] font-medium text-zinc-900 font-mono">{items.reduce((s, i) => s + i.qty, 0)} pcs</div>
                </div>
              );
            })}</div>;
          })()}
        </div>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
          <div className="w-full max-w-[480px] rounded-[28px] border border-[#E8E0D5] bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${selectedLog.action.includes("ALERT") ? "bg-red-100" : selectedLog.action.includes("COMPLETE") ? "bg-emerald-100" : selectedLog.action.includes("DISPATCH") ? "bg-blue-100" : "bg-zinc-100"}`}>
                  <span className={`text-[16px] ${selectedLog.action.includes("ALERT") ? "text-red-600" : selectedLog.action.includes("COMPLETE") ? "text-emerald-600" : selectedLog.action.includes("DISPATCH") ? "text-blue-600" : "text-zinc-600"}`}>
                    {selectedLog.action.includes("ALERT") ? "!" : selectedLog.action.includes("COMPLETE") ? "✓" : selectedLog.action.includes("DISPATCH") ? "→" : "i"}
                  </span>
                </div>
                <div><h3 className="text-[16px] font-semibold text-zinc-900">{selectedLog.action.replace(/_/g, " ")}</h3><p className="text-[12px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{selectedLog.id}</p></div>
              </div>
              <button onClick={() => setSelectedLog(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100">✕</button>
            </div>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-2.5"><span className="text-[12px] text-zinc-500">User</span><span className="text-[13px] font-medium text-zinc-900">{selectedLog.user}</span></div>
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-2.5"><span className="text-[12px] text-zinc-500">Role</span><span className="text-[13px] font-medium capitalize text-zinc-900">{selectedLog.role}</span></div>
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-2.5"><span className="text-[12px] text-zinc-500">Time</span><span className="text-[13px] font-medium text-zinc-900" style={{ fontFamily: "Fragment Mono, monospace" }}>{selectedLog.timestamp}</span></div>
              <div className="rounded-xl bg-zinc-50 px-4 py-3"><div className="text-[12px] text-zinc-500 mb-1">Details</div><div className="text-[13px] leading-relaxed text-zinc-900">{selectedLog.details}</div></div>
            </div>
            <button onClick={() => setSelectedLog(null)} className="mt-5 w-full rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800 transition-all">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-[16px] font-semibold">{title}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RecipeModal({ product, recipes, inventory, onSave, onClose }: {
  product: string; recipes: ProductRecipe[]; inventory: InventoryItem[];
  onSave: (recipe: ProductRecipe) => void; onClose: () => void;
}) {
  const isNew = !product;
  const existing = isNew ? null : recipes.find(r => r.productName === product);
  const [recipeName, setRecipeName] = useState(isNew ? "" : product);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(isNew ? [] : (existing?.ingredients || []));
  const [notes, setNotes] = useState(isNew ? "" : (existing?.notes || ""));
  const [showPicker, setShowPicker] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");

  function addIngredient(inv: InventoryItem) {
    if (ingredients.some(i => i.inventoryId === inv.id)) return;
    setIngredients(prev => [...prev, { inventoryId: inv.id, name: inv.name, qtyPerBatch: 1, unit: inv.unit }]);
    setShowPicker(false);
  }

  function removeIngredient(id: string) {
    setIngredients(prev => prev.filter(i => i.inventoryId !== id));
  }

  function updateQty(id: string, qty: number) {
    setIngredients(prev => prev.map(i => i.inventoryId === id ? { ...i, qtyPerBatch: qty } : i));
  }

  function updateUnit(id: string, unit: string) {
    setIngredients(prev => prev.map(i => i.inventoryId === id ? { ...i, unit } : i));
  }

  const totalCost = ingredients.reduce((sum, ing) => {
    const inv = inventory.find(i => i.id === ing.inventoryId);
    return sum + (inv ? inv.cost * ing.qtyPerBatch : 0);
  }, 0);

  const available = inventory.filter(i => !ingredients.some(ing => ing.inventoryId === i.id));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[640px] max-h-[90vh] overflow-y-auto rounded-[28px] border border-[#E8E0D5] bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div><h3 className="text-[16px] font-semibold">{isNew ? "Add Recipe" : "Edit Recipe"}</h3></div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100">✕</button>
        </div>

        <div className="mb-4">
          <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Recipe Name</label>
          <input value={recipeName} onChange={e => setRecipeName(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" placeholder="e.g. Pandesal" />
        </div>

        <div className="mb-3 relative">
          <button onClick={() => { setShowPicker(!showPicker); if (showPicker) setIngredientSearch(""); }} className="text-[12px] font-medium text-blue-600 hover:text-blue-800">+ Add ingredient from inventory</button>
          {showPicker && (
            <div className="fixed inset-0 z-0" onClick={() => { setShowPicker(false); setIngredientSearch(""); }} />
          )}
          {showPicker && (
            <div className="absolute top-7 left-0 z-10 mt-1 w-72 rounded-xl border border-zinc-200 bg-white shadow-lg">
              <input value={ingredientSearch} onChange={e => setIngredientSearch(e.target.value)} placeholder="Search ingredients..." className="w-full rounded-t-xl border-b border-zinc-200 px-3 py-2.5 text-[12px] outline-none focus:border-zinc-400" autoFocus />
              <div className="max-h-40 overflow-y-auto">
                {(() => {
                  const filtered = available.filter(i => i.name.toLowerCase().includes(ingredientSearch.toLowerCase()));
                  if (filtered.length === 0) return <p className="px-3 py-3 text-[12px] text-zinc-400 text-center">No ingredients found.</p>;
                  return filtered.map(i => (
                    <button key={i.id} type="button" onClick={() => { addIngredient(i); setIngredientSearch(""); }} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-50 text-[12px]">
                      <span className="font-medium text-zinc-900">{i.name}</span>
                      <span className="text-zinc-400 font-mono">{i.unit}</span>
                    </button>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1.5 max-h-[200px] overflow-y-auto mb-4">
          {ingredients.length === 0 ? (
            <p className="text-[12px] text-zinc-400 text-center py-4">No ingredients added yet.</p>
          ) : ingredients.map(ing => {
            const inv = inventory.find(i => i.id === ing.inventoryId);
            const cost = inv ? inv.cost * ing.qtyPerBatch : 0;
            return (
              <div key={ing.inventoryId} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-3 py-2">
                <span className="text-[12px] font-medium text-zinc-900 flex-1 truncate">{ing.name}</span>
                <div className="flex items-center gap-1.5">
                  <input value={ing.unit} onChange={e => updateUnit(ing.inventoryId, e.target.value)} className="w-12 rounded-lg border border-zinc-200 px-1.5 py-1 text-[10px] text-center outline-none focus:border-zinc-900" />
                  <input type="number" min="0" step="any" value={ing.qtyPerBatch} onChange={e => updateQty(ing.inventoryId, Number(e.target.value))} className="w-16 rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-center outline-none focus:border-zinc-400" />
                  <span className="text-[10px] font-mono text-zinc-500 w-14 text-right">₱{cost.toFixed(2)}</span>
                  <button onClick={() => removeIngredient(ing.inventoryId)} className="text-zinc-400 hover:text-red-500 text-[13px]">×</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mb-4">
          <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400 resize-none" rows={3} placeholder="Optional notes about this recipe..." />
        </div>

        <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 mb-4">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-zinc-600">{ingredients.length} ingredient{ingredients.length !== 1 ? "s" : ""}</span>
            <span className="font-medium text-zinc-800" style={{ fontFamily: "Fragment Mono, monospace" }}>₱{totalCost.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t border-[#E8E0D5]">
          <button onClick={onClose} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
          <button onClick={() => onSave({ id: existing?.id, productId: isNew ? recipeName : product, productName: recipeName, ingredients, notes, packagingMaterials: existing?.packagingMaterials ?? [], decorationSupplies: existing?.decorationSupplies ?? [] })} disabled={ingredients.length === 0} className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed">Save Recipe</button>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function CompactTaskCard({ task, color }: { task: ProductionTask; color: string }) {
  const pct = Math.round((task.completed / task.target) * 100);
  const barMap: Record<string, string> = { "stone-500": "bg-stone-500", "rose-500": "bg-rose-500", "emerald-500": "bg-emerald-500", "amber-500": "bg-amber-500" };
  const barColor = barMap[color] || "bg-stone-500";
  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-[#F9F6F1] transition-all cursor-default">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-medium text-zinc-900 truncate">{task.product}</span>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${task.status === "completed" ? "bg-emerald-100 text-emerald-700" : task.status === "in-progress" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-500"}`}>{task.status === "in-progress" ? "active" : task.status}</span>
          </div>
          <span className={`shrink-0 text-[12px] font-semibold font-mono ${task.status === "completed" ? "text-emerald-600" : task.status === "in-progress" ? "text-amber-600" : "text-zinc-400"}`}>{task.completed}/{task.target}</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-[#F3EFE9]">
          <div className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className={`shrink-0 h-2.5 w-2.5 rounded-full ${task.status === "completed" ? "bg-emerald-500" : task.status === "in-progress" ? "bg-amber-500 animate-pulse" : "bg-zinc-300"}`} />
    </div>
  );
}

function AddProductWithRecipeModal({ inventory, recipes, onSave, onClose }: {
  inventory: InventoryItem[]; recipes: ProductRecipe[]; onSave: (name: string, packaging: RecipeIngredient[], decoration: RecipeIngredient[], linkedProduct: string[]) => void; onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [linkedProduct, setLinkedProduct] = useState<string[]>([]);
  const [packagingItems, setPackagingItems] = useState<RecipeIngredient[]>([]);
  const [decorationItems, setDecorationItems] = useState<RecipeIngredient[]>([]);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [showPackagingPicker, setShowPackagingPicker] = useState(false);
  const [showDecorationPicker, setShowDecorationPicker] = useState(false);
  const [packagingSearch, setPackagingSearch] = useState("");
  const [decorationSearch, setDecorationSearch] = useState("");

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

  const availablePackaging = inventory.filter(i => i.group === "packaging-materials" && !packagingItems.some(ing => ing.inventoryId === i.id) && (i.name.toLowerCase().includes(packagingSearch.toLowerCase()) || packagingSearch === ""));
  const availableDecoration = inventory.filter(i => i.group === "decoration-supplies" && !decorationItems.some(ing => ing.inventoryId === i.id) && (i.name.toLowerCase().includes(decorationSearch.toLowerCase()) || decorationSearch === ""));

  function toggleRecipe(r: string) {
    setLinkedProduct(prev => prev.includes(r) ? prev.filter(p => p !== r) : [...prev, r]);
  }

  const filteredRecipes = recipes.filter(r => r.productName.toLowerCase().includes(recipeSearch.toLowerCase()) || recipeSearch === "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), packagingItems, decorationItems, linkedProduct);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto rounded-[28px] border border-[#E8E0D5] bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-semibold">Add Product</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Product Name</label>
            <input required value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" placeholder="e.g. Pandesal" autoFocus />
          </div>

          <div className="mb-4">
            <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Link Recipes</label>
            {linkedProduct.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {linkedProduct.map(r => (
                  <span key={r} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                    {r}
                    <button type="button" onClick={() => toggleRecipe(r)} className="text-zinc-400 hover:text-red-500 ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input value={recipeSearch} onChange={e => setRecipeSearch(e.target.value)} placeholder="Search recipes..." className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-zinc-900 transition-colors" />
              {recipeSearch && (
                <>
                  <div className="fixed inset-0 z-0" onClick={() => setRecipeSearch("")} />
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-40 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
                    {filteredRecipes.length === 0 ? (
                      <p className="px-3 py-2 text-[12px] text-zinc-400">No recipes found.</p>
                    ) : filteredRecipes.map(r => (
                      <label key={r.productName} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 cursor-pointer text-[12px]">
                        <input type="checkbox" checked={linkedProduct.includes(r.productName)} onChange={() => { toggleRecipe(r.productName); setRecipeSearch(""); }} className="rounded border-zinc-300" />
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
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Packaging</span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-700">{packagingItems.length}</span>
              </div>
              <div className="relative">
                <button type="button" onClick={() => setShowPackagingPicker(!showPackagingPicker)} className="text-[12px] font-medium text-blue-600 hover:text-blue-800">+ Add</button>
                {showPackagingPicker && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowPackagingPicker(false)} />
                    <div className="absolute top-5 right-0 z-20 w-60 rounded-xl border border-zinc-200 bg-white shadow-lg">
                      <div className="p-2 border-b border-zinc-100">
                        <input value={packagingSearch} onChange={e => setPackagingSearch(e.target.value)} placeholder="Search packaging..." className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] outline-none focus:border-zinc-400" />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {availablePackaging.length === 0 ? (
                          <p className="px-3 py-3 text-[12px] text-zinc-400 text-center">No packaging items found.</p>
                        ) : availablePackaging.map(i => (
                          <button key={i.id} type="button" onClick={() => { addPackaging(i); setPackagingSearch(""); }} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-50 text-[12px]">
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
            {packagingItems.length === 0 ? (
              <p className="text-[12px] text-zinc-400 py-3 text-center border border-dashed border-zinc-200 rounded-xl">No packaging added.</p>
            ) : (
              <div className="space-y-1 max-h-[140px] overflow-y-auto">
                {packagingItems.map(item => (
                  <div key={item.inventoryId} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-3 py-2">
                    <span className="text-[12px] font-medium text-zinc-900 truncate flex-1">{item.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input value={item.unit} onChange={e => setPackagingItems(prev => prev.map(i => i.inventoryId === item.inventoryId ? { ...i, unit: e.target.value } : i))} className="w-12 rounded-lg border border-zinc-200 px-1.5 py-1 text-[10px] text-center outline-none focus:border-zinc-900" />
                      <input type="number" min="0" step="any" value={item.qtyPerBatch} onChange={e => setPackagingItems(prev => prev.map(i => i.inventoryId === item.inventoryId ? { ...i, qtyPerBatch: Number(e.target.value) } : i))} className="w-16 rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-center outline-none focus:border-zinc-400" />
                      <button type="button" onClick={() => setPackagingItems(prev => prev.filter(i => i.inventoryId !== item.inventoryId))} className="text-zinc-400 hover:text-red-500 text-[13px]">×</button>
                    </div>
                  </div>
                ))}
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

          <div className="flex gap-2 pt-3 border-t border-[#E8E0D5]">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
            <button type="submit" disabled={!name.trim()} className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed">Add Product</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditDOSModal({ item, onClose, onSave }: { item: DOSItem; onClose: () => void; onSave: (item: DOSItem) => void }) {
  const [product, setProduct] = useState(item.product); 
  const [qty, setQty] = useState(item.qty);
  const [priority, setPriority] = useState(item.priority);
  const [scheduledDate, setScheduledDate] = useState(item.scheduledDate || "");
  const [selectedRoles, setSelectedRoles] = useState<Set<"baker" | "pastry" | "deco">>(new Set(item.roles || []));
  
  // Debug effect to log roles on modal open
  useEffect(() => {
    console.log("EditDOSModal: Initializing with roles:", item.roles);
  }, [item.roles]);

  const isScheduled = item.status === "scheduled";
  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    const rolesArray = Array.from(selectedRoles);
    console.log("EditDOSModal: Submitting. Roles:", rolesArray);
    onSave({ ...item, product, qty, priority, scheduledDate: isScheduled ? scheduledDate : undefined, roles: rolesArray }); 
    onClose(); 
  };

  const toggleRole = (role: "baker" | "pastry" | "deco") => {
    console.log("Toggling role:", role);
    setSelectedRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) {
        console.log("Removing role:", role);
        next.delete(role);
      } else {
        console.log("Adding role:", role);
        next.add(role);
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[480px] rounded-[28px] border border-[#E8E0D5] bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><div><h3 className="text-[16px] font-semibold">Edit DOS Item</h3><p className="mt-0.5 text-[12px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.id}</p></div><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100">✕</button></div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">Production Team</label>
            <div className="flex gap-2">
                {[
                  { id: "baker" as const, label: "Baker", color: "from-stone-600 to-neutral-700" },
                  { id: "pastry" as const, label: "Pastry", color: "from-amber-600 to-yellow-700" },
                  { id: "deco" as const, label: "Deco", color: "from-rose-600 to-pink-600" },
                ].map(role => {
                    const on = selectedRoles.has(role.id);
                    return (
                        <button key={role.id} type="button" onClick={() => toggleRole(role.id)} className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-all flex-1 justify-center ${on ? `bg-gradient-to-br ${role.color} text-white border-transparent shadow-sm` : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"}`}>
                            <span className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] font-bold transition-all ${on ? "border-white/40 bg-white/20" : "border-zinc-300"}`}>
                                {on ? "✓" : ""}
                            </span>
                            {role.label}
                        </button>
                    )
                })}
            </div>
          </div>
          <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Product Name</label><input required value={product} onChange={e => setProduct(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Total</label><input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }} /></div>
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Priority</label><select value={priority} onChange={e => setPriority(e.target.value as typeof priority)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400"><option value="HIGH">HIGH</option><option value="MEDIUM">MEDIUM</option><option value="LOW">LOW</option></select></div>
          </div>
          {isScheduled && (
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Schedule Date</label><input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" /></div>
          )}
          <div className="flex gap-2 pt-1"><button type="button" onClick={onClose} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button><button type="submit" className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800">Save Changes</button></div>
        </form>
      </div>
    </div>
  );
}

function PricingModal({ item, recipes, inventory, productCatalog, onSave, onDelete, onClose }: {
  item: ProductPricing;
  recipes: ProductRecipe[];
  inventory: InventoryItem[];
  productCatalog: string[];
  onSave: (item: ProductPricing) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const isNew = !item.sellingPrice && !item.wholesalePrice && !item.category && !item.variants.length;
  const [productName, setProductName] = useState(item.productName);
  const [sellingPrice, setSellingPrice] = useState(String(item.sellingPrice || ""));
  const [wholesalePrice, setWholesalePrice] = useState(String(item.wholesalePrice || ""));
  const [status, setStatus] = useState<"active" | "draft" | "archived">(item.status);
  const [category, setCategory] = useState(item.category);
  const [variants, setVariants] = useState(item.variants || []);

  const recipe = recipes.find(r => r.productName === productName);
  const allIngredients = recipe ? [...recipe.ingredients, ...recipe.packagingMaterials, ...recipe.decorationSupplies] : [];
  const estCost = allIngredients.reduce((sum, ing) => {
    const inv = inventory.find(i => i.id === ing.inventoryId);
    return sum + (inv ? inv.cost * ing.qtyPerBatch : 0);
  }, 0);
  const sp = Number(sellingPrice) || 0;
  const margin = sp > 0 ? ((sp - estCost) / sp * 100) : 0;

  const handleSave = () => {
    if (!productName.trim()) return;
    onSave({
      ...item,
      productName: productName.trim(),
      category,
      estimatedCost: estCost,
      sellingPrice: sp,
      wholesalePrice: Number(wholesalePrice) || 0,
      profitMargin: margin,
      status,
      variants,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div><h2 className="text-[18px] font-semibold">{isNew ? "Add Product" : "Edit Pricing"}</h2><p className="text-[13px] text-zinc-500">{isNew ? "Set pricing for a new product" : item.productName}</p></div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">✕</button>
        </div>

        {/* Product Name */}
        {isNew && (
          <div className="mb-5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Select Product</label>
            <select value={productName} onChange={e => setProductName(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400">
              <option value="">Choose a product...</option>
              {productCatalog.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Cost Breakdown */}
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4 mb-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-3">Estimated Production Cost</div>
          {allIngredients.length === 0 ? (
            <p className="text-[12px] text-zinc-400">No recipe found for this product. Add a recipe to auto-calculate cost.</p>
          ) : (
            <div className="space-y-1.5">
              {allIngredients.map((ing, i) => {
                const inv = inventory.find(iv => iv.id === ing.inventoryId);
                const lineCost = inv ? inv.cost * ing.qtyPerBatch : 0;
                return (
                  <div key={i} className="flex items-center justify-between text-[12px]">
                    <span className="text-zinc-600">{ing.name} <span className="text-zinc-400">({ing.qtyPerBatch} {ing.unit})</span></span>
                    <span className="text-zinc-700" style={{ fontFamily: "Fragment Mono, monospace" }}>₱{lineCost.toFixed(2)}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between text-[13px] font-semibold border-t border-zinc-200 pt-2 mt-2">
                <span className="text-zinc-800">Total Est. Cost</span>
                <span className="text-zinc-900" style={{ fontFamily: "Fragment Mono, monospace" }}>₱{estCost.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Fields */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Category</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Bakery" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" />
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400">
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Selling Price (₱)</label>
            <input type="number" min="0" step="0.01" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }} />
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Wholesale Price (₱)</label>
            <input type="number" min="0" step="0.01" value={wholesalePrice} onChange={e => setWholesalePrice(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }} />
          </div>
        </div>

        {/* Profit Summary */}
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4 mb-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Est. Cost</div>
              <div className="text-[16px] font-semibold text-zinc-700 mt-0.5" style={{ fontFamily: "Fragment Mono, monospace" }}>₱{estCost.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Profit</div>
              <div className={`text-[16px] font-semibold mt-0.5 ${margin >= 30 ? "text-emerald-600" : margin >= 15 ? "text-amber-600" : "text-red-500"}`} style={{ fontFamily: "Fragment Mono, monospace" }}>{sp > 0 ? `₱${(sp - estCost).toFixed(2)}` : "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Margin</div>
              <div className={`text-[16px] font-semibold mt-0.5 ${margin >= 30 ? "text-emerald-600" : margin >= 15 ? "text-amber-600" : "text-red-500"}`} style={{ fontFamily: "Fragment Mono, monospace" }}>{sp > 0 ? `${margin.toFixed(1)}%` : "—"}</div>
            </div>
          </div>
        </div>

        {/* Variants */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Size Variants</label>
            <button onClick={() => setVariants(prev => [...prev, { id: `VAR-${Date.now()}`, size: "", sellingPrice: 0, wholesalePrice: 0 }])} className="text-[12px] text-zinc-500 hover:text-zinc-800 font-medium">+ Add Variant</button>
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
                  <button onClick={() => setVariants(prev => prev.filter((_, idx) => idx !== i))} className="text-zinc-400 hover:text-red-500 text-[13px]">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => onDelete(item.id)} className="rounded-xl border border-red-200 px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 transition-all">Delete</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl border border-zinc-200 px-4 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all">Cancel</button>
            <button onClick={handleSave} className="rounded-xl bg-zinc-900 px-5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all">Save Pricing</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiveModal({ inventory, onUpdateInventory, onTransaction, onClose }: {
  inventory: InventoryItem[]; onUpdateInventory: (cb: InventoryItem[] | ((prev: InventoryItem[]) => InventoryItem[])) => void;
  onTransaction: (tx: StockTransaction) => void; onClose: () => void;
}) {
  const [selectedItem, setSelectedItem] = useState(inventory[0]?.id || "");
  const [qty, setQty] = useState("");
  const [reference, setReference] = useState("PO-001");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const item = inventory.find(i => i.id === selectedItem);
    if (!item || !qty) return;
    const updated = inventory.map(i => i.id === selectedItem ? { ...i, onHand: i.onHand + Number(qty) } : i);
    onUpdateInventory(updated);
    onTransaction({
      id: `STX-${Date.now()}`,
      type: "in",
      itemName: item.name,
      itemId: item.id,
      qty: Number(qty),
      unit: item.unit,
      reference: `Supplier ${reference}`,
      timestamp: new Date().toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      group: item.group,
    });
    onClose();
  };

  const selected = inventory.find(i => i.id === selectedItem);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[480px] rounded-[28px] border border-[#E8E0D5] bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div><h3 className="text-[16px] font-semibold text-zinc-900">Receive from Supplier</h3><p className="mt-0.5 text-[12px] text-zinc-500">Receive stock into inventory</p></div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-all">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-5 pt-4">
          <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Item</label><select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400">{inventory.map(i => (<option key={i.id} value={i.id}>{i.name} ({i.sku}) — {i.onHand} {i.unit}</option>))}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Quantity</label><input required type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400" /></div>
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Reference / PO</label><input required value={reference} onChange={e => setReference(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400" /></div>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Current Stock</span>
              <div className="flex items-baseline gap-1.5"><span className="text-[18px] font-semibold text-zinc-800">{selected?.onHand || 0}</span><span className="text-[12px] text-zinc-400">{selected?.unit || "units"}</span></div>
            </div>
          </div>
          <div className="flex gap-2 pt-1"><button type="button" onClick={onClose} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all">Cancel</button><button type="submit" className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-emerald-700 transition-all">Receive Stock</button></div>
        </form>
      </div>
    </div>
  );
}


function EditInventoryModal({ item, onSave, onClose }: { item: InventoryItem; onSave: (item: InventoryItem) => void; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [sku, setSku] = useState(item.sku);
  const [unit, setUnit] = useState(item.unit);
  const [onHand, setOnHand] = useState(String(item.onHand));
  const [threshold, setThreshold] = useState(String(item.threshold));
  const [cost, setCost] = useState(String(item.cost));
  const [supplier, setSupplier] = useState(item.supplier);
  const [category, setCategory] = useState(item.category);
  const [group, setGroup] = useState(item.group);
  const [expiryDate, setExpiryDate] = useState(item.expiryDate || "");
  const [customCat, setCustomCat] = useState(false);
  const [accessRoles, setAccessRoles] = useState<Role[]>(item.accessRoles || []);
  const [showScanner, setShowScanner] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const startScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setShowScanner(true);
      setTimeout(async () => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if ("BarcodeDetector" in window) {
          const detector = new (window as any).BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] });
          const scan = async () => {
            if (!videoRef.current) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                setSku(barcodes[0].rawValue);
                stopScanner();
                return;
              }
            } catch {}
            requestAnimationFrame(scan);
          };
          scan();
        } else {
          alert("BarcodeDetector is not supported in this browser. Try Chrome or Edge.");
          stopScanner();
        }
      }, 100);
    } catch (err) {
      alert("Camera access denied. Please allow camera access and try again.");
    }
  };

  const stopScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowScanner(false);
  };

  const isNew = !item.sku;
  const allRoles: { id: Role; label: string; icon: string }[] = [
    { id: "baker", label: "Baker", icon: "◆" },
    { id: "deco", label: "Deco", icon: "◆" },
    { id: "pastry", label: "Pastry", icon: "◆" },
  ];
  const toggleRole = (role: Role) => setAccessRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);

  const categoriesByGroup: Record<string, string[]> = {
    "ingredients": ["Dry", "Dairy", "Produce", "Frozen", "Spices"],
    "packaging-materials": ["Boxes", "Bags", "Wraps", "Labels", "Containers"],
    "decoration-supplies": ["Colors", "Toppings", "Glitters", "Fondant", "Sprinkles"],
    "operational-supplies": ["Cleaning", "Office", "Maintenance", "Safety"],
  };
  const currentCategories = categoriesByGroup[group] || ["General"];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ ...item, name: name.trim(), sku: sku.trim(), unit: unit.trim(), onHand: Number(onHand), threshold: Number(threshold), cost: Number(cost), supplier: supplier.trim(), category, group, expiryDate: expiryDate || undefined, accessRoles });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[520px] rounded-[28px] border border-[#E8E0D5] bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h3 className="text-[16px] font-semibold text-zinc-900">{isNew ? "New Item" : "Edit Item"}</h3>
            <p className="mt-0.5 text-[12px] text-zinc-500">{isNew ? "Add a new item to inventory" : `Editing ${item.name}`}</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-all">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-5 pt-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Name</label><input required value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400" /></div>
            <div className="min-w-0"><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">SKU</label>
              <div className="flex items-center gap-1 mt-1">
                <input value={sku} onChange={e => setSku(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400" />
                <button type="button" onClick={startScanner} className="shrink-0 h-[42px] w-[42px] grid place-items-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:border-zinc-300 transition-all text-[15px]" title="Scan barcode">📷</button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Unit</label>
  <select value={unit} onChange={e => setUnit(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400">
    <option value="">-- Select --</option>
    <option value="kg">kg</option>
    <option value="g">g</option>
    <option value="L">L</option>
    <option value="ml">ml</option>
    <option value="pcs">pcs</option>
    <option value="trays">trays</option>
    <option value="packs">packs</option>
    <option value="boxes">boxes</option>
    <option value="sacks">sacks</option>
    <option value="bottles">bottles</option>
    <option value="rolls">rolls</option>
    <option value="sheets">sheets</option>
    <option value="cans">cans</option>
  </select>
</div>
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Cost (₱)</label><input required type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400" /></div>
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Threshold</label><input required type="number" min="0" value={threshold} onChange={e => setThreshold(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Supplier</label><input value={supplier} onChange={e => setSupplier(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400" /></div>
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Category</label>
              {customCat ? (
                <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Type new category..." className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400" />
              ) : (
                <div className="flex gap-1.5">
                  <select value={category} onChange={e => { const v = e.target.value; if (v === "__new__") { setCustomCat(true); setCategory(""); } else { setCategory(v); } }} className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400">
                    {currentCategories.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                    <option value="__new__">+ New...</option>
                  </select>
                  <button type="button" onClick={() => { setCustomCat(true); setCategory(""); }} className="rounded-xl border border-dashed border-zinc-300 px-3 py-2.5 text-[12px] font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-all">+</button>
                </div>
              )}
            </div>
            <div>{group === "ingredients" || group === "decoration-supplies" ? <><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Expiry Date</label><input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400" /></> : <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">&nbsp;</label><div className="mt-1 flex h-[42px] items-center rounded-xl border border-dashed border-zinc-200 px-3.5 text-[12px] text-zinc-400">No expiry</div></div>}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {isNew ? (
              <>
                <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Group</label>
                  <div className="mt-1 flex h-[42px] items-center rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 text-[13px] font-medium text-zinc-700 capitalize">{group.replace(/-/g, " ")}</div>
                </div>
                <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">On Hand</label><input required type="number" min="0" value={onHand} onChange={e => setOnHand(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400" /></div>
              </>
            ) : (
              <>
                <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Group</label>
                  <select value={group} onChange={e => setGroup(e.target.value as InventoryItem["group"])} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400">
                    <option value="ingredients">Ingredients</option>
                    <option value="packaging-materials">Packaging Materials</option>
                    <option value="decoration-supplies">Decoration Supplies</option>
                    <option value="operational-supplies">Operational Supplies</option>
                  </select>
                </div>
                <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">On Hand</label><input required type="number" min="0" value={onHand} onChange={e => setOnHand(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400" /></div>
              </>
            )}
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
            <div className="text-center mb-3">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-zinc-700 block">Access Roles</label>
              <p className="text-[11px] text-zinc-400 mt-0.5">Leave empty = all roles can access</p>
            </div>
            <div className="flex items-center justify-center gap-3">
              {allRoles.map(r => {
                const active = accessRoles.includes(r.id);
                return (
                  <button key={r.id} type="button" onClick={() => toggleRole(r.id)} className={`flex flex-col items-center gap-1.5 rounded-2xl px-5 py-3 text-[13px] font-medium border-2 transition-all ${active ? "bg-zinc-900 border-zinc-900 text-white shadow-md scale-105" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:shadow-sm"}`}>
                    <span className={`text-[18px] ${active ? "text-white" : "text-zinc-400"}`}>{r.icon}</span>
                    <span>{r.label}</span>
                    {active && <span className="text-[10px] text-zinc-300">✓ Access</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all">Cancel</button>
            <button type="submit" className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800 transition-all">{isNew ? "Add Item" : "Save Changes"}</button>
          </div>
        </form>
      </div>

      {/* Barcode Scanner Modal */}
      {showScanner && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={stopScanner}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold">Scan Barcode</h3>
              <button onClick={stopScanner} className="grid h-7 w-7 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100">✕</button>
            </div>
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[70%] h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
              </div>
            </div>
            <p className="text-[12px] text-zinc-500 text-center mt-3">Point your camera at a barcode. The SKU will be filled automatically.</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
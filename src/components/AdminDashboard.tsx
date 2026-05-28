import { useEffect, useRef, useState } from "react";
import type { InventoryItem, DOSItem, ProductionTask, Delivery, AuditLog, KPIs, StockTransaction, DeliveryValidation, ProductRecipe, RecipeIngredient, MaterialRequest, BakerIngredientRequest } from "../types";
import * as db from "../lib/db";
import DOSBuilderModal from "./DOSBuilderModal";

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
  const [dosRoleFilter, setDosRoleFilter] = useState<"all" | "baker" | "deco">("all");
  const [editingInvItem, setEditingInvItem] = useState<InventoryItem | null>(null);

  // Stockroom
  const [warehouseSection, setWarehouseSection] = useState<"ingredients" | "packaging-materials" | "decoration-supplies" | "operational-supplies" | "history">("ingredients");
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [showReceive, setShowReceive] = useState(false);
  const [showRelease, setShowRelease] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<"baker" | "deco">("baker");

  // Delivery validation
  const [validations, setValidations] = useState<DeliveryValidation[]>([]);

  // Material requests from Baker & Deco
  const [bakerReqs, setBakerReqs] = useState<BakerIngredientRequest[]>([]);
  const [decoReqs, setDecoReqs] = useState<MaterialRequest[]>([]);

  // Toasts
  type ToastItem = { name: string; detail: string };
  type Toast = { id: string; sections: { type: "low-stock" | "no-stock" | "expired" | "expiring"; items: ToastItem[] }[] };
  const [toast, setToast] = useState<Toast | null>(null);
  const showToast = (sections: Omit<Toast, "id">["sections"]) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    setToast({ id, sections });
    setTimeout(() => setToast(null), 6000);
  };
  const dismissToast = () => setToast(null);

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
    const expiring = inventory.filter(i => i.expiryDate && i.expiryDate >= todayStr && new Date(i.expiryDate).getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000);
    const sections: Toast["sections"] = [];
    if (noStock.length > 0) sections.push({ type: "no-stock", items: noStock.map(i => ({ name: i.name, detail: `${i.unit}` })) });
    if (lowStock.length > 0) sections.push({ type: "low-stock", items: lowStock.map(i => ({ name: i.name, detail: `${i.onHand}/${i.threshold} ${i.unit}` })) });
    if (expired.length > 0) sections.push({ type: "expired", items: expired.map(i => ({ name: i.name, detail: `Expired ${i.expiryDate}` })) });
    if (expiring.length > 0) sections.push({ type: "expiring", items: expiring.map(i => ({ name: i.name, detail: `Expires ${i.expiryDate}` })) });
    if (sections.length > 0) showToast(sections);
  }, [activeTab]);

  /* ── Products Tab ── */
  if (activeTab === "products") {
    const filteredProducts = productCatalog.filter(p => {
      if (!invSearch) return true;
      const q = invSearch.toLowerCase();
      if (p.toLowerCase().includes(q)) return true;
      const recipe = recipes.find(r => r.productName === p);
      if (!recipe) return false;
      return (
        recipe.ingredients.some(i => i.name.toLowerCase().includes(q)) ||
        (recipe.packagingMaterials ?? []).some(i => i.name.toLowerCase().includes(q)) ||
        (recipe.decorationSupplies ?? []).some(i => i.name.toLowerCase().includes(q))
      );
    });
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-[24px] font-semibold">Products</h1>
          <button onClick={() => setShowAddProduct(true)} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800">+ Add Product</button>
        </div>
        <div className="relative max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
          <input type="text" value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Search products..." className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-[13px] outline-none focus:border-zinc-400" />
        </div>
        <div className="overflow-hidden rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Ingredients</th><th className="px-4 py-3">Packaging Materials</th><th className="px-4 py-3">Deco Supplies</th><th className="px-4 py-3 text-right">DOS Count</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-[13px]">
                {filteredProducts.map(product => {
                  const recipe = recipes.find(r => r.productName === product);
                  const dosCount = dosItems.filter(d => d.product === product).length;
                  return (
                    <tr key={product} className="hover:bg-amber-50/40">
                      <td className="px-4 py-3"><div className="font-medium text-zinc-900">{product}</div></td>
                      <td className="px-4 py-3">
                        {recipe && recipe.ingredients.length > 0 ? (
                          <span className="text-[12px] text-zinc-500">{recipe.ingredients.map(i => i.name).join(", ")}</span>
                        ) : (
                          <span className="text-[12px] text-zinc-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {(recipe?.packagingMaterials ?? []).length > 0 ? (
                          <span className="text-[12px] text-zinc-500">{(recipe?.packagingMaterials ?? []).map(i => i.name).join(", ")}</span>
                        ) : (
                          <span className="text-[12px] text-zinc-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {(recipe?.decorationSupplies ?? []).length > 0 ? (
                          <span className="text-[12px] text-zinc-500">{(recipe?.decorationSupplies ?? []).map(i => i.name).join(", ")}</span>
                        ) : (
                          <span className="text-[12px] text-zinc-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-700" style={{ fontFamily: "Fragment Mono, monospace" }}>{dosCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredProducts.length === 0 && <div className="text-center py-12"><p className="text-[14px] text-zinc-500">{productCatalog.length === 0 ? "No products yet. Add one above." : "No products match your search."}</p></div>}
        </div>
        {showAddProduct && <AddProductModal onSave={(name) => { onUpdateProductCatalog(prev => prev.includes(name) ? prev : [...prev, name]); db.addToCatalog(name).catch(console.error); setShowAddProduct(false); }} onClose={() => setShowAddProduct(false)} />}
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
    const expiring = inventory.filter(i => i.expiryDate && i.expiryDate >= todayStr && new Date(i.expiryDate).getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000);

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
              <button onClick={() => { setReleaseTarget("baker"); setShowRelease(true); }} className="rounded-xl bg-stone-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-stone-700">Release to Baker</button>
              <button onClick={() => { setReleaseTarget("deco"); setShowRelease(true); }} className="rounded-xl bg-rose-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-rose-700">Release to Deco</button>
              <button onClick={() => setShowReceive(true)} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Receive from Supplier</button>
              <button onClick={() => setEditingInvItem({ id: `INV-${Date.now()}`, name: "", sku: "", unit: "", onHand: 0, threshold: 10, cost: 0, supplier: "", lastIn: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0], category: warehouseSection === "packaging-materials" ? "packaging" : "dry", group: warehouseSection === "history" ? "ingredients" : warehouseSection })} className="rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-[13px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 hover:border-zinc-400 active:scale-[0.97] transition-all">+ New Item</button>
            </div>
          </div>

          {/* Quick Stats (shown for group views, not history) */}
          {warehouseSection !== "history" && (
            <div className="grid grid-cols-5 gap-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Total Items</div><div className="text-[24px] font-semibold mt-1">{groupItems(warehouseSection).length}</div></div>
              <button onClick={() => setStatModal("low-stock")} className="rounded-2xl border border-zinc-200 bg-white p-4 text-left hover:border-red-300 hover:bg-red-50/40 transition-all"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Low Stock</div><div className="text-[24px] font-semibold mt-1 text-red-600">{lowStock.filter(i => i.group === warehouseSection).length}</div></button>
              <button onClick={() => setStatModal("no-stock")} className="rounded-2xl border border-zinc-200 bg-white p-4 text-left hover:border-zinc-400 hover:bg-zinc-50/60 transition-all"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">No Stock</div><div className="text-[24px] font-semibold mt-1 text-zinc-800">{noStock.filter(i => i.group === warehouseSection).length}</div></button>
              <button onClick={() => setStatModal("expired")} className="rounded-2xl border border-zinc-200 bg-white p-4 text-left hover:border-purple-300 hover:bg-purple-50/40 transition-all"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Expired</div><div className="text-[24px] font-semibold mt-1 text-purple-600">{expired.filter(i => i.group === warehouseSection).length}</div></button>
              <button onClick={() => setStatModal("expiring")} className="rounded-2xl border border-zinc-200 bg-white p-4 text-left hover:border-amber-300 hover:bg-amber-50/40 transition-all"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Expiring ≤3 Days</div><div className="text-[24px] font-semibold mt-1 text-amber-600">{expiring.filter(i => i.group === warehouseSection).length}</div></button>
            </div>
          )}

          {/* Stock History View */}
          {warehouseSection === "history" ? (
            <div>
              {transactions.length > 0 ? (
                <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[16px] font-semibold">Transaction History</h2>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 font-mono">{transactions.length} entries</span>
                  </div>
                  <div className="space-y-1">
                    {[...transactions].reverse().map(tx => (
                      <div key={tx.id} className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13px]">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${tx.type === "in" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{tx.type}</span>
                        <span className="font-medium text-zinc-900 min-w-[100px]">{tx.itemName}</span>
                        <span className="text-zinc-600" style={{ fontFamily: "Fragment Mono, monospace" }}>{tx.type === "in" ? "+" : "-"}{tx.qty} {tx.unit}</span>
                        <span className="text-zinc-500">{tx.reference}</span>
                        {tx.target && <span className="text-zinc-500 capitalize">→ {tx.target}</span>}
                        <span className="ml-auto text-[11px] text-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }}>{tx.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-10 text-center"><p className="text-[14px] text-zinc-400">No transactions yet.</p></div>
              )}
            </div>
          ) : (
            <>
              {/* Items filtered by group */}
              <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[16px] font-semibold">{sidebarItems.find(s => s.key === warehouseSection)?.label}</h2>
                  <div className="flex items-center gap-2">
                    <div className="relative max-w-[220px]">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
                      <input type="text" value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Search items..." className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-8 pr-3 text-[12px] outline-none focus:border-zinc-400" />
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-[500px] space-y-2">
                  {groupItems(warehouseSection).filter(i => !invSearch || i.name.toLowerCase().includes(invSearch.toLowerCase()) || i.sku.toLowerCase().includes(invSearch.toLowerCase()) || i.supplier.toLowerCase().includes(invSearch.toLowerCase())).map(item => {
                    const pct = Math.min(100, (item.onHand / item.threshold) * 100);
                    const isCritical = item.onHand < item.threshold;
                    const isExpired = item.expiryDate && item.expiryDate < todayStr;
                    const isExpiring = item.expiryDate && item.expiryDate >= todayStr && new Date(item.expiryDate).getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000;
                    return (
                      <div key={item.id} className="flex items-center gap-4 rounded-xl border border-zinc-100 px-4 py-3 hover:bg-zinc-50/60">
                        <div className="min-w-[160px]">
                          <div className="text-[13px] font-medium text-zinc-900">{item.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-zinc-500">{item.sku} · {item.category}</span>
                            {isExpired && <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-medium text-purple-700">Expired</span>}
                            {isExpiring && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">Expiring</span>}
                          </div>
                        </div>
                        <div className="flex-1"><div className="h-2 rounded-full bg-zinc-100"><div className={`h-full rounded-full ${isExpired ? "bg-purple-500" : isCritical ? "bg-red-500" : item.onHand < item.threshold * 1.5 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} /></div></div>
                        <div className="text-right min-w-[80px]"><div className={`text-[13px] font-semibold ${isCritical ? "text-red-600" : "text-zinc-900"}`}>{item.onHand} <span className="text-[11px] font-normal text-zinc-500">/ {item.threshold}</span></div><div className="text-[11px] text-zinc-500">{item.unit}</div></div>
                        <div className="text-[12px] text-zinc-500 min-w-[120px] text-right">{item.supplier}{item.expiryDate ? <span className="block text-[11px] text-zinc-400">Exp: {item.expiryDate}</span> : <span className="block text-[11px] text-zinc-300">No expiry</span>}</div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setEditingInvItem(item)} className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 hover:border-zinc-400 transition-all">Edit</button>
                          <button onClick={async () => { if (confirm(`Delete "${item.name}"?`)) { await db.deleteInventoryItem(item.id, item.group); onUpdateInventory(inventory.filter(i => i.id !== item.id)); onAddAuditLog?.("INVENTORY_DELETED", `${item.name} removed from ${item.group}`); } }} className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 hover:border-red-300 transition-all">Del</button>
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
          <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
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
                          const tx: StockTransaction = { id: `TX-${Date.now()}`, type: "out", itemName: req.items.map(i => i.name).join(", "), itemId: req.id, qty: req.items.reduce((s, i) => s + i.qty, 0), unit: "", reference: `Released to Baker`, timestamp: new Date().toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), target: "baker" };
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
                          const tx: StockTransaction = { id: `TX-${Date.now()}`, type: "out", itemName: req.items.map(i => i.name).join(", "), itemId: req.id, qty: req.items.reduce((s, i) => s + i.qty, 0), unit: "", reference: `Released to Deco`, timestamp: new Date().toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), target: "deco" };
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
        {showRelease && <ReleaseModal inventory={inventory} target={releaseTarget} onUpdateInventory={onUpdateInventory} onTransaction={async (tx) => { setTransactions(prev => [...prev, tx]); await db.insertStockTransaction(tx).catch(console.error); onAddAuditLog?.("STOCK_RELEASED", `${tx.itemName} x${tx.qty} ${tx.unit} — ${tx.reference}`); }} onClose={() => setShowRelease(false)} />}
        {editingInvItem && <EditInventoryModal item={editingInvItem} onSave={async (updated) => { try { const exists = inventory.some(i => i.id === updated.id); if (exists) { onUpdateInventory(inventory.map(i => i.id === updated.id ? updated : i)); onAddAuditLog?.("INVENTORY_EDITED", `${updated.name} (${updated.sku}) updated`); } else { onUpdateInventory([...inventory, updated]); onAddAuditLog?.("INVENTORY_ADDED", `${updated.name} (${updated.sku}) added to ${updated.group}`); } } catch (err) { console.error("Save inventory failed:", err); alert("Failed to save item"); } setEditingInvItem(null); }} onClose={() => setEditingInvItem(null)} />}

        {/* Toast Container */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 w-[460px] pointer-events-none animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="pointer-events-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-zinc-800 text-white text-[14px] font-bold">!</div>
                <div className="flex-1 min-w-0 space-y-2">
                      {toast.sections.map((s, si) => {
                    const tagClass = s.type === "no-stock" ? "bg-zinc-100 text-zinc-700 border-zinc-200" : s.type === "low-stock" ? "bg-red-50 text-red-700 border-red-200" : s.type === "expired" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-amber-50 text-amber-700 border-amber-200";
                    const labelClass = s.type === "no-stock" ? "text-zinc-700" : s.type === "low-stock" ? "text-red-700" : s.type === "expired" ? "text-purple-700" : "text-amber-700";
                    return (
                      <div key={si}>
                        <div className={`text-[13px] font-semibold ${labelClass}`}>{s.items.length} {s.type === "no-stock" ? "out of stock" : s.type === "low-stock" ? "below threshold" : s.type === "expired" ? "expired" : "expiring within 3 days"}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">{s.items.slice(0, 5).map((it, i) => (<span key={i} className={`rounded-full px-2.5 py-1 text-[12px] font-medium border ${tagClass}`}>{it.name}: {it.detail}</span>))}</div>
                        {s.items.length > 5 && <div className="mt-0.5 text-[11px] text-zinc-400 font-medium">+{s.items.length - 5} more</div>}
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
        <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
          <div className="space-y-3">
            {auditLogs.map(log => (
              <div key={log.id} className="flex items-start gap-3 border-b border-zinc-100 pb-3 last:border-0">
                <div className="mt-0.5 text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{log.timestamp}</div>
                <div className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${log.role === "admin" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>{log.role}</div>
                <div className="flex-1"><div className="text-[13px] font-medium text-zinc-900">{log.action.replace("_", " ")}</div><div className="text-[12px] text-zinc-600">{log.details} — {log.user}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── DOS Tab ── */
  if (activeTab === "dos") {
    const roleColors: Record<string, string> = { baker: "bg-stone-500", deco: "bg-rose-500", kitchen: "bg-emerald-500" };

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
        return { baseId, items, date, total: items.reduce((s, i) => s + i.qty, 0), b1: items.reduce((s, i) => s + i.branch1, 0), b2: items.reduce((s, i) => s + i.branch2, 0) };
      }).sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    })();

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-[24px] font-semibold">DOS Builder</h1><p className="mt-1 text-[13px] text-zinc-600">Daily Order Sales management — create and track production tasks.</p></div>
          <button onClick={onOpenDOSBuilder} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800">+ New DOS</button>
        </div>

        {/* Today's DOS */}
        <div className="rounded-[24px] border border-amber-200 bg-amber-50/30 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-semibold text-amber-900">Today's DOS</span>
              <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 font-mono">{new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
            <div className="flex items-center gap-2">
              {(["all", "baker", "deco"] as const).map(role => (
                <button key={role} onClick={() => setDosRoleFilter(role)} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${dosRoleFilter === role ? "bg-zinc-900 text-white shadow-sm" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>{role === "all" ? "All" : role === "baker" ? "Baker" : "Deco"}</button>
              ))}
              <button onClick={() => setTodayAddOpen(true)} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm hover:bg-zinc-800 transition-all">+ Add</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Branch 1</th><th className="px-4 py-3 text-right">Branch 2</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Assigned To</th><th className="px-4 py-3 text-right">Status</th><th className="px-4 py-3 w-10" /></tr></thead>
              <tbody className="divide-y divide-zinc-100 text-[13px]">
                {(() => {
                  const todayItems = dosItems.filter(i => i.status !== "scheduled");
                  const filtered = dosRoleFilter === "all" ? todayItems : todayItems.filter(item => {
                    const itemKey = item.id.replace("DOS-", "");
                    return production.some(t => t.id.includes(itemKey) && t.assignedTo === dosRoleFilter);
                  });
                  if (filtered.length === 0) return <tr><td colSpan={8} className="text-center py-10 text-[13px] text-zinc-400">{dosRoleFilter === "all" ? "No DOS for today yet. Click \"+ New DOS\" to create one." : `No items assigned to ${dosRoleFilter} today.`}</td></tr>;
                  return filtered.map(item => {
                    const itemKey = item.id.replace("DOS-", "");
                    const relatedTasks = production.filter(t => t.id.includes(itemKey));
                    return (
                      <tr key={item.id} className="hover:bg-amber-50/40">
                        <td className="px-4 py-3"><div className="font-medium text-zinc-900">{item.product}</div><div className="text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.id}</div></td>
                        <td className="px-4 py-3 text-right font-medium" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.qty}</td>
                        <td className="px-4 py-3 text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.branch1}</td>
                        <td className="px-4 py-3 text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.branch2}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${item.priority === "HIGH" ? "bg-red-50 text-red-700 border border-red-200" : item.priority === "MEDIUM" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-zinc-100 text-zinc-700"}`}>{item.priority}</span></td>
                        <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{relatedTasks.length > 0 ? [...new Set(relatedTasks.map(t => t.assignedTo))].map(role => (<span key={role} className={`rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${roleColors[role] || "bg-zinc-500"}`}>{role}</span>)) : <span className="text-zinc-400 text-[11px]">—</span>}</div></td>
                        <td className="px-4 py-3 text-right"><span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${item.status === "completed" ? "text-emerald-700" : item.status === "in-progress" ? "text-amber-700" : "text-zinc-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${item.status === "completed" ? "bg-emerald-500" : item.status === "in-progress" ? "bg-amber-500 animate-pulse" : "bg-zinc-300"}`} />{item.status === "in-progress" ? "In Progress" : item.status === "completed" ? "Completed" : "Pending"}</span></td>
                        <td className="px-4 py-3 text-right"><div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setEditingDOS(item)} className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-all">Edit</button>
                          <button onClick={async () => { if (confirm(`Delete "${item.product}" from today's DOS?`)) { onDeleteDOS(item.id); } }} className="rounded-lg border border-red-200 px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 hover:border-red-300 transition-all">Del</button>
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
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[16px] font-semibold text-blue-900">Scheduled DOS</span>
                <span className="rounded-full bg-blue-200 px-2.5 py-0.5 text-[11px] font-medium text-blue-800 font-mono">{scheduled.length} item{scheduled.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-3">
                {[...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => {
                  const isOpen = expandedSched.has(date);
                  return (
                    <div key={date} className="rounded-2xl border border-blue-200 bg-white overflow-hidden">
                      <div onClick={() => toggleSched(date)} className="w-full flex items-center justify-between bg-blue-100/60 px-4 py-2.5 hover:bg-blue-200/60 transition-colors text-left cursor-pointer">
                        <span className="text-[13px] font-semibold text-blue-900">{fmtDate(date)}</span>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-blue-200/80 px-2 py-0.5 text-[10px] font-medium text-blue-800 font-mono">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                          <button onClick={e => { e.stopPropagation(); setScheduledAddDate(date); }} className="rounded-lg bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-blue-700 transition-all">+ Add</button>
                          <button onClick={e => { e.stopPropagation(); if (confirm(`Delete entire scheduled DOS for ${fmtDate(date)} (${items.length} item${items.length !== 1 ? "s" : ""})?`)) { items.forEach(i => onDeleteDOS(i.id)); } }} className="rounded-lg border border-red-300 bg-white px-2 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-all">Del All</button>
                          <span className="text-blue-500 text-[12px]">{isOpen ? "▾" : "▸"}</span>
                        </div>
                        </div>
                      {isOpen && (
                        <div className="divide-y divide-blue-50">
                          {items.map(item => (
                            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/40">
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-medium text-zinc-900">{item.product}</div>
                                <div className="text-[11px] text-zinc-500 font-mono">{item.qty}pcs · B1: {item.branch1} · B2: {item.branch2} · {item.priority}</div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => setEditingDOS(item)} className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition-all">Edit</button>
                                <button onClick={async () => { if (confirm(`Delete "${item.product}" scheduled for ${fmtDate(date)}?`)) { onDeleteDOS(item.id); } }} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 hover:border-red-300 transition-all">Del</button>
                              </div>
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
              }).map(group => {
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
                              <tr><th className="px-4 py-2.5">Product</th><th className="px-4 py-2.5 text-right">Qty</th><th className="px-4 py-2.5 text-right">Branch 1</th><th className="px-4 py-2.5 text-right">Branch 2</th><th className="px-4 py-2.5">Priority</th><th className="px-4 py-2.5 text-right">Status</th></tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              {group.items.map(item => (
                                <tr key={item.id} className="hover:bg-amber-50/40">
                                  <td className="px-4 py-2 font-medium text-zinc-900">{item.product}</td>
                                  <td className="px-4 py-2 text-right font-mono text-zinc-600">{item.qty}</td>
                                  <td className="px-4 py-2 text-right font-mono text-zinc-600">{item.branch1}</td>
                                  <td className="px-4 py-2 text-right font-mono text-zinc-600">{item.branch2}</td>
                                  <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.priority === "HIGH" ? "bg-red-50 text-red-700" : item.priority === "MEDIUM" ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>{item.priority}</span></td>
                                  <td className="px-4 py-2 text-right"><span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${item.status === "completed" ? "text-emerald-700" : item.status === "in-progress" ? "text-amber-700" : "text-zinc-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${item.status === "completed" ? "bg-emerald-500" : item.status === "in-progress" ? "bg-amber-500" : "bg-zinc-300"}`} />{item.status === "in-progress" ? "In Progress" : item.status === "completed" ? "Completed" : "Pending"}</span></td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-amber-50/40 text-[12px] font-medium text-zinc-700">
                                <td className="px-4 py-2">Total</td>
                                <td className="px-4 py-2 text-right font-mono">{group.total}</td>
                                <td className="px-4 py-2 text-right font-mono">{group.b1}</td>
                                <td className="px-4 py-2 text-right font-mono">{group.b2}</td>
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
          </div>
        )}

        {editingDOS && <EditDOSModal item={editingDOS} onClose={() => setEditingDOS(null)} onSave={onEditDOS} />}
        {scheduledAddDate && (
          <DOSBuilderModal
            onClose={() => setScheduledAddDate(null)}
            onSave={(items, tasks) => { onCreateDOS(items, tasks); setScheduledAddDate(null); }}
            productCatalog={productCatalog}
            onAddToCatalog={(name) => { onUpdateProductCatalog(prev => prev.includes(name) ? prev : [...prev, name]); db.addToCatalog(name).catch(console.error); }}
            hasTodayItems={dosItems.some(i => i.status !== "scheduled")}
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
            hasTodayItems={dosItems.some(i => i.status !== "scheduled")}
            presetDate={new Date().toISOString().split("T")[0]}
            scheduledDates={new Set(dosItems.filter(i => i.status === "scheduled" && i.scheduledDate).map(i => i.scheduledDate!))}
          />
        )}
      </div>
    );
  }

  /* ── Production Tab (Enhanced) ── */
  if (activeTab === "production") {
    const todayProducts = new Set(dosItems.filter(d => d.status !== "scheduled").map(d => d.product));
    const todayTasks = production.filter(t => todayProducts.has(t.product));
    const bakerTasks = todayTasks.filter(t => t.assignedTo === "baker");
    const decoTasks = todayTasks.filter(t => t.assignedTo === "deco");
    const kitchenTasks = todayTasks.filter(t => t.assignedTo === "kitchen");
    const pendingBaker = bakerTasks.filter(t => t.status === "pending");
    const pendingDeco = decoTasks.filter(t => t.status === "pending");

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3"><div><h1 className="text-[24px] font-semibold">Production Control</h1><p className="mt-1 text-[13px] text-zinc-600">Track all tasks across Baker, Deco, and Kitchen.</p></div><div className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[11px] font-medium text-emerald-700">Live</span></div></div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3"><div className="text-[10px] text-zinc-500 uppercase tracking-wider">Total Tasks</div><div className="text-[20px] font-semibold mt-0.5">{todayTasks.length}</div></div>
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3"><div className="text-[10px] text-zinc-500 uppercase tracking-wider">In Progress</div><div className="text-[20px] font-semibold mt-0.5 text-amber-600">{todayTasks.filter(t => t.status === "in-progress").length}</div></div>
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3"><div className="text-[10px] text-zinc-500 uppercase tracking-wider">Completed</div><div className="text-[20px] font-semibold mt-0.5 text-emerald-600">{todayTasks.filter(t => t.status === "completed").length}</div></div>
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3"><div className="text-[10px] text-zinc-500 uppercase tracking-wider">Pending Start</div><div className="text-[20px] font-semibold mt-0.5 text-zinc-600">{todayTasks.filter(t => t.status === "pending").length}</div></div>
        </div>

        {/* Department Lanes */}
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { tasks: bakerTasks, label: "Baker", accent: "bg-stone-600", dot: "bg-stone-500", tag: "bg-stone-100 text-stone-700", bar: "bg-stone-500" },
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
      </div>
    );
  }

  /* ── Deliveries Tab (Enhanced) ── */
  if (activeTab === "deliveries") {
    const pendingValidation = deliveries.filter(d => d.status === "preparing" && !validations.some(v => v.reportId === d.id));

    return (
      <div className="space-y-5">
        <div><h1 className="text-[24px] font-semibold">Delivery Control</h1><p className="mt-1 text-[13px] text-zinc-600">Validate Kitchen reports and post inventory to branches.</p></div>

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
            <div className="sm:col-span-2 text-center py-12 rounded-[24px] border border-[#E8E0D5] bg-white"><p className="text-[14px] text-zinc-500">No deliveries yet.</p></div>
          ) : (
            deliveries.map(d => {
              const val = validations.find(v => v.reportId === d.id);
              return (
                <div key={d.id} className="rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div><h3 className="text-[15px] font-semibold">{d.branch}</h3><p className="text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{d.id}</p></div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium border ${d.status === "delivered" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : d.status === "in-transit" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-zinc-50 text-zinc-600 border-zinc-200"}`}>{d.status}</span>
                  </div>
                  <div className="mt-3 border-t border-zinc-100 pt-3">
                    <div className="text-[12px] font-medium text-zinc-700 mb-1.5">Items</div>
                    {d.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-[12px] text-zinc-600 py-0.5">
                        <div className="flex items-center gap-1.5">
                          <span>{item.product}</span>
                          {item.source && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white ${item.source === "baker" ? "bg-stone-500" : "bg-rose-500"}`}>{item.source}</span>}
                        </div>
                        <span style={{ fontFamily: "Fragment Mono, monospace" }}>{item.qty} pcs</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>ETA: {d.eta}</span>
                    {!val && d.status === "preparing" && (
                      <button onClick={async () => {
                        const id = `VAL-${Date.now()}`;
                        const newVal = { id, reportId: d.id, branch: d.branch, items: [...d.items], status: "validated" as const, timestamp: new Date().toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) };
                        setValidations(prev => [...prev, newVal]);
                        await db.replaceDeliveryValidations([...validations, newVal]).catch(console.error);
                        onAddAuditLog?.("DELIVERY_VALIDATED", `${d.id} — ${d.branch} (${d.items.length} items)`);
                      }} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-800">Validate</button>
                    )}
                    {val && val.status === "validated" && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-blue-600 font-medium">✓ Validated</span>
                        <button onClick={async () => {
                          const updated = validations.map(v => v.id === val.id ? { ...v, status: "posted" as const } : v);
                          setValidations(updated);
                          await db.replaceDeliveryValidations(updated).catch(console.error);
                          onAddAuditLog?.("DELIVERY_POSTED", `${val.branch} — ${val.items.length} items posted to branch inventory`);
                        }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700">Post to Branch</button>
                      </div>
                    )}
                    {val && val.status === "posted" && <span className="text-[11px] text-emerald-600 font-medium">✓ Posted to Branch IN</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Validations Log */}
        {validations.length > 0 && (
          <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
            <h2 className="text-[16px] font-semibold mb-4">Validation Log</h2>
            <div className="space-y-1">
              {[...validations].reverse().map(v => (
                <div key={v.id} className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13px]">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${v.status === "posted" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{v.status}</span>
                  <span className="font-medium text-zinc-900">{v.branch}</span>
                  <span className="text-zinc-500">{v.items.length} item{v.items.length > 1 ? "s" : ""}</span>
                  <span className="ml-auto text-[11px] text-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }}>{v.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
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
    rows.push(["ID", "Product", "Qty", "Branch 1", "Branch 2", "Priority", "Status"]);
    dosItems.forEach(d => rows.push([d.id, d.product, String(d.qty), String(d.branch1), String(d.branch2), d.priority, d.status]));
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8 rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div><h2 className="text-[16px] font-semibold text-zinc-900" style={{ fontFamily: "Instrument Sans, system-ui" }}>Today's DOS • May 25</h2><p className="text-[12px] text-zinc-500">Daily Order Sales — auto-generates production tasks</p></div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 border border-amber-200">LOCKED</span>
              <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white">{dosItems.filter(i => i.status !== "scheduled").length} items</span>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
            <div className="overflow-x-auto">
              <div className="min-w-[500px]">
                <div className="grid grid-cols-12 gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                  <div className="col-span-3">Product</div><div className="col-span-1 text-right">Qty</div><div className="col-span-2 text-right">Branch 1</div><div className="col-span-2 text-right">Branch 2</div><div className="col-span-2 text-center">Assigned</div><div className="col-span-1 text-right">Pri</div><div className="col-span-1 text-right">Status</div>
                </div>
                <div className="divide-y divide-zinc-100">
                  {dosItems.filter(i => i.status !== "scheduled").map(item => {
                    const tasks = production.filter(t => t.product === item.product);
                    const roles = [...new Set(tasks.map(t => t.assignedTo))];
                    return (
                      <div key={item.id} className="grid grid-cols-12 items-center gap-2 px-3 py-3 hover:bg-amber-50/40">
                        <div className="col-span-3"><div className="text-[13px] font-medium text-zinc-900 truncate">{item.product}</div><div className="text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.id}</div></div>
                        <div className="col-span-1 text-right text-[13px] font-medium font-mono">{item.qty}</div>
                        <div className="col-span-2 text-right text-[13px] font-mono text-zinc-800">{item.branch1}</div>
                        <div className="col-span-2 text-right text-[13px] font-mono text-zinc-800">{item.branch2}</div>
                        <div className="col-span-2 flex justify-center gap-1 flex-wrap">{roles.map(r => <span key={r} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r === "baker" ? "bg-stone-100 text-stone-700" : r === "deco" ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700"}`}>{r === "baker" ? "Baker" : r === "deco" ? "Deco" : "Kitchen"}</span>)}{roles.length === 0 && <span className="text-[11px] text-zinc-400">—</span>}</div>
                        <div className="col-span-1 text-right"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.priority === "HIGH" ? "bg-red-50 text-red-700 border border-red-200" : item.priority === "MEDIUM" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-zinc-100 text-zinc-700"}`}>{item.priority === "HIGH" ? "H" : item.priority === "MEDIUM" ? "M" : "L"}</span></div>
                        <div className="col-span-1 flex justify-end"><span className={`h-2 w-2 rounded-full ${item.status === "completed" ? "bg-emerald-500" : item.status === "in-progress" ? "bg-amber-500 animate-pulse" : "bg-zinc-300"}`} /></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-[#F9F6F1] px-3 py-2.5">
            <div className="text-[12px] text-zinc-600">Baker: {production.filter(t => t.assignedTo === "baker").length} tasks • Deco: {production.filter(t => t.assignedTo === "deco").length} tasks • Kitchen: {production.filter(t => t.assignedTo === "kitchen").length}</div>
            <button onClick={() => setActiveTab("dos")} className="text-[12px] font-medium text-zinc-900 underline underline-offset-4">Manage DOS</button>
          </div>
        </div>

        <div className="xl:col-span-4 rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
          <h3 className="text-[15px] font-semibold text-zinc-900" style={{ fontFamily: "Instrument Sans, system-ui" }}>Live Production</h3>
          <div className="mt-3 space-y-3">
            {production.slice(0, 4).map(task => {
              const pct = Math.round((task.completed / task.target) * 100);
              return (
                <div key={task.id} className="rounded-2xl border border-zinc-200 p-3">
                  <div className="flex items-center justify-between"><div className="text-[13px] font-medium text-zinc-900">{task.product}</div><div className="text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{task.completed}/{task.target}</div></div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100"><div className={`h-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} /></div>
                  <div className="mt-1.5 flex items-center justify-between"><span className="text-[11px] text-zinc-500 capitalize">{task.assignedTo}</span><span className={`text-[10px] font-medium uppercase tracking-wider ${task.status === "completed" ? "text-emerald-700" : task.status === "in-progress" ? "text-amber-700" : "text-zinc-500"}`}>{task.status}</span></div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-[#E8E0D5]">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">Task Distribution</div>
            {(() => { const todayProds = new Set(dosItems.filter(d => d.status !== "scheduled").map(d => d.product)); const totalTasks = production.filter(t => todayProds.has(t.product)).length; return <div className="space-y-1.5">
              {[
                { label: "Baker", count: production.filter(t => t.assignedTo === "baker" && todayProds.has(t.product)).length, color: "bg-stone-500" },
                { label: "Deco / Free-Mix", count: production.filter(t => t.assignedTo === "deco" && todayProds.has(t.product)).length, color: "bg-rose-500" },
                { label: "Kitchen", count: production.filter(t => t.assignedTo === "kitchen" && todayProds.has(t.product)).length, color: "bg-emerald-500" },
              ].filter(p => p.count > 0).map(p => {
                const pct = totalTasks > 0 ? Math.round((p.count / totalTasks) * 100) : 0;
                return (
                  <div key={p.label} className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${p.color}`} />
                    <span className="text-[12px] text-zinc-600 flex-1">{p.label}</span>
                    <span className="text-[12px] font-medium text-zinc-900 font-mono">{p.count}</span>
                    <div className="w-16 h-1.5 rounded-full bg-zinc-100">
                      <div className={`h-full rounded-full ${p.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>; })()}
          </div>
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
            const expiring = inventory.filter(i => i.expiryDate && i.expiryDate >= todayStr && new Date(i.expiryDate).getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000);
            const sections: { type: string; label: string; items: typeof inventory; icon: string; color: string; border: string; bg: string; iconBg: string }[] = [];
            if (noStock.length) sections.push({ type: "out", label: "Out of Stock", items: noStock, icon: "0", color: "text-zinc-700", border: "border-zinc-200", bg: "bg-zinc-50/80", iconBg: "bg-zinc-500" });
            if (lowStock.length) sections.push({ type: "low", label: "Low Stock", items: lowStock, icon: "!", color: "text-red-700", border: "border-red-200", bg: "bg-red-50/80", iconBg: "bg-red-600" });
            if (expired.length) sections.push({ type: "exp", label: "Expired", items: expired, icon: "✕", color: "text-purple-700", border: "border-purple-200", bg: "bg-purple-50/80", iconBg: "bg-purple-600" });
            if (expiring.length) sections.push({ type: "expg", label: "Expiring Soon", items: expiring, icon: "~", color: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50/80", iconBg: "bg-amber-600" });
            if (sections.length === 0) return <p className="text-[13px] text-zinc-400 text-center py-6">All inventory items are healthy.</p>;
            return <div className="space-y-2.5">{[...sections].flatMap(s => s.items.map((item, idx) => (
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
                    : `Expires ${item.expiryDate} — use within 3 days`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px] font-medium text-zinc-900">₱{item.cost}</div>
                  <div className="text-[11px] text-zinc-500">{item.supplier}</div>
                </div>
              </div>
            )))}</div>;
          })()}
        </div>

        <div className="lg:col-span-5 rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
          <h3 className="text-[15px] font-semibold text-zinc-900">Activity Feed</h3>
          <div className="mt-4 space-y-1">
            {auditLogs.slice(0, 5).map(log => {
              const typeConfig = log.action.includes("ALERT") ? { label: "Alert", color: "bg-red-100 text-red-700", dot: "bg-red-500" }
                : log.action.includes("COMPLETE") ? { label: "Done", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" }
                : log.action.includes("DISPATCH") ? { label: "Dispatch", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" }
                : { label: "Update", color: "bg-zinc-100 text-zinc-600", dot: "bg-zinc-400" };
              return (
                <div key={log.id} onClick={() => setSelectedLog(log)} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-zinc-50 transition-all cursor-pointer">
                  <div className={`mt-1 grid h-2 w-2 shrink-0 place-items-center rounded-full ${typeConfig.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="text-[13px] font-medium text-zinc-900">{log.user}</span><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${typeConfig.color}`}>{typeConfig.label}</span></div>
                    <div className="mt-0.5 text-[12px] leading-snug text-zinc-600">{log.details}</div>
                  </div>
                  <div className="shrink-0 text-[11px] text-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }}>{log.timestamp}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Deliveries + Scheduled DOS */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-6 rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold text-zinc-900">Delivery Status</h3>
            <button onClick={() => setActiveTab("deliveries")} className="text-[12px] font-medium text-zinc-700 hover:underline">View all</button>
          </div>
          {deliveries.filter(d => d.status !== "delivered").length === 0 ? (
            <p className="text-[13px] text-zinc-400 text-center py-6">No active deliveries.</p>
          ) : (
            <div className="space-y-2.5">
              {deliveries.filter(d => d.status !== "delivered").map(d => (
                <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${d.status === "in-transit" ? "bg-amber-600" : "bg-blue-600"} text-white text-[12px] font-bold`}>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h3l2-7 4 14 2-7h3" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-zinc-900 truncate">{d.branch}</span>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${d.status === "in-transit" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{d.status === "in-transit" ? "In Transit" : "Preparing"}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-600">{d.items.length} item{d.items.length > 1 ? "s" : ""} • ETA {d.eta}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[12px] font-medium text-zinc-900">{d.items.reduce((s, i) => s + i.qty, 0)} pcs</div>
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

/* ── Sub-components ── */

function CompactTaskCard({ task, color }: { task: ProductionTask; color: string }) {
  const pct = Math.round((task.completed / task.target) * 100);
  const barMap: Record<string, string> = { "stone-500": "bg-stone-500", "rose-500": "bg-rose-500", "emerald-500": "bg-emerald-500" };
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

function AddProductModal({ onSave, onClose }: {
  onSave: (name: string) => void; onClose: () => void;
}) {
  const [name, setName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-[28px] border border-[#E8E0D5] bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-[16px] font-semibold">Add Product</h3><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100">✕</button></div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Product Name</label><input required value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" placeholder="e.g. Pandesal" autoFocus /></div>
          <p className="text-[12px] text-zinc-400">Recipe will be set up by the Deco team.</p>
          <div className="flex gap-2 pt-1 border-t border-[#E8E0D5]">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
            <button type="submit" disabled={!name.trim()} className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed">Add Product</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditDOSModal({ item, onClose, onSave }: { item: DOSItem; onClose: () => void; onSave: (item: DOSItem) => void }) {
  const [product, setProduct] = useState(item.product); const [qty, setQty] = useState(item.qty);
  const [branch1, setBranch1] = useState(item.branch1); const [branch2, setBranch2] = useState(item.branch2); const [priority, setPriority] = useState(item.priority);
  const [scheduledDate, setScheduledDate] = useState(item.scheduledDate || "");
  const isScheduled = item.status === "scheduled";
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave({ ...item, product, qty, branch1, branch2, priority, scheduledDate: isScheduled ? scheduledDate : undefined }); onClose(); };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[480px] rounded-[28px] border border-[#E8E0D5] bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><div><h3 className="text-[16px] font-semibold">Edit DOS Item</h3><p className="mt-0.5 text-[12px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.id}</p></div><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100">✕</button></div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Product Name</label><input required value={product} onChange={e => setProduct(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Total</label><input readOnly value={qty} className="mt-1 w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3.5 py-2.5 text-[13px] text-zinc-500 outline-none" style={{ fontFamily: "Fragment Mono, monospace" }} /></div>
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Branch 1</label><input required type="number" min="0" value={branch1} onChange={e => { const b1 = Number(e.target.value); setBranch1(b1); setQty(b1 + branch2); }} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }} /></div>
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Branch 2</label><input required type="number" min="0" value={branch2} onChange={e => { const b2 = Number(e.target.value); setBranch2(b2); setQty(branch1 + b2); }} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }} /></div>
          </div>
          <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Priority</label><select value={priority} onChange={e => setPriority(e.target.value as typeof priority)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400"><option value="HIGH">HIGH</option><option value="MEDIUM">MEDIUM</option><option value="LOW">LOW</option></select></div>
          {isScheduled && (
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Schedule Date</label><input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none focus:border-zinc-400" /></div>
          )}
          <div className="flex gap-2 pt-1"><button type="button" onClick={onClose} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button><button type="submit" className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800">Save Changes</button></div>
        </form>
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

function ReleaseModal({ inventory, target, onUpdateInventory, onTransaction, onClose }: {
  inventory: InventoryItem[]; target: "baker" | "deco"; onUpdateInventory: (cb: InventoryItem[] | ((prev: InventoryItem[]) => InventoryItem[])) => void;
  onTransaction: (tx: StockTransaction) => void; onClose: () => void;
}) {
  const [selectedItem, setSelectedItem] = useState(inventory[0]?.id || "");
  const [qty, setQty] = useState("");
  const selected = inventory.find(i => i.id === selectedItem);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const item = inventory.find(i => i.id === selectedItem);
    if (!item || !qty || Number(qty) > item.onHand) return;
    const updated = inventory.map(i => i.id === selectedItem ? { ...i, onHand: i.onHand - Number(qty) } : i);
    onUpdateInventory(updated);
    await db.upsertInventory(updated).catch(console.error);
    onTransaction({
      id: `STX-${Date.now()}`,
      type: "out",
      itemName: item.name,
      itemId: item.id,
      qty: Number(qty),
      unit: item.unit,
      reference: `Release to ${target}`,
      timestamp: new Date().toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      target,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[480px] rounded-[28px] border border-[#E8E0D5] bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div><h3 className="text-[16px] font-semibold text-zinc-900">Release to {target === "baker" ? "Baker" : "Deco"}</h3><p className="mt-0.5 text-[12px] text-zinc-500">Release stock to {target === "baker" ? "bakery" : "decorating"} department</p></div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-all">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-5 pt-4">
          <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Item</label><select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400">{inventory.map(i => (<option key={i.id} value={i.id}>{i.name} ({i.sku}) — {i.onHand} {i.unit}</option>))}</select></div>
          <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Quantity</label><input required type="number" min="1" max={selected?.onHand || 0} value={qty} onChange={e => setQty(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400" /></div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Available Stock</span>
              <div className="flex items-baseline gap-1.5"><span className="text-[18px] font-semibold text-zinc-800">{selected?.onHand || 0}</span><span className="text-[12px] text-zinc-400">{selected?.unit || "units"}</span></div>
            </div>
            {selected && Number(qty) > selected.onHand && <p className="mt-1 text-[11px] text-red-500">Not enough stock available</p>}
          </div>
          <div className="flex gap-2 pt-1"><button type="button" onClick={onClose} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all">Cancel</button><button type="submit" className={`flex-1 rounded-xl py-2.5 text-[13px] font-medium text-white shadow-sm transition-all ${target === "baker" ? "bg-stone-600 hover:bg-stone-700" : "bg-rose-600 hover:bg-rose-700"}`}>Release to {target === "baker" ? "Baker" : "Deco"}</button></div>
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

  const isNew = !item.sku;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ ...item, name: name.trim(), sku: sku.trim(), unit: unit.trim(), onHand: Number(onHand), threshold: Number(threshold), cost: Number(cost), supplier: supplier.trim(), category, group, expiryDate: expiryDate || undefined });
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
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">SKU</label><input value={sku} onChange={e => setSku(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400" /></div>
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
                    <option value="dry">Dry</option><option value="dairy">Dairy</option><option value="produce">Produce</option><option value="packaging">Packaging</option>
                    <option value="__new__">+ New...</option>
                  </select>
                  <button type="button" onClick={() => { setCustomCat(true); setCategory(""); }} className="rounded-xl border border-dashed border-zinc-300 px-3 py-2.5 text-[12px] font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-all">+</button>
                </div>
              )}
            </div>
            <div>{group === "ingredients" || group === "decoration-supplies" ? <><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Expiry Date</label><input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400" /></> : <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">&nbsp;</label><div className="mt-1 flex h-[42px] items-center rounded-xl border border-dashed border-zinc-200 px-3.5 text-[12px] text-zinc-400">No expiry</div></div>}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Group</label>
              <select value={group} onChange={e => setGroup(e.target.value as InventoryItem["group"])} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400">
                <option value="ingredients">Ingredients</option>
                <option value="packaging-materials">Packaging Materials</option>
                <option value="decoration-supplies">Decoration Supplies</option>
                <option value="operational-supplies">Operational Supplies</option>
              </select>
            </div>
            <div><label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">On Hand</label><input required type="number" min="0" value={onHand} onChange={e => setOnHand(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] outline-none transition-all focus:border-zinc-400" /></div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all">Cancel</button>
            <button type="submit" className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800 transition-all">{isNew ? "Add Item" : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
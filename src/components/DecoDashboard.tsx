import { useEffect, useState, useRef } from "react";
import type { ProductionTask, DOSItem, ProductRecipe, InventoryItem, FreezerItem, FreezerHistory, Role, WasteLog, StockTransaction } from "../types";
import * as db from "../lib/db";
import type { AdditionalIngredient } from "../lib/db";
import { aggregateRecipeDemand, calculateBatches, allocateOutput, sumIngredients, sumPackaging, sumDecoSupplies } from "../utils/production-calculation";

type DecoProductionPrep = { dosId: string; productName: string; productQty: number; prepared: boolean; done: boolean; additionalIngredients: AdditionalIngredient[] };

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
  customerName?: string;
  sourceInventoryId?: string;
  sourceQty?: number;
  sourceBatchRef?: string;
  sourceProducedBy?: string;
  sourceSnapshot?: InventoryItem;
  createdAt?: string;
};

function SearchableDropdown({ items, onChange, placeholder, accentColor }: {
  items: { id: string; label: string; sublabel: string }[];
  onChange: (id: string) => void;
  placeholder: string;
  accentColor: "blue" | "purple" | "amber";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const updatePos = () => { if (inputRef.current) { const r = inputRef.current.getBoundingClientRect(); setPos({ top: r.bottom + 4, left: r.left, width: r.width }); } };
  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => { if (inputRef.current) { const r = inputRef.current.getBoundingClientRect(); setPos({ top: r.bottom + 4, left: r.left, width: r.width }); } };
    const onClickOutside = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("mousedown", onClickOutside);
    return () => { window.removeEventListener("scroll", onScroll, true); document.removeEventListener("mousedown", onClickOutside); };
  }, [open]);
  const filtered = items.filter(i => !search || i.label.toLowerCase().includes(search.toLowerCase()));
  const colorMap = {
    blue: { border: "border-blue-200", text: "text-blue-500", hover: "hover:bg-blue-50", ring: "focus:border-blue-400 focus:ring-2 focus:ring-blue-100" },
    purple: { border: "border-purple-200", text: "text-purple-500", hover: "hover:bg-purple-50", ring: "focus:border-purple-400 focus:ring-2 focus:ring-purple-100" },
    amber: { border: "border-amber-200", text: "text-amber-500", hover: "hover:bg-amber-50", ring: "focus:border-amber-400 focus:ring-2 focus:ring-amber-100" },
  };
  const colors = colorMap[accentColor];
  return (
    <div ref={containerRef} className="relative" onClick={e => e.stopPropagation()}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
      <input ref={inputRef} type="text" value={search} onChange={e => { setSearch(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={placeholder} className={`w-full rounded-xl border ${colors.border} bg-white pl-9 pr-3 py-3 text-[14px] outline-none ${colors.ring}`} />
      {search && <button onClick={() => { setSearch(""); setOpen(false); }} className={`absolute right-3 top-1/2 -translate-y-1/2 ${colors.text} hover:opacity-70 text-[14px]`}>✕</button>}
      {open && filtered.length > 0 && (
        <div className="fixed z-[100] mt-2 rounded-2xl border border-zinc-200 bg-white shadow-2xl max-h-64 overflow-y-auto" style={{ top: pos.top, left: pos.left, width: pos.width }}>
          {filtered.map(i => (
            <button key={i.id} onClick={() => { onChange(i.id); setSearch(""); setOpen(false); }} className={`w-full text-left px-4 py-3 ${colors.hover} transition-colors flex items-center justify-between border-b border-zinc-100 last:border-b-0`}>
              <span className="text-[14px] font-semibold text-zinc-800">{i.label}</span>
              <span className={`text-[12px] font-medium ${colors.text}`}>{i.sublabel}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DOSRecipeDetailModal({ recipe, totalQty, onClose }: {
  recipe: ProductRecipe; totalQty: number; onClose: () => void;
}) {
  const yieldBatch = recipe.yield ?? 1;
  const batchesNeeded = Math.ceil(totalQty / yieldBatch);
  const estTotal = batchesNeeded * yieldBatch;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[520px] max-h-[85vh] rounded-[28px] bg-zinc-900 border border-zinc-700 shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800">
          <div>
            <h3 className="text-[22px] font-bold text-white">{recipe.productName}</h3>
            <p className="text-[14px] text-zinc-400 mt-1">{recipe.ingredients.length} ingredients · {totalQty} total qty</p>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors text-[18px]">✕</button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-4">
          {/* Yield Display */}
          <div className="rounded-2xl border border-amber-800 bg-amber-950/40 px-5 py-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-[12px] uppercase tracking-wider text-zinc-500 font-semibold">Total Demand</div>
                <div className="text-[24px] font-bold text-white mt-1">{totalQty} <span className="text-[14px] font-normal text-zinc-400">pcs</span></div>
              </div>
              <div className="text-center">
                <div className="text-[12px] uppercase tracking-wider text-zinc-500 font-semibold">Yield/Batch</div>
                <div className="text-[24px] font-bold text-amber-200 mt-1">{yieldBatch} <span className="text-[14px] font-normal text-amber-400">pcs</span></div>
              </div>
              <div className="text-center">
                <div className="text-[12px] uppercase tracking-wider text-zinc-500 font-semibold">Expected</div>
                <div className="text-[24px] font-bold text-emerald-300 mt-1">{estTotal} <span className="text-[14px] font-normal text-emerald-400">pcs</span></div>
              </div>
            </div>
            <div className="text-[13px] text-center text-amber-400/80 font-mono bg-amber-950/60 rounded-xl px-4 py-2.5">
              CEIL({totalQty} ÷ {yieldBatch}) = {batchesNeeded} batch × {yieldBatch} = {estTotal}
            </div>
          </div>
          {/* Ingredients */}
          <div className="text-[13px] uppercase tracking-wider text-zinc-400 font-semibold">Ingredients</div>
          {recipe.ingredients.map((ing, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-800/50 px-4 py-3">
              <div>
                <span className="text-[16px] font-semibold text-zinc-200">{ing.name}</span>
                <span className="text-[13px] text-zinc-500 ml-2">{ing.unit}</span>
              </div>
              <span className="text-[16px] font-mono font-bold text-zinc-300">{ing.qtyPerBatch * batchesNeeded}</span>
            </div>
          ))}
          {(recipe.packagingMaterials ?? []).length > 0 && (
            <>
              <div className="text-[13px] uppercase tracking-wider text-zinc-400 font-semibold pt-2">Packaging</div>
              {recipe.packagingMaterials.map((mat, i) => (
                <div key={`pkg-${i}`} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-800/50 px-4 py-3">
                  <span className="text-[16px] font-semibold text-zinc-200">{mat.name}</span>
                  <span className="text-[15px] font-mono font-bold text-zinc-400">{mat.qtyPerBatch * batchesNeeded} {mat.unit}</span>
                </div>
              ))}
            </>
          )}
          {(recipe.decorationSupplies ?? []).length > 0 && (
            <>
              <div className="text-[13px] uppercase tracking-wider text-zinc-400 font-semibold pt-2">Decoration</div>
              {recipe.decorationSupplies.map((sup, i) => (
                <div key={`deco-${i}`} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-800/50 px-4 py-3">
                  <span className="text-[16px] font-semibold text-zinc-200">{sup.name}</span>
                  <span className="text-[15px] font-mono font-bold text-zinc-400">{sup.qtyPerBatch * batchesNeeded} {sup.unit}</span>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t border-zinc-800 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl bg-zinc-800 py-3 text-[15px] font-semibold text-white hover:bg-zinc-700 transition-all">Close</button>
        </div>
      </div>
    </div>
  );
}

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
  wasteLog?: WasteLog[];
  onUpdateWasteLog?: (cb: WasteLog[] | ((prev: WasteLog[]) => WasteLog[])) => void;
  productRoutes?: Record<string, db.ProductRoute>;
  onUpdateProduction?: (taskId: string, updates: Partial<ProductionTask>) => void;
  onStockTransaction?: (tx: StockTransaction) => void;
};

export default function DecoDashboard({ production, dosItems, onCompleteTask, activeTab, setActiveTab, productCatalog, recipes, inventory, onUpdateInventory, onUpdateRecipes, onAddAuditLog, newDOSIds, onMarkDOSSeen, freezerItems = [], onUpdateFreezer, freezerHistory = [], wasteLog = [], onUpdateWasteLog, productRoutes = {}, onUpdateProduction, onStockTransaction }: Props) {
  // Defer setState calls to the next macrotask (setTimeout 0) to avoid
  // "Cannot update a component (App) while rendering DecoDashboard" warning.
  // queueMicrotask is NOT enough — React's setState also runs in microtasks.
  const defer = (fn: () => void) => { setTimeout(fn, 0); };

  // Product categories for From Baker dropdown
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [productCategoryMap, setProductCategoryMap] = useState<Record<string, string>>({});

  // StrictMode dev-mode dedup: React calls setState updater functions twice.
  // This ref tracks (id+status) pairs we've already processed side effects for,
  // so the duplicate StrictMode call skips the side effects.
  // Key is cleared 200ms later so the next user click still works.
  const processedDecoRef = useRef<Set<string>>(new Set());
  const markProcessed = (key: string) => {
    processedDecoRef.current.add(key);
    setTimeout(() => processedDecoRef.current.delete(key), 200);
  };
  const isAlreadyProcessed = (key: string) => processedDecoRef.current.has(key);

  const getBaseName = (name: string) =>
    name.toLowerCase().replace(/[\s]*[\(\*\d].*$/, '').trim();
  const findRecipe = (productName: string) => {
    const pn = productName.toLowerCase();
    const exact = recipes.filter(r => r.productName.toLowerCase() === pn);
    const withLinks = exact.find(r => (r.linkedIngredients ?? []).length > 0);
    if (withLinks) return withLinks;
    if (exact.length > 0) return exact[0];
    return recipes.find(r => (r.linkedIngredients ?? []).some(l => l.toLowerCase() === pn)) ??
      recipes.find(r => getBaseName(r.productName) === getBaseName(productName));
  };

  const todayStr = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
  const todayDOS = dosItems.filter(d => {
    if (d.status === "scheduled" && d.scheduledDate && d.scheduledDate > todayStr) return false;
    if (d.scheduledDate) return d.scheduledDate === todayStr;
    const ts = d.id.match(/DOS-(\d+)/)?.[1];
    if (!ts) return true;
    const itemDate = new Date(Number(ts)).toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    return itemDate === todayStr;
  });
  const decoTaskProducts = new Set(production.filter(p => p.assignedTo === "deco").map(t => t.product));
  const dosForDeco = todayDOS.filter(d => (d.roles ?? []).includes("deco"));

  useEffect(() => {
    if ((activeTab === "dashboard" || activeTab === "deco-queue") && dosForDeco.length > 0 && newDOSIds && onMarkDOSSeen) {
      const unseen = dosForDeco.filter(d => newDOSIds.has(d.id));
      if (unseen.length > 0) onMarkDOSSeen(unseen.map(d => d.id));
    }
  }, [activeTab]);

  // Refetch freezer items from DB when freezer tab becomes active
  useEffect(() => {
    if (activeTab === "freezer") {
      db.fetchFreezerItems().then(items => onUpdateFreezer?.(items)).catch(console.error);
    }
  }, [activeTab]);

  const [editingRecipe, setEditingRecipe] = useState<string | null>(null);
  const [recipeDraft, setRecipeDraft] = useState<{ inventoryId: string; name: string; qtyPerBatch: number; unit: string }[]>([]);
  const [recipeDraftYield, setRecipeDraftYield] = useState<number>(1);
  const [preMixPrepared, setPreMixPrepared] = useState<Set<string>>(new Set());
  const [preMixDone, setPreMixDone] = useState<Set<string>>(new Set());
  const [productQty, setProductQty] = useState<Record<string, number>>({});
  const [activePreparation, setActivePreparation] = useState<{ dos: DOSItem; recipe: ProductRecipe; route: "baker" | "deco"; demandQty?: number } | null>(null);
  const [additionalIngredients, setAdditionalIngredients] = useState<AdditionalIngredient[]>([]);
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [newAddIngredient, setNewAddIngredient] = useState<AdditionalIngredient>({ name: "", qty: 0, unit: "", reason: "", source: "" });
  const [productAdditionalIngredients, setProductAdditionalIngredients] = useState<Record<string, AdditionalIngredient[]>>({});

  // Load from Supabase on mount
  useEffect(() => {
    db.fetchDecoProductionPrep().then(items => {
      const addIngMap: Record<string, AdditionalIngredient[]> = {};
      const prepared = new Set<string>();
      const done = new Set<string>();
      const qty: Record<string, number> = {};
      items.forEach(i => {
        const key = `${i.dosId}:::${i.productName.toLowerCase()}`;
        if (i.prepared) prepared.add(key);
        if (i.done) done.add(key);
        qty[i.dosId] = i.productQty;
        if (i.additionalIngredients?.length) addIngMap[key] = i.additionalIngredients;
      });
      setPreMixPrepared(prepared);
      setPreMixDone(done);
      setProductQty(qty);
      if (Object.keys(addIngMap).length > 0) setProductAdditionalIngredients(addIngMap);
    }).catch(console.error);
  }, []);

  // Save to Supabase on change
  useEffect(() => {
    const items: DecoProductionPrep[] = [];
    const allDosIds = new Set<string>();
    [...preMixPrepared, ...preMixDone].forEach(k => {
      const sepIdx = k.indexOf(":::");
      if (sepIdx !== -1) allDosIds.add(k.substring(0, sepIdx));
    });
    Object.keys(productQty).forEach(id => allDosIds.add(id));
    allDosIds.forEach(dosId => {
      const dos = dosForDeco.find(d => d.id === dosId);
      if (!dos) return;
      const directRecipe = findRecipe(dos.product);
      const linkedRecipes = (directRecipe?.linkedIngredients ?? [])
        .map(name => recipes.find(r => r.productName === name))
        .filter(Boolean)
        .filter(r => r!.productName !== dos.product);
      const allRecipes = linkedRecipes;
      if (allRecipes.length === 0) {
        const key = `${dosId}:::${dos.product.toLowerCase()}`;
        items.push({ dosId, productName: dos.product, productQty: productQty[dosId] ?? dos.qty, prepared: preMixPrepared.has(key), done: preMixDone.has(key), additionalIngredients: productAdditionalIngredients[key] ?? [] });
      }
      allRecipes.forEach(r => {
        const key = `${dosId}:::${r!.productName.toLowerCase()}`;
        items.push({ dosId, productName: r!.productName, productQty: productQty[dosId] ?? dos.qty, prepared: preMixPrepared.has(key), done: preMixDone.has(key), additionalIngredients: productAdditionalIngredients[key] ?? [] });
      });
    });
    if (items.length > 0) db.saveDecoProductionPrep(items).catch(console.error);
  }, [preMixPrepared, preMixDone, productQty, productAdditionalIngredients]);
  const [advMixSearch, setAdvMixSearch] = useState("");
  const [selectedAdvRecipes, setSelectedAdvRecipes] = useState<Set<string>>(new Set());
  const [advMixQtys, setAdvMixQtys] = useState<Record<string, number>>({});
  const [advMixAdjustments, setAdvMixAdjustments] = useState<Record<string, Record<string, number>>>({});
  const [isAdvLocked, setIsAdvLocked] = useState(false);

  // Freezer state
  const [showAddFreezer, setShowAddFreezer] = useState(false);
  const [showAddBakerInventory, setShowAddBakerInventory] = useState(false);
  const [bakerInvProduct, setBakerInvProduct] = useState("");
  const [bakerInvSize, setBakerInvSize] = useState("");
  const [bakerInvQty, setBakerInvQty] = useState(0);
  const [bakerInvCategory, setBakerInvCategory] = useState("dry");
  const [showAddDisplayCake, setShowAddDisplayCake] = useState(false);
  const [displayCakeProduct, setDisplayCakeProduct] = useState("");
  const [displayCakeSize, setDisplayCakeSize] = useState("");
  const [displayCakeQty, setDisplayCakeQty] = useState(0);
  const [showEditFreezer, setShowEditFreezer] = useState(false);
  const [editingFreezerItem, setEditingFreezerItem] = useState<FreezerItem | null>(null);
  const [newProduct, setNewProduct] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("pcs");
  const [newBatch, setNewBatch] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [freezerSearch, setFreezerSearch] = useState("");
  const [freezerTab, setFreezerTab] = useState<"Display Cakes" | "Production Recipe" | "Advanced Premix" | "My Inventory">("Display Cakes");

  // Refetch freezer items when switching sub-tabs for live data
  useEffect(() => {
    if (activeTab === "freezer") {
      db.fetchFreezerItems().then(items => onUpdateFreezer?.(items)).catch(console.error);
    }
  }, [freezerTab]);

  const [customOrders, setCustomOrders] = useState<CustomOrder[]>([
    { id: "CO-001", customer: "Anna Santos", product: "Chocolate Cake", request: "Pink ribbon + gold topper + #21 candle", status: "pending", createdAt: "May 28, 10:30 AM" },
    { id: "CO-002", customer: "Mike Reyes", product: "Choco Moist Cake", request: "Add happy birthday text + sprinkles", status: "in-progress", createdAt: "May 28, 09:15 AM" },
    { id: "CO-003", customer: "Lisa Cruz", product: "Sponge Fudge", request: "Minimalist white icing + fresh flowers", status: "pending", createdAt: "May 28, 11:00 AM" },
  ]);

  const [decoQueue, setDecoQueue] = useState<DecoTask[]>([]);

  // Load decoration queue from Supabase on mount with real-time subscription
  useEffect(() => {
    db.fetchDecorationQueue().then(rows => {
      setDecoQueue(rows.map(r => ({
        id: r.id,
        product: r.product,
        orderRef: r.orderRef,
        theme: r.theme,
        status: r.status,
        notes: r.notes,
        customerName: r.customerName,
        sourceInventoryId: r.sourceInventoryId,
        sourceQty: r.sourceQty,
        sourceBatchRef: r.sourceBatchRef,
        sourceProducedBy: r.sourceProducedBy,
        sourceSnapshot: r.sourceSnapshot,
        createdAt: r.createdAt,
      })));
    }).catch(console.error);
    const unsub = db.subscribeDecorationQueue(() => {
      db.fetchDecorationQueue().then(rows => {
        setDecoQueue(rows.map(r => ({
          id: r.id,
          product: r.product,
          orderRef: r.orderRef,
          theme: r.theme,
          status: r.status,
          notes: r.notes,
          customerName: r.customerName,
          sourceInventoryId: r.sourceInventoryId,
          sourceQty: r.sourceQty,
          sourceBatchRef: r.sourceBatchRef,
          sourceProducedBy: r.sourceProducedBy,
          sourceSnapshot: r.sourceSnapshot,
          createdAt: r.createdAt,
        })));
      }).catch(console.error);
    });
    return unsub;
  }, []);

  const [designModal, setDesignModal] = useState<{ product: string; inventoryId: string; qty: number; theme?: string; notes?: string; customerName?: string; colorScheme?: string; designNotes?: string; topper?: string; referenceImage?: string; messageCaption?: string; layers?: string } | null>(null);
  const [designTheme, setDesignTheme] = useState("");
  const [designNotes, setDesignNotes] = useState("");
  const [designQty, setDesignQty] = useState(1);
  const [selectedBaseCakes, setSelectedBaseCakes] = useState<{ inventoryId: string; name: string; qty: number; unit: string; source: string }[]>([]);
  const [extraPackaging, setExtraPackaging] = useState<{ name: string; qty: number; unit: string; inventoryId: string }[]>([]);
  const [extraDecoration, setExtraDecoration] = useState<{ name: string; qty: number; unit: string; inventoryId: string }[]>([]);
  const [extraIngredients, setExtraIngredients] = useState<{ name: string; qty: number | string; unit: string; inventoryId: string }[]>([]);
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);

  const toggleProduct = (dosId: string, _linkedRecipes: any[]) => {
    setSelectedProducts(prev => { const next = new Set(prev); if (next.has(dosId)) next.delete(dosId); else next.add(dosId); return next; });
  };
  const [prepSearch, setPrepSearch] = useState("");
  const [prepSlide, setPrepSlide] = useState(0);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());


  const [summaryModal, setSummaryModal] = useState<"products" | "ingredients" | "packaging" | "deco" | null>(null);
  const [preMixInDashboard, setPreMixInDashboard] = useState(false);
  const [viewingDOSRecipe, setViewingDOSRecipe] = useState<{ recipe: ProductRecipe; totalQty: number } | null>(null);
  const [selectedRecipeModal, setSelectedRecipeModal] = useState<{ recipe: ProductRecipe; dosProduct: string; dosId: string; maxQty: number } | null>(null);
  const [selectedQty, setSelectedQty] = useState(1);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<string>>(new Set());
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [saveAmounts, setSaveAmounts] = useState<Record<string, number>>({});
  const [recipeModalDraft, setRecipeModalDraft] = useState<Record<string, number>>({});
  const [showInventoryConfirmModal, setShowInventoryConfirmModal] = useState(false);
  const [wasteSource, setWasteSource] = useState("my-inventory");
  const [wasteItemId, setWasteItemId] = useState<string>("");
  const [wasteQty, setWasteQty] = useState<number>(1);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Production Plan state
  const [planDraft, setPlanDraft] = useState<{
    demands: RecipeDemand[];
    batches: BatchCalculation[];
    allocations: OutputAllocation[];
  } | null>(null);

  // Build production plan draft when DOS items or recipes change
  useEffect(() => {
    const todayStr = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    const todayDOSForPlan = dosItems.filter(d => {
      if (d.status === "scheduled" && d.scheduledDate && d.scheduledDate > todayStr) return false;
    if (d.scheduledDate) return d.scheduledDate === todayStr;
      const ts = d.id.match(/DOS-(\d+)/)?.[1];
      if (!ts) return true;
      const itemDate = new Date(Number(ts)).toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
      return itemDate === todayStr;
    }).filter(d => (d.roles ?? []).includes("deco"));
    if (todayDOSForPlan.length === 0) { setPlanDraft(null); return; }
    const demands = aggregateRecipeDemand(todayDOSForPlan, recipes);
    const batches = demands.map(d => {
      const recipe = recipes.find(r => r.productName === d.recipeName)!;
      return calculateBatches(d, recipe, inventory);
    });
    const allocations = batches.map((b, i) => allocateOutput(b, demands[i].demandedBy));
    setPlanDraft({ demands, batches, allocations });
  }, [dosItems, recipes, inventory]);
  const [wasteReason, setWasteReason] = useState("Spoilage");

  const [wasteSearch, setWasteSearch] = useState("");
  const [wasteShowDropdown, setWasteShowDropdown] = useState(false);
  const wasteSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wasteSearchRef.current && !wasteSearchRef.current.contains(e.target as Node)) {
        setWasteShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch product categories and mappings for From Baker dropdown
  useEffect(() => {
    db.fetchCategories().then(cats => setProductCategories(cats)).catch(() => {});
    db.fetchProductCategories().then(map => setProductCategoryMap(map)).catch(() => {});
  }, []);

  const allIngredients = inventory.filter(i => i.group === "ingredients" || i.group === "decoration-supplies" || i.group === "packaging-materials");
  const decoMaterials = inventory.filter(i => i.group === "decoration-supplies");
  const ingredientItems = inventory.filter(i => i.group === "ingredients");
  const lowDecoMaterials = decoMaterials.filter(i => i.onHand > 0 && i.onHand < i.threshold);

  const togglePrepared = (id: string) => setPreMixPrepared(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const handleEditRecipe = (product: string) => {
    const existing = findRecipe(product);
    setRecipeDraft(existing ? existing.ingredients.map(i => ({ ...i })) : []);
    setRecipeDraftYield(existing?.yield ?? 1);
    setEditingRecipe(product);
  };

  const handleSaveRecipe = () => {
    if (!editingRecipe || !onUpdateRecipes) return;
    const existingRecipe = findRecipe(editingRecipe);
    const newRecipe: ProductRecipe = {
      productId: editingRecipe, productName: editingRecipe,
      ingredients: recipeDraft.filter(i => i.name.trim()),
      packagingMaterials: existingRecipe?.packagingMaterials ?? [],
      decorationSupplies: existingRecipe?.decorationSupplies ?? [],
      linkedIngredients: existingRecipe?.linkedIngredients ?? [],
      yield: recipeDraftYield || 1,
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
    if (!dos) return;
    const productRecipes = getRecipesForProduct(product);
    if (productRecipes.length === 0) return;
    const newInv = [...inventory];
    const deductions: string[] = [];
    productRecipes.forEach(recipe => {
      recipe.ingredients.forEach(ing => {
        const neededQty = Math.ceil(ing.qtyPerBatch * (productQty[dos.id] ?? dos.qty));
        const idx = newInv.findIndex(i => i.id === ing.inventoryId);
        if (idx >= 0) { newInv[idx] = { ...newInv[idx], onHand: Math.max(0, newInv[idx].onHand - neededQty) }; deductions.push(`${recipe.productName}: ${ing.name}`); }
      });
    });
    onUpdateInventory(newInv);
    await db.upsertInventory(newInv).catch(console.error);
    // Log stock transactions for each deducted ingredient
    newInv.forEach(item => {
      const orig = inventory.find(o => o.id === item.id);
      if (orig && orig.onHand > item.onHand) {
        onStockTransaction?.({ id: `STX-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, type: "out", itemName: item.name, itemId: item.id, qty: orig.onHand - item.onHand, unit: item.unit, reference: `Pre-mix: ${product}`, timestamp: new Date().toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), target: "deco", group: item.group, role: "deco" });
      }
    });
    onAddAuditLog?.("PRE_MIX_COMPLETED", `${product}: ${deductions.join(", ")}`);
    setPreMixDone(prev => new Set(prev).add(product));
    // Mark all deduped ingredients as prepared
    const toggleKeys = new Set<string>();
    productRecipes.forEach(recipe => {
      recipe.ingredients.forEach(ing => toggleKeys.add(`${dos.id}-${ing.name.toLowerCase()}`));
    });
    toggleKeys.forEach(key => togglePrepared(key));
  };

  const updateCustomOrder = (id: string, status: CustomOrder["status"]) => {
    setCustomOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  };

  const updateDecoTask = (id: string, status: DecoTask["status"]) => {
    setDecoQueue(prev => {
      const prevTask = prev.find(t => t.id === id);
      const next = prev.map(t => t.id === id ? { ...t, status } : t);
      const task = next.find(t => t.id === id);
      if (task) {
        // StrictMode dedup: skip side effects on the duplicate invocation
        const dedupKey = `update-${id}-${status}`;
        if (isAlreadyProcessed(dedupKey)) {
          return next;
        }
        markProcessed(dedupKey);
        db.upsertDecorationQueueTask({
          id: task.id, product: task.product, orderRef: task.orderRef,
          theme: task.theme, status: task.status, notes: task.notes,
          customerName: task.customerName,
          sourceInventoryId: task.sourceInventoryId, sourceQty: task.sourceQty,
          sourceBatchRef: task.sourceBatchRef, sourceProducedBy: task.sourceProducedBy ?? undefined, createdAt: task.createdAt,
          sourceSnapshot: task.sourceSnapshot,
        }).catch(console.error);

        // On Put it on Display Cake (in-progress → completed), add to Freezer Display Cakes
        if (status === "completed" && prevTask?.status === "in-progress") {
          const qtyMultiplier = task.sourceQty && task.sourceQty > 0 ? task.sourceQty : 1;
          const dateProduced = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
          const baseNotes = `From Decoration Queue · ${task.theme}${task.notes ? ` · ${task.notes}` : ""}`;
          const newDisplayItem: FreezerItem = {
            id: `FRZ-DQ-${Date.now()}`,
            productName: task.product,
            qty: qtyMultiplier,
            unit: "pcs",
            batchRef: `DQ-${task.id.replace(/^DQ-/, "")}`,
            producedBy: "deco",
            dateProduced,
            status: "stored",
            notes: baseNotes,
          };
          defer(() => onUpdateFreezer?.(prev => {
            // MERGE: if a row already exists for the same (productName + theme),
            // ADD the new task's qty to the existing row's qty and update it.
            // Otherwise insert a new row with the task's qty.
            const themePrefix = `From Decoration Queue · ${task.theme}`;
            const sameKey = (f: FreezerItem) => f.productName === task.product && (f.notes || "").startsWith(themePrefix);
            const existing = prev.find(sameKey);
            if (existing) {
              const merged: FreezerItem = {
                ...existing,
                qty: (Number(existing.qty) || 0) + qtyMultiplier,
              };
              db.upsertFreezerItems([merged]).catch(err => console.error("Freezer save failed:", err));
              return prev.map(f => (f.id === existing.id ? merged : f));
            }
            db.upsertFreezerItems([newDisplayItem]).catch(err => console.error("Freezer save failed:", err));
            return [...prev, newDisplayItem];
          }));
          // Audit log: also deferred to avoid setState-during-render warning.
          defer(() => onAddAuditLog?.("DECO_TASK_COMPLETED", `${task.product} ×${qtyMultiplier} → Freezer/Display Cakes`));
        }
      }
      return next;
    });
  };

  const deleteDecoTask = (id: string) => {
    setDecoQueue(prev => {
      const task = prev.find(t => t.id === id);
      if (task && task.sourceInventoryId && task.sourceQty && task.sourceQty > 0) {
        // StrictMode dedup
        const dedupKey = `delete-${id}`;
        if (isAlreadyProcessed(dedupKey)) {
          return prev.filter(t => t.id !== id);
        }
        markProcessed(dedupKey);
        // If a snapshot exists, the source was hard-deleted at task creation —
        // the user "used" the FULL snapshot amount, so the correct restore is
        // to reset onHand to snapshot.onHand (NOT add to current).
        // If no snapshot (older task) and source still exists, refund sourceQty
        // onto the current onHand.
        if (task.sourceSnapshot) {
          const snap = task.sourceSnapshot;
          defer(() => onUpdateInventory(prevInv => {
            const existingDup = prevInv.find(i =>
              i.id === task.sourceInventoryId
              || (i.name.toLowerCase() === snap.name.toLowerCase() && i.group === snap.group && i.source === snap.source)
            );
            if (existingDup) {
              // Source came back via Production Prep or another path.
              // Reset onHand to snapshot's original (since user used all of it).
              const restored = { ...existingDup, onHand: snap.onHand };
              db.upsertInventoryItem(restored).catch(err => {
                console.error("Inventory restore failed:", err);
              });
              defer(() => onAddAuditLog?.("DECO_TASK_DELETED", `${task.product} ×${snap.onHand} restored to My Inventory (reset to original)`));
              return prevInv.map(i => i.id === existingDup.id ? restored : i);
            } else {
              // Source is genuinely gone — re-add with snapshot data
              const restored: InventoryItem = { ...snap, id: task.sourceInventoryId! };
              db.upsertInventoryItem(restored).catch(err => {
                console.error("Inventory re-add failed:", err);
              });
              defer(() => onAddAuditLog?.("DECO_TASK_DELETED", `${task.product} ×${snap.onHand} re-added to My Inventory`));
              return [...prevInv, restored];
            }
          }));
        } else {
          // No snapshot (older task) — use the partial-use restore path
          const sourceItem = inventory.find(i => i.id === task.sourceInventoryId);
          if (sourceItem) {
defer(() => onUpdateInventory(prevInv => {
              const existing = prevInv.find(i => i.id === sourceItem.id);
              if (existing) {
                const restored = { ...existing, onHand: existing.onHand + task.sourceQty! };
                db.upsertInventoryItem(restored).catch(err => {
                  console.error("Inventory restore failed:", err);
                });
                defer(() => onAddAuditLog?.("DECO_TASK_DELETED", `${task.product} ×${task.sourceQty} restored to My Inventory`));
                return prevInv.map(i => i.id === existing.id ? restored : i);
              } else {
                return prevInv;
              }
            }));
          } else {
            defer(() => onAddAuditLog?.("DECO_TASK_DELETED", `${task.product} ×${task.sourceQty} deleted (source item no longer exists)`));
          }
        }
      }
      return prev.filter(t => t.id !== id);
    });
    db.deleteDecorationQueueTask(id).catch(console.error);
  };


  const pendingRecipes = productCatalog.filter(p => !recipes.some(r => r.productName === p)).length;
  const pendingDecoTasks = decoQueue.filter(t => t.status === "pending").length;
  const pendingCustomOrders = customOrders.filter(o => o.status === "pending").length;

  const formatQty = (qty: number, unit: string) => {
    const wholeUnits = ["pcs", "pc", "pieces", "piece", "pack", "packs", "box", "boxes", "tray", "trays", "set", "sets", "bottle", "bottles", "can", "cans"];
    return wholeUnits.includes((unit || "").toLowerCase()) ? Math.round(qty).toString() : qty.toFixed(1);
  };

  const getRecipesForProduct = (product: string) => {
    const base = getBaseName(product);
    // Direct recipes — exact match or base-name match
    const direct = recipes.filter(r =>
      r.productName.toLowerCase() === product.toLowerCase() ||
      getBaseName(r.productName) === base
    );
    // Recipes that explicitly link TO this product (via their linkedIngredients field)
    const linked = recipes.filter(r =>
      (r.linkedIngredients ?? []).some(l => l.toLowerCase() === product.toLowerCase() || getBaseName(l) === base) &&
      r.productName !== product
    );
    // Recipes that are linked FROM this product's own linkedIngredients field
    const productRecipe = findRecipe(product);
    const fromLinks = productRecipe
      ? ((productRecipe.linkedIngredients ?? [])
          .map(name => recipes.find(r => r.productName === name))
          .filter((r): r is ProductRecipe => r !== undefined && r.productName !== product))
      : [];
    // Deduplicate by productName
    const seen = new Set<string>();
    return [...direct, ...fromLinks, ...linked].filter(r => {
      if (seen.has(r.productName)) return false;
      seen.add(r.productName);
      return true;
    });
  };

  const totalNeeded = dosForDeco.reduce((s, d) => {
    const directRecipe = findRecipe(d.product);
    const linkedRecipes = (directRecipe?.linkedIngredients ?? [])
      .map(name => recipes.find(r => r.productName === name))
      .filter(Boolean)
      .filter(r => r!.productName !== d.product);
    return s + linkedRecipes.reduce((sum, r) => sum + (r!.ingredients?.length ?? 0), 0);
  }, 0);
  const totalPrepared = preMixPrepared.size;
  const allMixesDone = dosForDeco.every(d => preMixDone.has(d.product));

  const workflowSteps = [
    { id: "dashboard", label: "DOS Received" },
    { id: "tasks-to-prepare", label: "Tasks to Prepare" },
    { id: "production-plan", label: "Production Plan" },
    { id: "advanced-premix", label: "Advanced Premix" },
    { id: "deco-queue", label: "Cake Productions" },
    { id: "freezer", label: "Finished Products" },
  ];
  const currentStepIdx = workflowSteps.findIndex(s => s.id === activeTab);
  const nextStep = currentStepIdx >= 0 && currentStepIdx < workflowSteps.length - 1 ? workflowSteps[currentStepIdx + 1] : null;

  /* ── Dashboard ── */
  if (activeTab === "dashboard") {
    const totalPkg = dosForDeco.reduce((s, d) => {
      const directRecipe = findRecipe(d.product);
      const linkedRecipes = (directRecipe?.linkedIngredients ?? [])
        .map(name => recipes.find(r => r.productName === name))
        .filter(Boolean)
        .filter(r => r!.productName !== d.product);
      const allRecipes = linkedRecipes;
      const pkgSet = new Set<string>();
      allRecipes.forEach(r => (r!.packagingMaterials ?? []).forEach(p => pkgSet.add(p.name.toLowerCase())));
      return s + pkgSet.size;
    }, 0);
    const totalDecoItems = dosForDeco.reduce((s, d) => {
      const directRecipe = findRecipe(d.product);
      const linkedRecipes = (directRecipe?.linkedIngredients ?? [])
        .map(name => recipes.find(r => r.productName === name))
        .filter(Boolean)
        .filter(r => r!.productName !== d.product);
      const allRecipes = linkedRecipes;
      const decoSet = new Set<string>();
      allRecipes.forEach(r => (r!.decorationSupplies ?? []).forEach(p => decoSet.add(p.name.toLowerCase())));
      return s + decoSet.size;
    }, 0);

return (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Pre-Mix Sub-View inside Dashboard */}
        {preMixInDashboard ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setPreMixInDashboard(false)} className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all">
                <span className="text-[14px]">←</span> Back to DOS Received
              </button>
            </div>

            <div>
              <h1 className="text-[28px] font-semibold tracking-tight">Production Preparation</h1>
              <p className="mt-1 text-[13px] text-zinc-500">Tap a recipe card to view and adjust ingredients, then save to freezer.</p>
            </div>

            {dosForDeco.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center"><p className="text-[14px] text-zinc-400">No DOS items assigned for today.</p></div>
            ) : (
              <div className="space-y-6">
                {dosForDeco.map(d => {
                  const directRecipe = findRecipe(d.product);
                  const linkedRecipes = (directRecipe?.linkedIngredients ?? [])
                    .map(name => recipes.find(r => r.productName === name))
                    .filter(Boolean)
                    .filter(r => r!.productName !== d.product);
                  const allRecipes = linkedRecipes;
                  if (allRecipes.length === 0) return null;
                  const remaining = (productQty[d.id] ?? d.qty);
                  if (remaining <= 0) return null;

                  return (
                    <div key={d.id}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => toggleProduct(d.id, allRecipes)}
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${
                              selectedProducts.has(d.id)
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-zinc-300 bg-white text-transparent hover:border-zinc-400"
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <h2 className="text-[14px] font-semibold text-zinc-700">{d.product}</h2>
                        </div>
                          {selectedProducts.has(d.id) ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setSaveAmounts(prev => ({ ...prev, [d.id]: Math.max(1, (prev[d.id] ?? remaining) - 1) }))}
                                className="w-6 h-6 rounded border border-zinc-200 bg-white text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 flex items-center justify-center"
                              >−</button>
                              <input
                                type="number"
                                min={1}
                                max={remaining}
                                value={saveAmounts[d.id] ?? remaining}
                                onChange={e => {
                                  const raw = e.target.value;
                                  if (raw === "") {
                                    setSaveAmounts(prev => ({ ...prev, [d.id]: 1 }));
                                    return;
                                  }
                                  const v = parseInt(raw, 10);
                                  if (isNaN(v)) return;
                                  setSaveAmounts(prev => ({ ...prev, [d.id]: Math.max(1, Math.min(remaining, v)) }));
                                }}
                                className="w-14 text-center font-mono text-[13px] font-semibold text-zinc-900 rounded border border-zinc-200 bg-white px-1 py-0.5 outline-none focus:border-emerald-500"
                              />
                              <button
                                onClick={() => setSaveAmounts(prev => ({ ...prev, [d.id]: Math.min(remaining, (prev[d.id] ?? remaining) + 1) }))}
                                className="w-6 h-6 rounded border border-zinc-200 bg-white text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 flex items-center justify-center"
                              >+</button>
                              <span className="text-[11px] text-zinc-400 font-mono">/ {d.qty}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-400 font-mono">×{remaining} / {d.qty} · {allRecipes.length} recipe{allRecipes.length > 1 ? "s" : ""}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {allRecipes.map(r => {
                          const isPrepared = preMixPrepared.has(`${d.id}:::${r!.productName.toLowerCase()}`);
                          const ingCount = r!.ingredients.length;
                          const pkgCount = (r!.packagingMaterials ?? []).length;
                          const decoCount = (r!.decorationSupplies ?? []).length;

                          return (
                            <div
                              key={r!.productName}
                              className={`rounded-2xl border p-4 transition-all ${
                                isPrepared
                                  ? "border-emerald-200 bg-emerald-50/50"
                                  : "border-zinc-200 bg-white"
                              }`}
                            >
                              <button
                                onClick={() => {
                                  setSelectedRecipeModal({ recipe: r!, dosProduct: d.product, dosId: d.id, maxQty: d.qty });
                                  const initialDraft: Record<string, number> = {};
                                  r!.ingredients.forEach(ing => { initialDraft[ing.name] = ing.qtyPerBatch; });
                                  setRecipeModalDraft(initialDraft);
                                }}
                                className="text-left w-full"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <h3 className="text-[14px] font-semibold text-zinc-900 truncate">{r!.productName}</h3>
                                  {isPrepared && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-medium text-emerald-700">Done</span>}
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {ingCount > 0 && <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 rounded px-1.5 py-0.5">{ingCount} ingredients</span>}
                                  {pkgCount > 0 && <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 rounded px-1.5 py-0.5">{pkgCount} packaging</span>}
                                  {decoCount > 0 && <span className="text-[10px] bg-purple-50 border border-purple-200 text-purple-700 rounded px-1.5 py-0.5">{decoCount} deco</span>}
                                </div>
                                <div className="text-[10px] text-zinc-400 mt-3">Tap to view recipe →</div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Freezer Action Bar for Pre-Mix in Dashboard */}
            {selectedRecipes.size > 0 && (
              <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
                  <span className="text-[13px] font-medium text-zinc-700 shrink-0">{selectedRecipes.size} recipe{selectedRecipes.size > 1 ? "s" : ""} selected</span>
                  <div className="flex-1" />
                  <button
                    onClick={() => {
                      const batchRef = `DEC-${Date.now()}`;
                      const allItems: FreezerItem[] = [];
                      const newQty = { ...productQty };
                      let workingInv: InventoryItem[] = inventory;
                      const allDeductions: string[] = [];
                      const allSkipped: string[] = [];
                      selectedProducts.forEach(dosId => {
                        const dos = dosForDeco.find(dd => dd.id === dosId);
                        if (!dos) return;
                        const dosQty = saveAmounts[dos.id] ?? (productQty[dos.id] ?? dos.qty);
                        const existingItem = freezerItems.find(fi => fi.productName === dos.product && fi.producedBy === "deco" && fi.notes?.startsWith("Production Recipe"));
                        if (existingItem) {
                          const updatedItem = { ...existingItem, qty: existingItem.qty + dosQty };
                          onUpdateFreezer?.(prev => prev.map(fi => fi.id === updatedItem.id ? updatedItem : fi));
                          db.upsertFreezerItems([updatedItem]).catch(err => console.error("Freezer update failed:", err));
                        } else {
                          allItems.push({
                            id: `FRZ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            productName: dos.product,
                            batchRef,
                            qty: dosQty,
                            unit: "pcs",
                            status: "stored" as const,
                            producedBy: "deco",
                            dateProduced: new Date().toISOString(),
                            notes: `Production Recipe`,
                          });
                        }
                        newQty[dos.id] = Math.max(0, (productQty[dos.id] ?? dos.qty) - dosQty);
                        const linkedRecipes = (findRecipe(dos.product)?.linkedIngredients ?? [])
                          .map(name => recipes.find(r => r.productName === name))
                          .filter(Boolean);
                        linkedRecipes.forEach(r => {
                          const preparedKey = `${dos.id}:::${r!.productName.toLowerCase()}`;
                          setPreMixPrepared(prev => new Set(prev).add(preparedKey));
                        });
                        const productRecipes = getRecipesForProduct(dos.product);
                        const findInventoryMatch = (ingredient: { name: string; inventoryId?: string; sku?: string }): InventoryItem | undefined => {
                          if (ingredient.inventoryId) {
                            const direct = workingInv.find(i => i.id === ingredient.inventoryId);
                            if (direct) return direct;
                          }
                          const ingLower = ingredient.name.toLowerCase().trim();
                          let match = workingInv.find(i => i.name.toLowerCase().trim() === ingLower);
                          if (match) return match;
                          match = workingInv.find(i => i.name.toLowerCase().includes(ingLower) || ingLower.includes(i.name.toLowerCase()));
                          if (match) return match;
                          if (ingredient.sku) match = workingInv.find(i => i.sku === ingredient.sku);
                          return match;
                        };
                        productRecipes.forEach(recipe => {
                          (recipe.ingredients ?? []).forEach(ing => {
                            const match = findInventoryMatch(ing);
                            if (!match) {
                              const invNames = workingInv.map(i => i.name).slice(0, 8).join(", ");
                              allSkipped.push(`${ing.name} (no inventory link — available: ${invNames}${workingInv.length > 8 ? "..." : ""})`);
                              return;
                            }
                            const idx = workingInv.findIndex(i => i.id === match.id);
                            const needed = ing.qtyPerBatch * dosQty;
                            const before = workingInv[idx].onHand;
                            workingInv = workingInv.map((it, i) => i === idx ? { ...it, onHand: Math.max(0, before - needed) } : it);
                            const actualDeducted = before - workingInv[idx].onHand;
                            allDeductions.push(`Ing: ${ing.name} -${actualDeducted}${ing.unit}`);
                          });
                        });
                      });
                      setProductQty(newQty);
                      setSaveAmounts({});
                      if (onUpdateFreezer && allItems.length > 0) {
                        onUpdateFreezer(prev => [...prev, ...allItems]);
                        db.upsertFreezerItems(allItems).catch(err => {
                          console.error("Freezer save failed:", err);
                          onAddAuditLog?.("FREEZER_ERROR", `Failed to save ${allItems.length} items: ${err.message}`);
                        });
                      }
                      if (allDeductions.length > 0 || allSkipped.length > 0) {
                        onUpdateInventory?.(workingInv);
                        const changedItems = workingInv.filter(item => {
                          const orig = inventory.find(o => o.id === item.id);
                          return orig && Math.abs(orig.onHand - item.onHand) > 0.0001;
                        });
                        if (changedItems.length > 0) {
                          db.upsertInventory(changedItems).catch(err => console.error("Inventory deduction save failed:", err));
                          changedItems.forEach(item => {
                            const orig = inventory.find(o => o.id === item.id);
                            if (orig && orig.onHand > item.onHand) {
                              onStockTransaction?.({ id: `STX-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, type: "out", itemName: item.name, itemId: item.id, qty: orig.onHand - item.onHand, unit: item.unit, reference: `Production Recipe`, timestamp: new Date().toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), target: "deco", group: item.group, role: "deco" });
                            }
                          });
                        }
                        if (allDeductions.length > 0) onAddAuditLog?.("INGREDIENTS_DEDUCTED", `Put in Production Recipe: ${allDeductions.join(", ")}`);
                        if (allSkipped.length > 0) onAddAuditLog?.("DEDUCTION_SKIPPED", `Put in Production Recipe: ${allSkipped.join(", ")}`);
                      }
                      onAddAuditLog?.("FREEZER_ADDED", `Items saved to Production Recipe freezer`);
                      setSelectedRecipes(new Set());
                      setSelectedProducts(new Set());
                    }}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-[12px] font-medium text-white hover:bg-emerald-700 transition-all"
                  >Put in Production Recipe</button>
                  <button
                    onClick={() => {
                      const allNewItems: InventoryItem[] = [];
                      const allUpdatedItems: InventoryItem[] = [];
                      const newQty = { ...productQty };
                      let workingInv: InventoryItem[] = inventory;
                      const allDeductions: string[] = [];
                      const allSkipped: string[] = [];
                      selectedProducts.forEach(dosId => {
                        const dos = dosForDeco.find(dd => dd.id === dosId);
                        if (!dos) return;
                        const dosQty = saveAmounts[dos.id] ?? (productQty[dos.id] ?? dos.qty);
                        const existingItem = workingInv.find(i => i.name === dos.product && i.accessRoles?.includes("deco"));
                        if (existingItem) {
                          const updatedItem = { ...existingItem, onHand: existingItem.onHand + dosQty, source: "production-prep" as const };
                          const idx = workingInv.indexOf(existingItem);
                          workingInv = [...workingInv.slice(0, idx), updatedItem, ...workingInv.slice(idx + 1)];
                          allUpdatedItems.push(updatedItem);
                        } else {
                          const newItem: InventoryItem = {
                            id: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            name: dos.product,
                            sku: `DECO-${dos.product.substring(0, 8).toUpperCase()}-${Date.now()}`,
                            unit: "pcs",
                            onHand: dosQty,
                            threshold: 0,
                            cost: 0,
                            supplier: "",
                            lastIn: new Date().toISOString(),
                            category: "dry" as const,
                            group: "ingredients" as const,
                            accessRoles: ["deco"] as Role[],
                            source: "production-prep" as const,
                          };
                          workingInv = [...workingInv, newItem];
                          allNewItems.push(newItem);
                        }
                        newQty[dos.id] = Math.max(0, (productQty[dos.id] ?? dos.qty) - dosQty);
                        const linkedRecipes = (findRecipe(dos.product)?.linkedIngredients ?? [])
                          .map(name => recipes.find(r => r.productName === name))
                          .filter(Boolean);
                        linkedRecipes.forEach(r => {
                          const preparedKey = `${dos.id}:::${r!.productName.toLowerCase()}`;
                          setPreMixPrepared(prev => new Set(prev).add(preparedKey));
                        });
                        const productRecipes = getRecipesForProduct(dos.product);
                        const findInventoryMatch = (ingredient: { name: string; inventoryId?: string; sku?: string }): InventoryItem | undefined => {
                          if (ingredient.inventoryId) {
                            const direct = workingInv.find(i => i.id === ingredient.inventoryId);
                            if (direct) return direct;
                          }
                          const ingLower = ingredient.name.toLowerCase().trim();
                          let match = workingInv.find(i => i.name.toLowerCase().trim() === ingLower);
                          if (match) return match;
                          match = workingInv.find(i => i.name.toLowerCase().includes(ingLower) || ingLower.includes(i.name.toLowerCase()));
                          if (match) return match;
                          if (ingredient.sku) match = workingInv.find(i => i.sku === ingredient.sku);
                          return match;
                        };
                        productRecipes.forEach(recipe => {
                          (recipe.ingredients ?? []).forEach(ing => {
                            const match = findInventoryMatch(ing);
                            if (!match) {
                              const invNames = workingInv.map(i => i.name).slice(0, 8).join(", ");
                              allSkipped.push(`${ing.name} (no inventory link — available: ${invNames}${workingInv.length > 8 ? "..." : ""})`);
                              return;
                            }
                            const idx = workingInv.findIndex(i => i.id === match.id);
                            const needed = ing.qtyPerBatch * dosQty;
                            const before = workingInv[idx].onHand;
                            workingInv = workingInv.map((it, i) => i === idx ? { ...it, onHand: Math.max(0, before - needed) } : it);
                            const actualDeducted = before - workingInv[idx].onHand;
                            allDeductions.push(`Ing: ${ing.name} -${actualDeducted}${ing.unit}`);
                          });
                        });
                      });
                      setProductQty(newQty);
                      setSaveAmounts({});
                      onUpdateInventory?.(workingInv);
                      const persistIds = new Set([...allUpdatedItems.map(i => i.id), ...allNewItems.map(i => i.id)]);
                      const changedByDeduction = workingInv.filter(item => {
                        if (persistIds.has(item.id)) return false;
                        const orig = inventory.find(o => o.id === item.id);
                        return orig && Math.abs(orig.onHand - item.onHand) > 0.0001;
                      });
                      const allToPersist = [...allUpdatedItems, ...allNewItems, ...changedByDeduction];
                      if (allToPersist.length > 0) {
                        db.upsertInventory(allToPersist).catch(err => console.error("Inventory save failed:", err));
                        changedByDeduction.forEach(item => {
                          const orig = inventory.find(o => o.id === item.id);
                          if (orig && orig.onHand > item.onHand) {
                            onStockTransaction?.({ id: `STX-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, type: "out", itemName: item.name, itemId: item.id, qty: orig.onHand - item.onHand, unit: item.unit, reference: `Put in My Inventory`, timestamp: new Date().toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), target: "deco", group: item.group, role: "deco" });
                          }
                        });
                      }
                      if (allDeductions.length > 0) onAddAuditLog?.("INGREDIENTS_DEDUCTED", `Put in My Inventory: ${allDeductions.join(", ")}`);
                      if (allSkipped.length > 0) onAddAuditLog?.("DEDUCTION_SKIPPED", `Put in My Inventory: ${allSkipped.join(", ")}`);
                      onAddAuditLog?.("INVENTORY_ADDED", `Items added to My Inventory`);
                      setSelectedRecipes(new Set());
                      setSelectedProducts(new Set());
                    }}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-[12px] font-medium text-white hover:bg-blue-700 transition-all"
                  >Put in My Inventory</button>
                </div>
              </div>
            )}

            {/* Workflow Nav inside Pre-Mix */}
            <div className="flex items-center justify-end pt-4 border-t border-zinc-200">
              <div className="text-[12px] text-zinc-400">Step 2 of 4</div>
            </div>
          </div>
        ) : (<>
          <div className="rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-8 shadow-lg">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-[36px] font-bold tracking-tight text-white">DOS Received</h1>
              <p className="mt-2 text-[15px] text-zinc-400">Admin issued these items. Your job is to prepare the Pre-Mix (ingredient pre-mixes) for each product.</p>
            </div>
            {dosForDeco.length > 0 && (
              <div className="shrink-0 rounded-2xl bg-white/10 px-6 py-4 text-center border border-white/10">
                <div className="text-[12px] text-zinc-400 uppercase font-semibold tracking-wider">DOS Total</div>
                <div className="text-[32px] font-bold text-white mt-1" style={{ fontFamily: "Fragment Mono, monospace" }}>{dosForDeco.reduce((s, d) => s + d.qty, 0)}</div>
                <div className="text-[12px] text-zinc-500 mt-1">{dosForDeco.length} item{dosForDeco.length > 1 ? "s" : ""}</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            <button onClick={() => setSummaryModal("products")} className="rounded-2xl border border-zinc-700 bg-zinc-800/80 p-5 text-left hover:border-zinc-500 hover:shadow-md transition-all">
              <div className="text-[13px] text-zinc-400 uppercase tracking-wider font-semibold">Products to Mix</div>
              <div className="text-[32px] font-bold mt-2 text-white">{dosForDeco.length}</div>
              <div className="text-[12px] text-zinc-500 mt-2">Click to view →</div>
            </button>
            <button onClick={() => setSummaryModal("ingredients")} className="rounded-2xl border border-rose-800 bg-rose-950/50 p-5 text-left hover:border-rose-600 hover:shadow-md transition-all">
              <div className="text-[13px] text-rose-400 uppercase tracking-wider font-semibold">Premix Needed</div>
              <div className="text-[32px] font-bold mt-2 text-rose-300">{totalNeeded}</div>
              <div className="text-[12px] text-rose-500 mt-2">Click to view →</div>
            </button>
            <button onClick={() => setSummaryModal("packaging")} className="rounded-2xl border border-blue-800 bg-blue-950/50 p-5 text-left hover:border-blue-600 hover:shadow-md transition-all">
              <div className="text-[13px] text-blue-400 uppercase tracking-wider font-semibold">Packaging Materials</div>
              <div className="text-[32px] font-bold mt-2 text-blue-300">{totalPkg}</div>
              <div className="text-[12px] text-blue-500 mt-2">Click to view →</div>
            </button>
            <button onClick={() => setSummaryModal("deco")} className="rounded-2xl border border-purple-800 bg-purple-950/50 p-5 text-left hover:border-purple-600 hover:shadow-md transition-all">
              <div className="text-[13px] text-purple-400 uppercase tracking-wider font-semibold">Deco Supplies</div>
              <div className="text-[32px] font-bold mt-2 text-purple-300">{totalDecoItems}</div>
              <div className="text-[12px] text-purple-500 mt-2">Click to view →</div>
            </button>
          </div>
        </div>

        {dosForDeco.length === 0 ? (
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-10 text-center"><p className="text-[14px] text-zinc-400">No DOS items assigned for today.</p></div>
        ) : (() => {
          const recipeMap = new Map<string, { recipe: ProductRecipe; totalQty: number }>();
          const fallbackRecipe = (name: string, qty: number): { recipe: ProductRecipe; totalQty: number } => ({
            recipe: {
              productId: name, productName: name,
              ingredients: [], packagingMaterials: [], decorationSupplies: [],
              linkedIngredients: [], yield: 1,
            },
            totalQty: qty,
          });
          dosForDeco.forEach(d => {
            const directRecipe = findRecipe(d.product);
            const linkedNames = (directRecipe?.linkedIngredients ?? [])
              .filter(n => n.toLowerCase() !== d.product.toLowerCase());
            // 1) Show linked sub-recipe names (even if no recipe entry exists)
            if (linkedNames.length > 0) {
              linkedNames.forEach(name => {
                const key = name.toLowerCase();
                const candidates = recipes.filter(r => r.productName.toLowerCase() === key);
                const existing = candidates.find(r => (r.linkedIngredients ?? []).length > 0) ?? candidates[0];
                if (recipeMap.has(key)) {
                  recipeMap.get(key)!.totalQty += d.qty;
                } else if (existing) {
                  recipeMap.set(key, { recipe: existing, totalQty: d.qty });
                } else {
                  recipeMap.set(key, fallbackRecipe(name, d.qty));
                }
              });
              return;
            }
            // 2) Show direct recipe if it has actual ingredients
            if (directRecipe && directRecipe.ingredients.length > 0) {
              const key = directRecipe.productName.toLowerCase();
              if (recipeMap.has(key)) {
                recipeMap.get(key)!.totalQty += d.qty;
              } else {
                recipeMap.set(key, { recipe: directRecipe, totalQty: d.qty });
              }
              return;
            }
            // 3) Fallback: show product name so no DOS item is silently dropped
            const key = d.product.toLowerCase();
            if (recipeMap.has(key)) {
              recipeMap.get(key)!.totalQty += d.qty;
            } else {
              recipeMap.set(key, fallbackRecipe(d.product, d.qty));
            }
          });
          const mergedRecipes = [...recipeMap.values()];
          if (mergedRecipes.length === 0) {
            return <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-10 text-center"><p className="text-[14px] text-zinc-400">No recipes linked to DOS items.</p></div>;
          }
          return (
          <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700 bg-zinc-800 text-left text-[13px] font-semibold text-zinc-300 uppercase tracking-wider">
                  <th className="px-5 py-4">Recipe</th>
                  <th className="px-5 py-4 text-right">Premix</th>
                  <th className="px-5 py-4 text-right">Yield/Batch</th>
                  <th className="px-5 py-4 text-right">Total Qty</th>
                  <th className="px-5 py-4 text-right">EST Prod. Total QTY</th>
                </tr>
              </thead>
              <tbody>
                {mergedRecipes.map(({ recipe, totalQty }) => {
                  const yieldPerBatch = recipe.yield || 1;
                  const batchesNeeded = Math.ceil(totalQty / yieldPerBatch);
                  const estProdTotal = batchesNeeded * yieldPerBatch;
                  return (
                  <tr key={recipe.productName} onClick={() => setViewingDOSRecipe({ recipe, totalQty })} className="border-b border-zinc-800 text-[15px] hover:bg-zinc-800/50 transition-colors cursor-pointer">
                    <td className="px-5 py-4 font-semibold text-zinc-100">{recipe.productName}</td>
                    <td className="px-5 py-4 text-right font-bold text-zinc-300">{recipe.ingredients.length}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-zinc-300">{yieldPerBatch}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-zinc-200">{totalQty}</td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-emerald-300 text-[17px]">{estProdTotal}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          );
        })()}

        {/* DOS Recipe Detail Modal */}
        {viewingDOSRecipe && (
          <DOSRecipeDetailModal
            recipe={viewingDOSRecipe.recipe}
            totalQty={viewingDOSRecipe.totalQty}
            onClose={() => setViewingDOSRecipe(null)}
          />
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
                  <div key={d.id} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/50 px-5 py-4 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[18px] font-bold text-zinc-900">{d.product}</span>
                      <span className="text-[20px] font-mono font-bold text-zinc-500">×{d.qty}</span>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${d.priority === "HIGH" ? "bg-red-100 text-red-700" : d.priority === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>{d.priority}</span>
                  </div>
                ))}
                {summaryModal === "ingredients" && dosForDeco.map(d => {
                  const directRecipe = findRecipe(d.product);
                  const linkedRecipes = (directRecipe?.linkedIngredients ?? [])
                    .map(name => recipes.find(r => r.productName === name))
                    .filter(Boolean)
                    .filter(r => r!.productName !== d.product);
                  if (linkedRecipes.length === 0) return null;
                  return (
                    <div key={d.id} className="rounded-2xl border border-rose-200 bg-rose-50/50 px-5 py-4 mb-3">
                      {linkedRecipes.map(recipe => (
                        <div key={recipe!.productName} className="mb-4 last:mb-0">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-[18px] font-bold text-zinc-900">{recipe!.productName}</span>
                            <span className="text-[20px] font-mono font-bold text-rose-600">×{d.qty}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {(recipe!.ingredients ?? []).map((ing, idx) => (
                              <div key={ing.inventoryId} className="flex items-center gap-2 rounded-xl bg-white border border-rose-200 px-3 py-2 shadow-sm">
                                <span className="flex-none w-6 h-6 rounded-lg bg-rose-100 text-rose-600 text-[12px] font-bold flex items-center justify-center">{idx + 1}</span>
                                <span className="text-[14px] font-semibold text-zinc-800 truncate">{ing.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {summaryModal === "packaging" && dosForDeco.flatMap(d => {
                  const directRecipe = findRecipe(d.product);
                  const linkedRecipes = (directRecipe?.linkedIngredients ?? [])
                    .map(name => recipes.find(r => r.productName === name))
                    .filter(Boolean)
                    .filter(r => r!.productName !== d.product);
                  const allRecipes = linkedRecipes;
                  const pkgMap = new Map<string, { product: string; name: string; qty: number; unit: string; key: string }>();
                  allRecipes.forEach(r => {
                    (r!.packagingMaterials ?? []).forEach(mat => {
                      const pk = mat.name.toLowerCase();
                      if (!pkgMap.has(pk)) {
                        pkgMap.set(pk, { product: d.product, name: mat.name, qty: mat.qtyPerBatch, unit: mat.unit, key: `${d.id}-pkg-${pk}` });
                      } else {
                        pkgMap.get(pk)!.qty += mat.qtyPerBatch;
                      }
                    });
                  });
                  return [...pkgMap.values()];
                }).map(item => (
                  <div key={item.key} className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50/50 px-5 py-4 mb-3">
                    <div>
                      <span className="text-[18px] font-bold text-zinc-900">{item.name}</span>
                      <span className="ml-3 text-[14px] text-blue-500 font-medium">for {item.product}</span>
                    </div>
                    <span className="text-[16px] font-mono font-semibold text-blue-600">{item.qty} {item.unit}</span>
                  </div>
                ))}
                {summaryModal === "deco" && dosForDeco.flatMap(d => {
                  const directRecipe = findRecipe(d.product);
                  const linkedRecipes = (directRecipe?.linkedIngredients ?? [])
                    .map(name => recipes.find(r => r.productName === name))
                    .filter(Boolean)
                    .filter(r => r!.productName !== d.product);
                  const allRecipes = linkedRecipes;
                  const decoMap = new Map<string, { product: string; name: string; qty: number; unit: string; key: string }>();
                  allRecipes.forEach(r => {
                    (r!.decorationSupplies ?? []).forEach(sup => {
                      const dk = sup.name.toLowerCase();
                      if (!decoMap.has(dk)) {
                        decoMap.set(dk, { product: d.product, name: sup.name, qty: sup.qtyPerBatch, unit: sup.unit, key: `${d.id}-deco-${dk}` });
                      } else {
                        decoMap.get(dk)!.qty += sup.qtyPerBatch;
                      }
                    });
                  });
                  return [...decoMap.values()];
                }).map(item => (
                  <div key={item.key} className="flex items-center justify-between rounded-2xl border border-purple-200 bg-purple-50/50 px-5 py-4 mb-3">
                    <div>
                      <span className="text-[18px] font-bold text-zinc-900">{item.name}</span>
                      <span className="ml-3 text-[14px] text-purple-500 font-medium">for {item.product}</span>
                    </div>
                    <span className="text-[16px] font-mono font-semibold text-purple-600">{item.qty} {item.unit}</span>
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
          <div className="text-[12px] text-zinc-400">Step 1 of 5</div>
          <button
            onClick={() => setActiveTab("tasks-to-prepare")}
            className="rounded-2xl bg-zinc-900 px-8 py-3.5 text-[15px] font-semibold text-white hover:bg-zinc-800 transition-all shadow-lg hover:shadow-xl"
          >
            Next: Tasks to Prepare →
          </button>
        </div>
        </>)}
      </div>
    );
  }

  /* ── Tasks to Prepare ── */
  if (activeTab === "tasks-to-prepare") {
    const getRecipesForProduct = (product: string): ProductRecipe[] => {
      const direct = findRecipe(product);
      const result: ProductRecipe[] = [];
      const seen = new Set<string>();
      if (direct) {
        const subRecipes = (direct.linkedIngredients ?? [])
          .map(name => recipes.find(r => r.productName === name))
          .filter((r): r is ProductRecipe => !!r);
        if (subRecipes.length > 0) {
          subRecipes.forEach(r => { if (!seen.has(r.productName)) { result.push(r); seen.add(r.productName); } });
        } else {
          result.push(direct);
          seen.add(direct.productName);
        }
      }
      // Reverse lookup: recipes whose linkedIngredients include this product
      recipes.forEach(r => {
        if (r.productName !== product && (r.linkedIngredients ?? []).includes(product) && !seen.has(r.productName)) {
          result.push(r);
          seen.add(r.productName);
        }
      });
      return result;
    };

    // TASK LIST VIEW — aggregated by recipe like Deco DOS Production Plan
    if (!activePreparation) {
      // Aggregate all DOS items by recipe (matching Deco DOS merge logic)
      const recipeAggMap = new Map<string, {
        recipe: ProductRecipe;
        totalQty: number;
        dosItems: DOSItem[];
        prepKeys: string[];
        allDone: boolean;
        routes: Set<string>;
      }>();
      dosForDeco.forEach(d => {
        const allRecipes = getRecipesForProduct(d.product);
        if (allRecipes.length === 0) return;
        allRecipes.forEach(recipe => {
          const key = recipe.productName;
          if (!recipeAggMap.has(key)) {
            recipeAggMap.set(key, { recipe, totalQty: 0, dosItems: [], prepKeys: [], allDone: false, routes: new Set() });
          }
          const entry = recipeAggMap.get(key)!;
          entry.totalQty += d.qty;
          entry.dosItems.push(d);
          entry.prepKeys.push(d.id + ":::" + recipe.productName.toLowerCase());
          entry.routes.add(productRoutes[d.product] || "baker");
        });
      });
      // Mark allDone when every prepKey for this recipe is in preMixDone
      recipeAggMap.forEach(entry => {
        entry.allDone = entry.prepKeys.every(k => preMixDone.has(k));
      });

    return (
      <div className="max-w-5xl mx-auto space-y-6 bg-zinc-950 p-6 rounded-2xl">
          {toast && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }} onClick={() => setToast(null)}>
              <div className="flex flex-col items-center rounded-2xl bg-white px-8 py-7 shadow-2xl" style={{ minWidth: 360, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${toast.type === "success" ? "bg-emerald-100" : "bg-red-100"}`}>
                  <span className={`text-[28px] ${toast.type === "success" ? "text-emerald-600" : "text-red-600"}`}>{toast.type === "success" ? "✓" : "✗"}</span>
                </div>
                <h3 className="text-[16px] font-semibold text-zinc-900">{toast.type === "success" ? "Success" : "Error"}</h3>
                <p className="mt-1.5 text-center text-[13px] leading-relaxed text-zinc-500">{toast.message}</p>
                <button onClick={() => setToast(null)} className="mt-5 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-colors">Got it</button>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-zinc-900 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => setActiveTab("dashboard")} className="rounded-xl bg-zinc-800 px-3.5 py-2 text-[12px] font-medium text-zinc-300 hover:bg-zinc-700 transition-all flex items-center gap-1.5">← Back</button>
              <h1 className="text-[28px] font-semibold tracking-tight text-white">Tasks to Prepare Today</h1>
            </div>
            <p className="mt-1 text-[13px] text-zinc-400 pl-1">View and prepare DOS items assigned to your team.</p>
          </div>

          {recipeAggMap.size === 0 ? (
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-10 text-center">
              <p className="text-[14px] text-zinc-400">No DOS items assigned for today.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from(recipeAggMap.entries()).map(([recipeName, entry]) => {
                const { recipe, totalQty, dosItems, allDone, routes } = entry;
                const yieldPerBatch = recipe.yield || 1;
                const batchesNeeded = Math.ceil(totalQty / yieldPerBatch);
                const estProdTotal = batchesNeeded * yieldPerBatch;
                const activeDOS = dosItems.find(d => !preMixDone.has(d.id + ":::" + recipe.productName.toLowerCase())) || dosItems[0];
                const doneCount = dosItems.filter(d => preMixDone.has(d.id + ":::" + recipe.productName.toLowerCase())).length;
                return (
                  <div key={recipeName} className={`rounded-3xl border-2 p-6 transition-all ${allDone ? "border-emerald-700/50 bg-emerald-950/30" : "border-zinc-600 bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-lg"}`}>
                        <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className={`text-[22px] font-bold ${allDone ? "text-zinc-500" : "text-white"}`}>{recipe.productName}</h3>
                          {Array.from(routes).map(r => (
                            <span key={r} className={`text-[20px] ${allDone ? "opacity-50" : ""}`}>{r === "baker" ? "🍞" : "🎂"}</span>
                          ))}
                        </div>
                        <div className={`flex items-center gap-4 mt-2 text-[15px] ${allDone ? "text-zinc-500" : "text-zinc-300"}`}>
                          <span className="flex items-center gap-1.5"><span className="text-zinc-500">Demand:</span> <span className={`font-mono font-bold ${allDone ? "text-zinc-500" : "text-white"}`}>{totalQty} pcs</span></span>
                          <span className="text-zinc-600">|</span>
                          <span className="flex items-center gap-1.5"><span className="text-zinc-500">Yield:</span> <span className={`font-mono font-bold ${allDone ? "text-zinc-500" : "text-white"}`}>{yieldPerBatch} pcs/batch</span></span>
                          <span className="text-zinc-600">|</span>
                          <span className="flex items-center gap-1.5"><span className="text-zinc-500">Expected:</span> <span className={`font-mono font-bold ${allDone ? "text-zinc-500" : "text-emerald-400"}`}>{estProdTotal} pcs</span></span>
                        </div>
                        <div className={`text-[12px] mt-2 px-3 py-1.5 rounded-lg inline-block ${allDone ? "bg-zinc-800 text-zinc-600" : "bg-zinc-700/50 text-zinc-400"}`}>CEIL({totalQty} ÷ {yieldPerBatch}) = {batchesNeeded} batch × {yieldPerBatch} = {estProdTotal}</div>
                        {dosItems.length > 1 && (
                          <div className={`text-[12px] mt-2 leading-relaxed ${allDone ? "text-zinc-600" : "text-zinc-400"}`}>
                            From: {dosItems.map((d, i) => {
                              const pk = d.id + ":::" + recipe.productName.toLowerCase();
                              const dDone = preMixDone.has(pk);
                              return <span key={d.id} className={dDone ? "text-emerald-400" : ""}>{i > 0 ? ", " : ""}{d.product} ({d.qty} pcs{dDone ? " ✓" : ""})</span>;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3 items-center pt-3 border-t border-zinc-700/50">
                      <button onClick={() => setViewingDOSRecipe({ recipe, totalQty })} className={`rounded-xl border-2 px-4 py-2.5 text-[13px] font-semibold transition-all ${allDone ? "border-zinc-700 text-zinc-500 cursor-not-allowed" : "border-zinc-500 text-zinc-200 hover:bg-zinc-700 hover:border-zinc-400"}`} disabled={allDone}>View Premix</button>
                      {allDone ? (
                        <button disabled className="rounded-xl bg-emerald-800/40 px-5 py-2.5 text-[13px] font-semibold text-emerald-400/70 cursor-not-allowed">✓ Completed</button>
                      ) : (
                        <>
                          <button onClick={() => { const activeRoute: "baker" | "deco" = productRoutes[activeDOS.product] === "deco" ? "deco" : "baker"; setActivePreparation({ dos: activeDOS, recipe, route: activeRoute, demandQty: totalQty }); setAdditionalIngredients([]); }} className={`rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition-all shadow-md ${productRoutes[activeDOS.product] === "deco" ? "bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-rose-900/30" : "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 shadow-amber-900/30"}`}>{productRoutes[activeDOS.product] === "deco" ? "Start Preparation" : "Start Pre-Mix"}</button>
                          {doneCount > 0 && <span className="text-[12px] font-medium text-zinc-400">{doneCount}/{dosItems.length} done</span>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewingDOSRecipe && (
            <DOSRecipeDetailModal
              recipe={viewingDOSRecipe.recipe}
              totalQty={viewingDOSRecipe.totalQty}
              onClose={() => setViewingDOSRecipe(null)}
            />
          )}

          <div className="flex items-center justify-end pt-4 border-t border-zinc-700">
            <div className="text-[12px] text-zinc-500">Step 2 of 5</div>
          </div>
        </div>
      );
    }

    // PREPARATION VIEW
    const { dos, recipe, demandQty } = activePreparation;
    const prepDemandQty = demandQty ?? dos.qty;
    const linkedRecipesForPrep = (recipe.linkedIngredients ?? [])
      .map(name => recipes.find(r => r.productName === name))
      .filter((r): r is ProductRecipe => !!r);
    const allIngredientsForPrep = recipe.ingredients;
    const yieldPerBatch = recipe.yield || linkedRecipesForPrep.find(r => r.yield && r.yield > 1)?.yield || 1;
    const batchesNeeded = Math.ceil(prepDemandQty / yieldPerBatch);
    const expectedOutput = batchesNeeded * yieldPerBatch;
    const prepKey = dos.id + ":::" + dos.product.toLowerCase();
    const savedAddIngs = preMixDone.has(prepKey) ? [] : (productAdditionalIngredients[prepKey] || []);

    const handleComplete = () => {
      const output = expectedOutput;
      const oldSavedIngs = productAdditionalIngredients[prepKey] || [];
      const finalAddIngs = [...oldSavedIngs, ...additionalIngredients];
      setProductAdditionalIngredients(prev => ({ ...prev, [prepKey]: finalAddIngs }));
      // Immediately save deco production prep to Supabase so Admin can see it
      const allLinkedRecipes = (recipe.linkedIngredients ?? [])
        .map(name => recipes.find(r => r.productName === name))
        .filter((r): r is ProductRecipe => !!r)
        .filter(r => r.productName !== dos.product);
      const allProductKeys: { dosId: string; productName: string }[] = [];
      if (allLinkedRecipes.length === 0) {
        allProductKeys.push({ dosId: dos.id, productName: dos.product });
      }
      allLinkedRecipes.forEach(r => {
        allProductKeys.push({ dosId: dos.id, productName: r.productName });
      });
      // Mark done for ALL keys that task cards check (matches getRecipesForProduct logic)
      const dosDirect = findRecipe(dos.product);
      const taskCardRecipes: ProductRecipe[] = [];
      const taskCardSeen = new Set<string>();
      if (dosDirect) {
        const subRecipes = (dosDirect.linkedIngredients ?? [])
          .map(n => recipes.find(r => r.productName === n))
          .filter((r): r is ProductRecipe => !!r);
        if (subRecipes.length > 0) {
          subRecipes.forEach(r => { if (!taskCardSeen.has(r.productName)) { taskCardRecipes.push(r); taskCardSeen.add(r.productName); } });
        } else {
          taskCardRecipes.push(dosDirect);
          taskCardSeen.add(dosDirect.productName);
        }
      }
      recipes.forEach(r => {
        if (r.productName !== dos.product && (r.linkedIngredients ?? []).includes(dos.product) && !taskCardSeen.has(r.productName)) {
          taskCardRecipes.push(r);
          taskCardSeen.add(r.productName);
        }
      });
      const taskCardKeys = taskCardRecipes.map(r => `${dos.id}:::${r.productName.toLowerCase()}`);
      // When demandQty is set (aggregated prep), mark ALL DOS items for this recipe as done in one shot
      const allRecipeDOSKeys = demandQty
        ? dosForDeco
            .filter(d => {
              const recipes = getRecipesForProduct(d.product);
              return recipes.some(r => r.productName === recipe.productName);
            })
            .map(d => `${d.id}:::${recipe.productName.toLowerCase()}`)
        : taskCardKeys;
      setPreMixDone(prev => new Set([...prev, ...allRecipeDOSKeys, ...allProductKeys.map(k => `${k.dosId}:::${k.productName.toLowerCase()}`)]));
      const updatedAddIngs = { ...productAdditionalIngredients, [prepKey]: finalAddIngs };
      // Collect prep items for ALL DOS items of this recipe when aggregated
      const prepDosItems = demandQty
        ? dosForDeco.filter(d => {
            const recipes = getRecipesForProduct(d.product);
            return recipes.some(r => r.productName === recipe.productName);
          })
        : [dos];
      const prepItems = prepDosItems.flatMap(d => {
        const dosId = d.id;
        return allProductKeys.length > 0
          ? allProductKeys.map(({ dosId: _, productName }) => {
              const key = `${dosId}:::${productName.toLowerCase()}`;
              return {
                dosId,
                productName,
                productQty: productQty[dosId] ?? prepDemandQty,
                prepared: true,
                done: true,
                additionalIngredients: updatedAddIngs[key] ?? [],
              };
            })
          : [{
              dosId,
              productName: recipe.productName,
              productQty: productQty[dosId] ?? prepDemandQty,
              prepared: true,
              done: true,
              additionalIngredients: updatedAddIngs[`${dosId}:::${recipe.productName.toLowerCase()}`] ?? [],
            }];
      });
      if (prepItems.length > 0) db.saveDecoProductionPrep(prepItems).catch(console.error);

      const newInv = inventory.map(i => ({ ...i }));
      const findMatch = (ingredient: { name: string; inventoryId?: string; sku?: string }): InventoryItem | undefined => {
        if (ingredient.inventoryId) {
          const direct = newInv.find(i => i.id === ingredient.inventoryId);
          if (direct) return direct;
        }
        const ingLower = ingredient.name.toLowerCase().trim();
        let match = newInv.find(i => i.name.toLowerCase().trim() === ingLower);
        if (match) return match;
        match = newInv.find(i => i.name.toLowerCase().includes(ingLower) || ingLower.includes(i.name.toLowerCase()));
        if (match) return match;
        if (ingredient.sku) match = newInv.find(i => i.sku === ingredient.sku);
        return match;
      };

      console.log("[Deco] handleComplete — ingredients:", allIngredientsForPrep.length, "prepDemandQty:", prepDemandQty, "inventory count:", inventory.length);
      const deductedIngredients: string[] = [];
      const missedIngredients: string[] = [];

      allIngredientsForPrep.forEach(ing => {
        const match = findMatch(ing);
        if (!match) {
          missedIngredients.push(ing.name);
          console.warn("[Deco] No inventory match for ingredient:", ing.name, "inventoryId:", ing.inventoryId);
          return;
        }
        const idx = newInv.findIndex(i => i.id === match.id);
        if (idx === -1) {
          missedIngredients.push(ing.name + " (idx -1)");
          console.error("[Deco] findIndex returned -1 for matched ingredient:", ing.name, "match.id:", match.id);
          return;
        }
        const needed = ing.qtyPerBatch * prepDemandQty;
        newInv[idx] = { ...newInv[idx], onHand: Math.max(0, newInv[idx].onHand - needed) };
        deductedIngredients.push(ing.name + " (-" + needed + " " + ing.unit + ")");
      });

      additionalIngredients.forEach(addIng => {
        const match = findMatch({ name: addIng.name });
        if (!match) {
          missedIngredients.push(addIng.name + " (additional)");
          console.warn("[Deco] No inventory match for additional ingredient:", addIng.name);
          return;
        }
        const idx = newInv.findIndex(i => i.id === match.id);
        if (idx === -1) {
          missedIngredients.push(addIng.name + " (additional, idx -1)");
          console.error("[Deco] findIndex returned -1 for matched additional ingredient:", addIng.name, "match.id:", match.id);
          return;
        }
        newInv[idx] = { ...newInv[idx], onHand: Math.max(0, newInv[idx].onHand - addIng.qty) };
        deductedIngredients.push(addIng.name + " (-" + addIng.qty + " " + addIng.unit + " additional)");
      });

      if (missedIngredients.length > 0) {
        console.warn("[Deco] Could not find inventory items for:", missedIngredients);
      }
      if (deductedIngredients.length > 0) {
        console.log("[Deco] Deducted ingredients:", deductedIngredients);
      }

      onUpdateInventory(newInv);
      const changed = newInv.filter(item => {
        const orig = inventory.find(i => i.id === item.id);
        return orig && Math.abs(orig.onHand - item.onHand) > 0.0001;
      });
      console.log("[Deco] Changed inventory items count:", changed.length, changed.map(c => c.name + ": " + (inventory.find(i => i.id === c.id)?.onHand ?? "?") + " → " + c.onHand));
      if (changed.length > 0) {
        db.upsertInventory(changed)
          .then(() => console.log("[Deco] Upserted", changed.length, "inventory items"))
          .catch(err => console.error("[Deco] Failed to upsert inventory:", err));
        changed.forEach(item => {
          const orig = inventory.find(o => o.id === item.id);
          if (orig && orig.onHand > item.onHand) {
            onStockTransaction?.({ id: `STX-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, type: "out", itemName: item.name, itemId: item.id, qty: orig.onHand - item.onHand, unit: item.unit, reference: `Decoration: ${selectedDos?.product || "task"}`, timestamp: new Date().toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), target: "deco", group: item.group, role: "deco" });
          }
        });
      }

      {
        const existingFreezer = freezerItems.find(
          i => i.productName === recipe.productName && i.producedBy === "deco" && i.notes?.startsWith("Production Recipe") && i.status === "stored"
        );
        const newIngredients = {
          standard: allIngredientsForPrep.map(ing => ({
            name: ing.name,
            qtyPerBatch: ing.qtyPerBatch,
            unit: ing.unit,
            totalUsed: ing.qtyPerBatch * prepDemandQty,
          })),
          additional: finalAddIngs.map(addIng => ({
            name: addIng.name,
            qty: addIng.qty,
            unit: addIng.unit,
            reason: addIng.reason,
          })),
        };
        if (existingFreezer) {
          const updatedItem: FreezerItem = {
            ...existingFreezer,
            qty: existingFreezer.qty + output,
            dateProduced: new Date().toISOString(),
            ingredients: {
              standard: [
                ...(existingFreezer.ingredients?.standard ?? []),
                ...newIngredients.standard,
              ],
              additional: [
                ...(existingFreezer.ingredients?.additional ?? []),
                ...newIngredients.additional,
              ],
            },
          };
          if (onUpdateFreezer) onUpdateFreezer((prev) => prev.map(i => i.id === existingFreezer.id ? updatedItem : i));
          db.upsertFreezerItems([updatedItem]).catch(console.error);
        } else {
          const freezerItem: FreezerItem = {
            id: "FRZ-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
            productName: recipe.productName,
            batchRef: "DEC-" + Date.now(),
            qty: output, unit: "pcs", status: "stored", producedBy: "deco",
            dateProduced: new Date().toISOString(), notes: "Production Recipe",
            ingredients: newIngredients,
          };
          if (onUpdateFreezer) onUpdateFreezer((prev) => [...prev, freezerItem]);
          db.upsertFreezerItems([freezerItem]).catch(console.error);
        }
        onAddAuditLog?.("TASK_COMPLETED", recipe.productName + " x" + output + " sent to Baker. Standard ingredients: " + allIngredientsForPrep.map(i => i.name).join(", ") + ". Additional ingredients: " + (finalAddIngs.length > 0 ? finalAddIngs.map(i => i.name).join(", ") : "None"));
        const deductMsg = missedIngredients.length > 0 ? " Warning: " + missedIngredients.join(", ") + " not found in inventory." : "";
        showToast(dos.product + " x" + output + " sent to Baker. " + deductedIngredients.length + " ingredient(s) deducted." + deductMsg, missedIngredients.length > 0 ? "error" : "success");
      }
      // Update production task status for all DOS items sharing this recipe
      if (onUpdateProduction) {
        const recipeDOSList = demandQty
          ? dosForDeco.filter(d => {
              const recipes = getRecipesForProduct(d.product);
              return recipes.some(r => r.productName === recipe.productName);
            })
          : [dos];
        recipeDOSList.forEach(d => {
          const task = production.find(t => t.product === d.product && t.assignedTo === "deco" && t.status !== "completed");
          if (task) onUpdateProduction(task.id, { status: "completed", completed: output });
        });
      }
      setActivePreparation(null);
    };

    return (
      <div className="max-w-5xl mx-auto space-y-6 bg-zinc-950 p-6 rounded-2xl">
        {toast && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }} onClick={() => setToast(null)}>
            <div className="flex flex-col items-center rounded-2xl bg-white px-8 py-7 shadow-2xl" style={{ minWidth: 360, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${toast.type === "success" ? "bg-emerald-100" : "bg-red-100"}`}>
                <span className={`text-[28px] ${toast.type === "success" ? "text-emerald-600" : "text-red-600"}`}>{toast.type === "success" ? "✓" : "✗"}</span>
              </div>
              <h3 className="text-[16px] font-semibold text-zinc-900">{toast.type === "success" ? "Success" : "Error"}</h3>
              <p className="mt-1.5 text-center text-[13px] leading-relaxed text-zinc-500">{toast.message}</p>
              <button onClick={() => setToast(null)} className="mt-5 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-colors">Got it</button>
            </div>
          </div>
        )}

        <button onClick={() => setActivePreparation(null)} className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-zinc-300 hover:bg-zinc-800 transition-all">
          <span className="text-[14px]">←</span> Back to Tasks
        </button>

        <div>
          <h1 className="text-[24px] font-semibold text-white">{recipe.productName}</h1>
          <p className="text-[13px] text-zinc-400 mt-1">Route: Bakery</p>
        </div>

        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
          <h3 className="text-[14px] font-bold text-zinc-200 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-zinc-400"></span> Standard Premix
          </h3>
          <div className="space-y-4">
            {/* Main recipe */}
            <div>
              <div className="text-[14px] uppercase tracking-wider text-zinc-400 font-bold mb-3">{recipe.productName}</div>
              <div className="space-y-2">
                {recipe.ingredients.map((ing, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-zinc-800/50 px-4 py-3">
                    <span className="text-[16px] text-zinc-200 font-semibold">{ing.name}</span>
                    <span className="font-mono text-[16px] font-bold text-zinc-300">{ing.qtyPerBatch * batchesNeeded}{ing.unit}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Linked recipes */}
            {linkedRecipesForPrep.map(lr => (
              <div key={lr.productName}>
                <div className="text-[14px] uppercase tracking-wider text-zinc-400 font-bold mb-3">↳ {lr.productName}</div>
                <div className="space-y-2">
                  {lr.ingredients.map((ing, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl bg-zinc-800/30 border border-zinc-700/50 px-4 py-3">
                      <span className="text-[16px] text-zinc-300 font-semibold">{ing.name}</span>
                      <span className="font-mono text-[16px] font-bold text-zinc-400">{ing.qtyPerBatch * batchesNeeded}{ing.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {recipe.ingredients.length === 0 && linkedRecipesForPrep.length === 0 && (
              <p className="text-[13px] text-zinc-500">No standard ingredients in recipe.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-700 bg-amber-950/40 p-5">
          <h3 className="text-[14px] font-bold text-amber-200 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span> Additional Ingredients Used
          </h3>

          {savedAddIngs.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {savedAddIngs.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-amber-900/20 border border-amber-800/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-zinc-200">{a.name}</span>
                    <span className="text-[11px] text-amber-400/60">{a.reason}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] text-amber-200">{a.qty}{a.unit}</span>
                    <button onClick={() => {
                      const updated = savedAddIngs.filter((_, idx) => idx !== i);
                      setProductAdditionalIngredients(prev => {
                        const next = { ...prev, [prepKey]: updated };
                        const allRecipesForSave = (recipe.linkedIngredients ?? [])
                          .map(name => recipes.find(r => r.productName === name))
                          .filter((r): r is ProductRecipe => !!r)
                          .filter(r => r.productName !== dos.product);
                        const allKeys: { dosId: string; productName: string }[] = [];
                        if (allRecipesForSave.length === 0) {
                          allKeys.push({ dosId: dos.id, productName: dos.product });
                        }
                        allRecipesForSave.forEach(r => {
                          allKeys.push({ dosId: dos.id, productName: r.productName });
                        });
                        allKeys.forEach(({ dosId, productName }) => {
                          const k = `${dosId}:::${productName.toLowerCase()}`;
                          db.saveDecoProductionPrep([{
                            dosId, productName,
                            productQty: productQty[dosId] ?? prepDemandQty,
                            prepared: preMixPrepared.has(k),
                            done: preMixDone.has(k),
                            additionalIngredients: updated,
                          }]).catch(console.error);
                        });
                        return next;
                      });
                    }} className="text-zinc-500 hover:text-red-400 text-[14px]">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {additionalIngredients.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {additionalIngredients.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-amber-900/20 border border-amber-800/30 px-3 py-2">
                  <span className="text-[13px] font-medium text-zinc-200 flex-1">{a.name}</span>
                  <input type="number" min={0} value={a.qty || ""} onChange={e => {
                    const val = Math.max(0, Number(e.target.value));
                    setAdditionalIngredients(prev => prev.map((item, idx) => idx === i ? { ...item, qty: val } : item));
                  }} placeholder="Qty" className="w-20 rounded-md bg-zinc-900 border border-zinc-700 px-2 py-1 text-[12px] font-mono text-white text-center outline-none focus:border-amber-500" />
                  <span className="text-[11px] text-zinc-400 w-8">{a.unit}</span>
                  <select value={a.reason} onChange={e => {
                    setAdditionalIngredients(prev => prev.map((item, idx) => idx === i ? { ...item, reason: e.target.value } : item));
                  }} className="rounded-md bg-zinc-900 border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 outline-none focus:border-amber-500">
                    <option value="">Reason</option>
                    <option value="Spoilage">Spoilage</option>
                    <option value="Dropped">Dropped</option>
                    <option value="Contaminated">Contaminated</option>
                    <option value="Over-portioned">Over-portioned</option>
                    <option value="Trial/Test Batch">Trial/Test Batch</option>
                    <option value="Other">Other</option>
                  </select>
                  <button onClick={() => setAdditionalIngredients(prev => prev.filter((_, idx) => idx !== i))} className="text-zinc-500 hover:text-red-400 text-[14px]">✕</button>
                </div>
              ))}
            </div>
          )}

          {showAddIngredientModal && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={() => { setShowAddIngredientModal(false); setIngredientSearch(""); }}>
              <div className="w-full max-w-[500px] max-h-[80vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[16px] font-bold text-white">Add Additional Ingredient</h3>
                  <button onClick={() => { setShowAddIngredientModal(false); setIngredientSearch(""); }} className="text-zinc-400 hover:text-white text-[18px]">✕</button>
                </div>
                <p className="text-[12px] text-zinc-400 mb-3">Select from Deco Freezer inventory</p>
                <div className="relative mb-4">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
                  <input type="text" value={ingredientSearch} onChange={e => setIngredientSearch(e.target.value)} placeholder="Search ingredients..." className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 pl-10 pr-4 text-[13px] text-white outline-none focus:border-zinc-500 placeholder:text-zinc-500" />
                </div>
                {inventory.filter(i => i.group === "ingredients" && (!i.accessRoles || i.accessRoles.includes("deco")) && (ingredientSearch === "" || i.name.toLowerCase().includes(ingredientSearch.toLowerCase()))).length === 0 ? (
                  <p className="text-[13px] text-zinc-500 text-center py-6">No items found.</p>
                ) : (
                  <div className="space-y-2">
                    {inventory.filter(i => i.group === "ingredients" && (!i.accessRoles || i.accessRoles.includes("deco")) && (ingredientSearch === "" || i.name.toLowerCase().includes(ingredientSearch.toLowerCase()))).map(item => {
                      const alreadyExists = savedAddIngs.some(a => a.name === item.name) || additionalIngredients.some(a => a.name === item.name);
                      return (
                        <button key={item.id} onClick={() => {
                          if (alreadyExists) return;
                          setAdditionalIngredients(prev => [...prev, { name: item.name, qty: 0, unit: item.unit, reason: "", source: "Deco", timestamp: new Date().toISOString() }]);
                          setShowAddIngredientModal(false);
                          setIngredientSearch("");
                        }} className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-all text-left ${alreadyExists ? "border-zinc-800 bg-zinc-800/30 opacity-50 cursor-not-allowed" : "border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800"}`}>
                          <div>
                            <div className="text-[13px] font-medium text-white">{item.name}</div>
                            <div className="text-[11px] text-zinc-400">{item.onHand} {item.unit} available</div>
                          </div>
                          <span className={`text-[12px] font-medium ${alreadyExists ? "text-zinc-500" : "text-amber-400"}`}>{alreadyExists ? "Already Added" : "+ Add"}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {!showAddIngredientModal && (
            <button onClick={() => setShowAddIngredientModal(true)} className="flex items-center gap-1.5 rounded-lg border border-dashed border-amber-700/50 px-3 py-2 text-[12px] font-medium text-amber-400 hover:bg-amber-900/20 transition-all w-full justify-center">+ Add Additional Ingredient</button>
          )}
        </div>

        <div className="rounded-3xl border-2 border-emerald-700/50 bg-gradient-to-br from-emerald-950/50 to-zinc-900 p-6 text-center">
          <h3 className="text-[14px] font-bold text-emerald-400 mb-4 flex items-center justify-center gap-2 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Production Result
          </h3>
          <div className="inline-block rounded-2xl bg-zinc-800/50 px-8 py-5 border border-zinc-700/50">
            <div className="text-[13px] uppercase tracking-wider text-zinc-400 font-medium mb-2">Expected Production</div>
            <div className="text-[48px] font-bold text-emerald-300 font-mono leading-none">{expectedOutput}</div>
            <div className="text-[12px] text-zinc-400 mt-3 font-mono">
              CEIL({prepDemandQty} ÷ {yieldPerBatch}) = {batchesNeeded} batch × {yieldPerBatch} = {expectedOutput}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-700">
          <div className="text-[12px] text-zinc-500">Step 2 of 5</div>
          <button onClick={handleComplete} className="rounded-xl bg-emerald-600 px-6 py-2.5 text-[13px] font-medium text-white hover:bg-emerald-700 transition-all">
            Save & Send to Baker
          </button>
        </div>
      </div>
    );
  }

  /* ── Advanced Premix ── */
  if (activeTab === "advanced-premix") {
    const filteredRecipes = recipes.filter(r => (r.ingredients.length > 0 || r.packagingMaterials.length > 0 || r.decorationSupplies.length > 0) && r.group !== "filling").filter(r => r.productName.toLowerCase().includes(advMixSearch.toLowerCase()) || advMixSearch === "").sort((a, b) => a.productName.localeCompare(b.productName));

    function toggleAdvRecipe(name: string) {
      setSelectedAdvRecipes(prev => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name); else next.add(name);
        return next;
      });
    }

    return (
      <div className="max-w-4xl mx-auto">
        {toast && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }} onClick={() => setToast(null)}>
            <div className="flex flex-col items-center rounded-2xl bg-white px-8 py-7 shadow-2xl" style={{ minWidth: 360, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${toast.type === "success" ? "bg-emerald-100" : "bg-red-100"}`}>
                <span className={`text-[28px] ${toast.type === "success" ? "text-emerald-600" : "text-red-600"}`}>{toast.type === "success" ? "✓" : "✗"}</span>
              </div>
              <h3 className="text-[16px] font-semibold text-zinc-900">{toast.type === "success" ? "Success" : "Error"}</h3>
              <p className="mt-1.5 text-center text-[13px] leading-relaxed text-zinc-500">{toast.message}</p>
              <button onClick={() => setToast(null)} className="mt-5 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-colors">Got it</button>
            </div>
          </div>
        )}
        <div className="sticky top-0 z-10 bg-[#F9F6F1] py-6 space-y-4">
          <div>
            <h1 className="text-[32px] font-extrabold tracking-tight text-zinc-900">Advanced Premix</h1>
            <p className="mt-1 text-[14px] text-zinc-500">Curate recipe batches and fine-tune ingredient compositions.</p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[14px]">⌕</span>
              <input 
                value={advMixSearch} 
                onChange={e => setAdvMixSearch(e.target.value)} 
                placeholder="Search recipes..." 
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 py-2.5 text-[13px] outline-none focus:border-zinc-400 transition-all" 
              />
            </div>
            <button
              onClick={() => setIsAdvLocked(!isAdvLocked)}
              disabled={selectedAdvRecipes.size === 0}
              className={`flex items-center gap-3 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition-all duration-200 shadow-sm shrink-0 ${
                selectedAdvRecipes.size === 0
                  ? "bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none"
                  : isAdvLocked
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              <span className="text-[16px]">{isAdvLocked ? "🔓" : "🔒"}</span>
              {isAdvLocked ? "Unlock" : "Lock"}
              <span className="flex items-center justify-center rounded-full bg-white/20 w-5 h-5 text-[11px] font-mono">
                {selectedAdvRecipes.size}
              </span>
            </button>
          </div>
        </div>

        <div className="space-y-6 mt-6">

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
              {Array.from(selectedAdvRecipes).filter(pn => { const r = recipes.find(rec => rec.productName === pn); return !r || ((r.ingredients.length > 0 || r.packagingMaterials.length > 0 || r.decorationSupplies.length > 0) && r.group !== "filling"); }).map(productName => {
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
              <button onClick={() => {
                const batchRef = `ADV-${Date.now()}`;
                const workingInv = inventory.map(i => ({ ...i }));
                const findMatch = (ingredient: { name: string; inventoryId?: string; sku?: string }): InventoryItem | undefined => {
                  if (ingredient.inventoryId) {
                    const direct = workingInv.find(i => i.id === ingredient.inventoryId);
                    if (direct) return direct;
                  }
                  const ingLower = ingredient.name.toLowerCase().trim();
                  let match = workingInv.find(i => i.name.toLowerCase().trim() === ingLower);
                  if (match) return match;
                  match = workingInv.find(i => i.name.toLowerCase().includes(ingLower) || ingLower.includes(i.name.toLowerCase()));
                  if (match) return match;
                  if (ingredient.sku) match = workingInv.find(i => i.sku === ingredient.sku);
                  return match;
                };
                const deductedItems: string[] = [];
                const missedItems: string[] = [];
                const mergedItems: FreezerItem[] = [];
                const newItems: FreezerItem[] = [];
                Array.from(selectedAdvRecipes).forEach(productName => {
                  const recipe = recipes.find(r => r.productName === productName);
                  if (!recipe) return;
                  const qty = advMixQtys[productName] || 1;
                  const adjustments = advMixAdjustments[productName];
                  recipe.ingredients.forEach(ing => {
                    const match = findMatch(ing);
                    if (!match) { missedItems.push(ing.name); return; }
                    const idx = workingInv.findIndex(i => i.id === match.id);
                    if (idx === -1) return;
                    const needed = ing.qtyPerBatch * qty;
                    workingInv[idx] = { ...workingInv[idx], onHand: Math.max(0, workingInv[idx].onHand - needed) };
                    deductedItems.push(ing.name + " (-" + needed + " " + ing.unit + ")");
                  });
                  const notes = adjustments
                    ? Object.entries(adjustments).filter(([, v]) => v !== 0).map(([name, v]) => `${name}: ${v > 0 ? "+" : ""}${v.toFixed(1)}`).join("; ")
                    : "";
                  const prNotes = notes ? `Production Recipe (${notes})` : "Production Recipe";
                  const existing = freezerItems.find(fi =>
                    fi.productName === productName && fi.producedBy === "deco" && fi.notes?.startsWith("Production Recipe") && fi.status === "stored"
                  );
                  if (existing) {
                    mergedItems.push({ ...existing, qty: existing.qty + qty, dateProduced: new Date().toISOString(), notes: prNotes });
                  } else {
                    newItems.push({
                      id: `FRZ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      productName, qty, unit: "batch", batchRef,
                      producedBy: "deco",
                      dateProduced: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0],
                      status: "stored", notes: prNotes,
                    });
                  }
                });
                onUpdateInventory(workingInv);
                const changed = workingInv.filter(item => {
                  const orig = inventory.find(i => i.id === item.id);
                  return orig && Math.abs(orig.onHand - item.onHand) > 0.0001;
                });
                if (changed.length > 0) {
                  db.upsertInventory(changed).catch(console.error);
                  changed.forEach(item => {
                    const orig = inventory.find(o => o.id === item.id);
                    if (orig && orig.onHand > item.onHand) {
                      onStockTransaction?.({ id: `STX-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, type: "out", itemName: item.name, itemId: item.id, qty: orig.onHand - item.onHand, unit: item.unit, reference: `Advanced Premix`, timestamp: new Date().toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), target: "deco", group: item.group, role: "deco" });
                    }
                  });
                }
                if (mergedItems.length > 0) {
                  onUpdateFreezer?.((prev: FreezerItem[]) => prev.map(fi => { const m = mergedItems.find(x => x.id === fi.id); return m || fi; }));
                  db.upsertFreezerItems(mergedItems).catch(console.error);
                }
                if (newItems.length > 0) {
                  onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, ...newItems]);
                  db.upsertFreezerItems(newItems).then(() => {
                    const assemblyTasks = newItems.map(item => ({
                      id: crypto.randomUUID?.() ?? `ASM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      productName: item.productName,
                      premixItemId: item.id,
                      premixQtyUsed: item.qty,
                      qtyAssembled: 0,
                      status: "pending" as const,
                      assembledBy: "baker",
                      notes: `From Deco Advanced Premix (${batchRef})`,
                    }));
                    return Promise.all(assemblyTasks.map(t => db.saveBakerAssemblyTask(t)));
                  }).catch(console.error);
                }
                const totalCount = selectedAdvRecipes.size;
                const deductLog = deductedItems.length > 0 ? " Deducted: " + deductedItems.join(", ") : "";
                const missLog = missedItems.length > 0 ? " Missed: " + missedItems.join(", ") : "";
                onAddAuditLog?.("ADVANCED_PREMIX_SAVED", `Saved ${totalCount} composition(s) to Production Recipe (batch: ${batchRef}). Merged: ${mergedItems.length}, New: ${newItems.length}.${deductLog}${missLog}`);
                setSelectedAdvRecipes(new Set());
                setAdvMixQtys({});
                setAdvMixAdjustments({});
                setIsAdvLocked(false);
                showToast("Saved to Baker");
              }} className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-white bg-amber-600 hover:bg-amber-700">Send to Baker</button>
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
                  style={{ alignItems: "flex-start" }}
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
        </div>
        </div>
      </div>
    );
  }

  /* ── Cake Productions ── */
  if (activeTab === "deco-queue") {
    const prepInventory = inventory.filter(i => (i.source === "production-prep" || i.source === "came-from-baker") && (!i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("deco")));
    const activeDesignItem = selectedDesignId ? inventory.find(i => i.id === selectedDesignId) ?? null : null;

    const renderDecoCard = (task: DecoTask, opts?: { compact?: boolean; expanded?: boolean; onToggle?: () => void }) => {
      const taskRecipes = getRecipesForProduct(task.product);
      const matchingDOS = dosItems.find(d => d.product === task.product);
      const customerName = task.customerName || matchingDOS?.customerName || task.product;
      const taskPkgMap = new Map<string, { name: string; qty: number; unit: string; source: string }>();
      const taskDecoMap = new Map<string, { name: string; qty: number; unit: string; source: string }>();
      taskRecipes.forEach(r => {
        (r.packagingMaterials ?? []).forEach(p => {
          const key = p.name.toLowerCase();
          const existing = taskPkgMap.get(key);
          if (existing) existing.qty += p.qtyPerBatch;
          else taskPkgMap.set(key, { name: p.name, qty: p.qtyPerBatch, unit: p.unit, source: r.productName });
        });
        (r.decorationSupplies ?? []).forEach(s => {
          const key = s.name.toLowerCase();
          const existing = taskDecoMap.get(key);
          if (existing) existing.qty += s.qtyPerBatch;
          else taskDecoMap.set(key, { name: s.name, qty: s.qtyPerBatch, unit: s.unit, source: r.productName });
        });
      });
      const taskPkg = [...taskPkgMap.values()];
      const taskDeco = [...taskDecoMap.values()];
      const qtyMult = task.sourceQty && task.sourceQty > 0 ? task.sourceQty : 1;
      const isCompleted = task.status === "completed";
      const compact = !!opts?.compact;
      const expanded = !!opts?.expanded;

      // Compact history card: product name, date, time, qty badge, chevron
      if (compact) {
        const created = task.createdAt ? new Date(task.createdAt) : null;
        const dateStr = created ? created.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" }) : "—";
        const timeStr = created ? created.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: true }) : "";
        return (
          <div key={task.id} className={`rounded-xl border overflow-hidden ${isCompleted ? "border-emerald-200 bg-emerald-50/20" : "border-zinc-200 bg-white"}`}>
            <button
              onClick={opts?.onToggle}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-zinc-50/60 transition-colors text-left"
            >
              <span className={`text-[10px] text-zinc-400 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}>▸</span>
              <span className="rounded-lg bg-zinc-900 text-white font-mono font-bold text-[12px] px-2 py-0.5 shrink-0">×{qtyMult}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-zinc-900 truncate">{task.product}</div>
                <div className="text-[11px] text-zinc-500 font-mono">{dateStr} · {timeStr}</div>
              </div>
              <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-medium shrink-0">Decorated</span>
            </button>
            {expanded && (
              <div className="border-t border-zinc-100 px-4 py-4 space-y-3 bg-white">
                <div className="flex items-center gap-2 text-[12px] text-zinc-500">
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-600">{task.theme}</span>
                  <span className="text-zinc-400">{task.orderRef}</span>
                </div>
                {task.notes && <div className="text-[12px] text-zinc-600">{task.notes}</div>}
                {(taskPkg.length > 0 || taskDeco.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-blue-700 font-semibold mb-1.5">Linked Packaging</div>
                      {taskPkg.length === 0 ? (
                        <div className="text-[11px] text-zinc-400">None</div>
                      ) : (
                        <ul className="space-y-0.5">
                          {taskPkg.map((p, i) => (
                            <li key={`hqp-${i}`} className="flex items-center justify-between text-[11px] text-zinc-700">
                              <span className="truncate mr-2">{p.name}</span>
                              <span className="font-mono font-semibold text-blue-700 shrink-0">{formatQty(p.qty * qtyMult, p.unit)}{p.unit}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-purple-700 font-semibold mb-1.5">Linked Decoration</div>
                      {taskDeco.length === 0 ? (
                        <div className="text-[11px] text-zinc-400">None</div>
                      ) : (
                        <ul className="space-y-0.5">
                          {taskDeco.map((s, i) => (
                            <li key={`hqd-${i}`} className="flex items-center justify-between text-[11px] text-zinc-700">
                              <span className="truncate mr-2">{s.name}</span>
                              <span className="font-mono font-semibold text-purple-700 shrink-0">{formatQty(s.qty * qtyMult, s.unit)}{s.unit}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex justify-end pt-1">
                  <button onClick={() => { if (confirm(`Remove decoration task for ${task.product}?`)) deleteDecoTask(task.id); }} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-all">Delete</button>
                </div>
              </div>
            )}
          </div>
        );
      }

      // Full card (Active Cake Productions)
      return (
        <div key={task.id} className={`rounded-2xl border p-5 ${isCompleted ? "border-emerald-200 bg-emerald-50/30" : "border-zinc-200 bg-white"}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-zinc-900 text-white font-mono font-bold text-[13px] px-2.5 py-1">×{qtyMult}</span>
              <div>
                <div className="text-[15px] font-semibold text-zinc-900">{customerName}</div>
                <div className="text-[12px] text-purple-600 font-medium">{task.theme}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${isCompleted ? "bg-emerald-100 text-emerald-700" : task.status === "in-progress" ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-600"}`}>{task.status}</span>
              <button onClick={() => { if (confirm(`Remove decoration task for ${task.product}?`)) deleteDecoTask(task.id); }} className="rounded-lg border border-red-200 bg-white px-2 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-50 transition-all">Delete</button>
            </div>
          </div>
          {(taskPkg.length > 0 || taskDeco.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-blue-700 font-semibold mb-1.5">Linked Packaging</div>
                {taskPkg.length === 0 ? (
                  <div className="text-[11px] text-zinc-400">None</div>
                ) : (
                  <ul className="space-y-0.5">
                    {taskPkg.map((p, i) => (
                      <li key={`qp-${i}`} className="flex items-center justify-between text-[11px] text-zinc-700">
                        <span className="truncate mr-2">{p.name}</span>
                        <span className="font-mono font-semibold text-blue-700 shrink-0">{formatQty(p.qty * qtyMult, p.unit)}{p.unit}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-purple-700 font-semibold mb-1.5">Linked Decoration</div>
                {taskDeco.length === 0 ? (
                  <div className="text-[11px] text-zinc-400">None</div>
                ) : (
                  <ul className="space-y-0.5">
                    {taskDeco.map((s, i) => (
                      <li key={`qd-${i}`} className="flex items-center justify-between text-[11px] text-zinc-700">
                        <span className="truncate mr-2">{s.name}</span>
                        <span className="font-mono font-semibold text-purple-700 shrink-0">{formatQty(s.qty * qtyMult, s.unit)}{s.unit}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          {!isCompleted && (
            <div className="flex justify-center gap-3 pt-1">
              {task.status === "pending" && (
                <>
                  <button onClick={() => {
                    const inv = inventory.find(i => i.id === task.sourceInventoryId);
                    if (inv) {
                      setDesignModal({ product: task.product, inventoryId: inv.id, qty: task.sourceQty || inv.onHand, theme: task.theme, notes: task.notes, customerName: task.customerName });
                      setDesignTheme(task.theme || "");
                      setDesignNotes(task.notes || "");
                      setDesignQty(task.sourceQty || 1);
                    }
                  }} className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 transition-all shadow-sm">Back to Designing</button>
                  <button onClick={() => updateDecoTask(task.id, "in-progress")} className="rounded-xl bg-blue-600 px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-700 transition-all shadow-sm">Start Decorating</button>
                </>
              )}
              {task.status === "in-progress" && (
                <button onClick={() => updateDecoTask(task.id, "completed")} className="rounded-xl bg-emerald-600 px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-emerald-700 transition-all shadow-sm">Put it on Display Cake 🎂</button>
              )}
            </div>
          )}
        </div>
      );
    };

    const openDesign = (product: string, inventoryId: string, qty: number) => {
      setDesignModal({ product, inventoryId, qty });
      setDesignTheme("");
      setDesignNotes("");
      setDesignQty(Math.max(1, qty));
      setExtraPackaging([]);
      setExtraDecoration([]);
    };

    const openDesignFromDOS = (dos: DOSItem) => {
      const inv = inventory.find(i => i.name === dos.product && (i.source === "production-prep" || i.source === "came-from-baker"));
      if (!inv) { alert(`No "${dos.product}" available in My Inventory. Complete Tasks to Prepare first.`); return; }
      setDesignModal({ product: dos.product, inventoryId: inv.id, qty: inv.onHand, theme: dos.themeOccasion, notes: dos.cakeDesignNotes, customerName: dos.customerName, colorScheme: dos.colorScheme, topper: dos.topper, referenceImage: dos.referenceImage, messageCaption: dos.messageCaption, layers: dos.layers });
      setDesignTheme(dos.themeOccasion || "");
      setDesignNotes(dos.cakeDesignNotes || "");
      setDesignQty(Math.max(1, dos.qty));
      setExtraPackaging([]);
      setExtraDecoration([]);
    };

    const confirmDesign = () => {
      if (!designModal) return;

      // Handle multiple base cakes
      if (selectedBaseCakes.length > 0) {
        let hasError = false;
        // Check availability first
        for (const bc of selectedBaseCakes) {
          const sourceItem = inventory.find(i => i.id === bc.inventoryId);
          if (!sourceItem) {
            alert(`Base cake "${bc.name}" no longer exists in inventory.`);
            hasError = true;
            break;
          }
          if (sourceItem.onHand < bc.qty) {
            if (!confirm(`Only ${sourceItem.onHand} ${bc.unit} of "${bc.name}" available. Design ${bc.qty} anyway?`)) {
              hasError = true;
              break;
            }
          }
        }
        if (hasError) return;

        // Create tasks for each selected base cake
        const newTasks: DecoTask[] = selectedBaseCakes.map(bc => ({
          id: `DQ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${bc.inventoryId.slice(-4)}`,
          product: bc.name,
          orderRef: `INV-${bc.inventoryId.slice(-6).toUpperCase()}`,
          theme: designTheme.trim() || "Custom Design",
          status: "pending",
          notes: designNotes.trim() || "Designed from My Inventory",
          customerName: designModal?.customerName || "",
          sourceInventoryId: bc.inventoryId,
          sourceQty: bc.qty,
          sourceSnapshot: { ...inventory.find(i => i.id === bc.inventoryId)! },
          createdAt: new Date().toISOString(),
        }));

        // Add all tasks to queue
        setDecoQueue(prev => [...newTasks, ...prev]);

        // Save each task to database
        newTasks.forEach(task => {
          db.upsertDecorationQueueTask({
            id: task.id, product: task.product, orderRef: task.orderRef,
            theme: task.theme, status: task.status, notes: task.notes,
            customerName: task.customerName,
            sourceInventoryId: task.sourceInventoryId, sourceQty: task.sourceQty,
            sourceBatchRef: undefined, sourceProducedBy: undefined, createdAt: task.createdAt,
            sourceSnapshot: task.sourceSnapshot,
          }).catch(console.error);
        });

        // Deduct from inventory for each base cake
        selectedBaseCakes.forEach(bc => {
          const sourceItem = inventory.find(i => i.id === bc.inventoryId);
          if (!sourceItem) return;

          const remaining = sourceItem.onHand - bc.qty;
          if (remaining <= 0) {
            onUpdateInventory(prev => prev.filter(i => i.id !== sourceItem.id));
            db.deleteInventoryItem(sourceItem.id, sourceItem.group).catch(err => {
              console.error("Inventory delete failed:", err);
            });
            onAddAuditLog?.("INVENTORY_REMOVED", `${sourceItem.name} removed (0 on hand after design)`);
          } else {
            const updatedItem = { ...sourceItem, onHand: remaining };
            onUpdateInventory(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
            db.upsertInventoryItem(updatedItem).catch(err => {
              console.error("Inventory update failed:", err);
            });
          }
        });

        // Deduct extra ingredients
        extraIngredients.forEach(ei => {
          const inv = inventory.find(i => i.id === ei.inventoryId);
          if (!inv) return;
          const rem = inv.onHand - (Number(ei.qty) || 1);
          if (rem <= 0) {
            onUpdateInventory(prev => prev.filter(i => i.id !== inv.id));
            db.deleteInventoryItem(inv.id, inv.group).catch(console.error);
          } else {
            const updated = { ...inv, onHand: rem };
            onUpdateInventory(prev => prev.map(i => i.id === updated.id ? updated : i));
            db.upsertInventoryItem(updated).catch(console.error);
          }
        });

        const summary = selectedBaseCakes.map(bc => `${bc.name} ×${bc.qty}`).join(", ");
        onAddAuditLog?.("DECO_TASK_CREATED", `Added to Decoration Queue: ${summary}`);
        showToast(`${selectedBaseCakes.length} base cake${selectedBaseCakes.length > 1 ? 's' : ''} added to queue`, "success");
        setSelectedBaseCakes([]);
        setExtraPackaging([]);
        setExtraDecoration([]);
        setExtraIngredients([]);
        setDesignModal(null);
        return;
      }

      // Legacy single base cake flow
      const sourceItem = inventory.find(i => i.id === designModal.inventoryId);
      if (!sourceItem) {
        alert("Source inventory item no longer exists.");
        return;
      }
      if (sourceItem.onHand < designQty) {
        if (!confirm(`Only ${sourceItem.onHand} on hand. Design ${designQty} anyway?`)) return;
      }

      const newTask: DecoTask = {
        id: `DQ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        product: designModal.product,
        orderRef: `INV-${designModal.inventoryId.slice(-6).toUpperCase()}`,
        theme: designTheme.trim() || "Custom Design",
        status: "pending",
        notes: designNotes.trim() || "Designed from My Inventory",
        customerName: designModal.customerName || "",
        sourceInventoryId: designModal.inventoryId,
        sourceQty: designQty,
        sourceSnapshot: { ...sourceItem },
        createdAt: new Date().toISOString(),
      };
      setDecoQueue(prev => [newTask, ...prev]);
      setSelectedDesignId(designModal.inventoryId);
      setExtraPackaging([]);
      setExtraDecoration([]);
      setExtraIngredients([]);
      setDesignModal(null);
      showToast(`${designModal.product} ×${designQty} added to queue`, "success");
      db.upsertDecorationQueueTask({
        id: newTask.id, product: newTask.product, orderRef: newTask.orderRef,
        theme: newTask.theme, status: newTask.status, notes: newTask.notes,
        customerName: newTask.customerName,
        sourceInventoryId: newTask.sourceInventoryId, sourceQty: newTask.sourceQty,
        sourceBatchRef: undefined, sourceProducedBy: undefined, createdAt: newTask.createdAt,
        sourceSnapshot: newTask.sourceSnapshot,
      }).catch(console.error);
      onAddAuditLog?.("DECO_TASK_CREATED", `${designModal.product} ×${designQty} added to Decoration Queue`);

      // Deduct the designed qty from the source My Inventory item.
      // If on-hand hits 0, remove the item from inventory entirely.
      const remaining = sourceItem.onHand - designQty;
      if (remaining <= 0) {
        onUpdateInventory(prev => prev.filter(i => i.id !== sourceItem.id));
        db.deleteInventoryItem(sourceItem.id, sourceItem.group).catch(err => {
          console.error("Inventory delete failed:", err);
        });
        onAddAuditLog?.("INVENTORY_REMOVED", `${sourceItem.name} removed (0 on hand after design)`);
        setSelectedDesignId(prev => prev === sourceItem.id ? null : prev);
      } else {
        const updatedItem = { ...sourceItem, onHand: remaining };
        onUpdateInventory(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
        db.upsertInventoryItem(updatedItem).catch(err => {
          console.error("Inventory update failed:", err);
        });
      }

      // Deduct extra ingredients
      extraIngredients.forEach(ei => {
        const inv = inventory.find(i => i.id === ei.inventoryId);
        if (!inv) return;
        const rem = inv.onHand - (Number(ei.qty) || 1);
        if (rem <= 0) {
          onUpdateInventory(prev => prev.filter(i => i.id !== inv.id));
          db.deleteInventoryItem(inv.id, inv.group).catch(console.error);
        } else {
          const updated = { ...inv, onHand: rem };
          onUpdateInventory(prev => prev.map(i => i.id === updated.id ? updated : i));
          db.upsertInventoryItem(updated).catch(console.error);
        }
      });
    };

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Cake Productions</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Pick a product from My Inventory (Production Prep or From Baker), design it, then start production.</p>
        </div>

        {/* DOS Items with Customization */}
        {(() => {
          const customDOS = dosForDeco.filter(d => d.themeOccasion || d.colorScheme || d.cakeDesignNotes || d.topper || d.referenceImage || d.messageCaption || d.customerName || d.contactNumber || d.dateOfEvent || d.pickupDeliveryTime || d.layers);
          return (
            <div className="rounded-[24px] border border-violet-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-violet-50 to-fuchsia-50 border-b border-violet-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                      <span className="text-[18px]">🎂</span>
                    </div>
                    <div>
                      <h2 className="text-[15px] font-semibold text-zinc-900">Cake Custom Orders</h2>
                      <p className="text-[12px] text-zinc-500">DOS cakes with customization — start decorating</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-violet-600 px-3 py-1 text-[11px] font-bold text-white">{customDOS.length}</span>
                </div>
              </div>
              {customDOS.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-3">
                    <span className="text-[20px]">🎂</span>
                  </div>
                  <p className="text-[13px] text-zinc-500">No cake custom orders yet</p>
                  <p className="text-[11px] text-zinc-400 mt-1">DOS cakes with design customization will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-violet-100">
                  {customDOS.map(dos => {
                    const alreadyDesigned = decoQueue.some(t => t.product === dos.product && t.status !== "completed");
                    return (
                      <div key={dos.id} className={`px-6 py-5 hover:bg-violet-50/30 transition-colors ${alreadyDesigned ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {/* Header Row */}
                            <div className="flex items-center gap-2 flex-wrap mb-3">
                              <span className="text-[16px] font-bold text-zinc-900">{dos.product}</span>
                              {dos.flavor && <span className="rounded-lg bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-700 uppercase">{dos.flavor}</span>}
                              {dos.size && <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-600">{dos.size}</span>}
                              <span className="text-[12px] text-zinc-400 font-mono font-medium">×{dos.qty}</span>
                              {alreadyDesigned && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700">In Queue</span>}
                            </div>

                            {/* Customer Details Card */}
                            {(dos.customerName || dos.contactNumber || dos.dateOfEvent || dos.pickupDeliveryTime) && (
                              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 mb-3">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-3">Customer Details</div>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                                  {dos.customerName && (
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-[13px] text-zinc-500">Customer:</span>
                                      <span className="text-[14px] font-semibold text-zinc-800">{dos.customerName}</span>
                                    </div>
                                  )}
                                  {dos.contactNumber && (
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-[13px] text-zinc-500">Contact:</span>
                                      <span className="text-[14px] font-semibold text-zinc-800">{dos.contactNumber}</span>
                                    </div>
                                  )}
                                  {dos.dateOfEvent && (
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-[13px] text-zinc-500">Event Date:</span>
                                      <span className="text-[14px] font-semibold text-zinc-800">{dos.dateOfEvent}</span>
                                    </div>
                                  )}
                                  {dos.pickupDeliveryTime && (
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-[13px] text-zinc-500">Pickup/Delivery:</span>
                                      <span className="text-[14px] font-semibold text-zinc-800">{dos.pickupDeliveryTime}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Design Details Card */}
                            {(dos.themeOccasion || dos.colorScheme || dos.topper || dos.messageCaption || dos.layers) && (
                              <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 mb-3">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-violet-600 mb-3">Design Details</div>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                                  {dos.themeOccasion && (
                                    <div className="flex items-center gap-2.5">
                                      <span className="w-2.5 h-2.5 rounded-full bg-violet-400 shrink-0"></span>
                                      <span className="text-[13px] text-zinc-500">Theme:</span>
                                      <span className="text-[14px] font-semibold text-zinc-800">{dos.themeOccasion}</span>
                                    </div>
                                  )}
                                   <div className="flex items-center gap-2.5">
                                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
                                      <span className="text-[13px] text-zinc-500">Layers:</span>
                                      <span className="text-[14px] font-semibold text-zinc-800">{dos.layers || "—"}</span>
                                    </div>
                                  {dos.colorScheme && (
                                    <div className="flex items-center gap-2.5">
                                      <span className="w-2.5 h-2.5 rounded-full bg-pink-400 shrink-0"></span>
                                      <span className="text-[13px] text-zinc-500">Colors:</span>
                                      <span className="text-[14px] font-semibold text-zinc-800">{dos.colorScheme}</span>
                                    </div>
                                  )}
                                  {dos.topper && (
                                    <div className="flex items-center gap-2.5">
                                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
                                      <span className="text-[13px] text-zinc-500">Topper:</span>
                                      <span className="text-[14px] font-semibold text-zinc-800">{dos.topper}</span>
                                    </div>
                                  )}
                                  {dos.messageCaption && (
                                    <div className="flex items-center gap-2.5">
                                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0"></span>
                                      <span className="text-[13px] text-zinc-500">Message:</span>
                                      <span className="text-[14px] font-semibold text-zinc-800 italic">"{dos.messageCaption}"</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Notes */}
                            {dos.cakeDesignNotes && (
                              <div className="rounded-xl bg-zinc-50 border border-zinc-100 px-4 py-3 mb-3">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Notes</div>
                                <p className="text-[14px] text-zinc-600 leading-relaxed">{dos.cakeDesignNotes}</p>
                              </div>
                            )}

                            {/* Reference Image */}
                            {dos.referenceImage && (
                              <div className="flex items-center gap-2.5 rounded-xl bg-violet-50 border border-violet-100 px-4 py-3">
                                <svg className="w-5 h-5 text-violet-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <a href={dos.referenceImage} target="_blank" rel="noopener noreferrer" className="text-[13px] text-violet-600 hover:text-violet-800 font-medium">View Reference Image</a>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => openDesignFromDOS(dos)}
                            disabled={alreadyDesigned}
                            className={`shrink-0 flex flex-col items-center gap-1.5 rounded-2xl px-8 py-5 text-[14px] font-bold transition-all shadow-lg hover:shadow-xl ${alreadyDesigned ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed shadow-none' : 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white hover:from-violet-700 hover:to-fuchsia-700'}`}
                          >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            {alreadyDesigned ? "In Queue" : "Start Design"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Active Cake Productions */}
        <div>
          <h2 className="text-[15px] font-semibold text-zinc-900 mb-3">Active Cake Productions</h2>
          {(() => {
            const activeTasks = decoQueue.filter(t => t.status !== "completed");
            if (activeTasks.length === 0) {
              return <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center"><p className="text-[14px] text-zinc-400">No active cake productions.</p></div>;
            }
            return (
              <div className="space-y-3">
                {activeTasks.map(task => renderDecoCard(task))}
              </div>
            );
          })()}
        </div>

        {/* Decoration History */}
        {(() => {
          const completedTasks = decoQueue
            .filter(t => t.status === "completed")
            .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
          if (completedTasks.length === 0) return null;
          const visibleCount = showAllHistory ? completedTasks.length : Math.min(3, completedTasks.length);
          const visible = completedTasks.slice(0, visibleCount);
          const hasMore = completedTasks.length > 3;
          const toggleExpanded = (id: string) => setExpandedHistoryIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
          return (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-semibold text-zinc-900">Decoration History</h2>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold text-zinc-600 uppercase tracking-wider">{completedTasks.length} completed</span>
              </div>
              <div className="space-y-2">
                {visible.map(task => renderDecoCard(task, {
                  compact: true,
                  expanded: expandedHistoryIds.has(task.id),
                  onToggle: () => toggleExpanded(task.id),
                }))}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-3">
                  <button
                    onClick={() => setShowAllHistory(s => !s)}
                    className="rounded-xl border border-zinc-200 bg-white px-5 py-2 text-[12px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all"
                  >
                    {showAllHistory ? "← Show less" : `See more (${completedTasks.length - 3} more)`}
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Design Modal */}
        {designModal && (() => {
          const linkedRecipes = getRecipesForProduct(designModal.product);
          const pkgMap = new Map<string, { name: string; qty: number; unit: string; source: string }>();
          const decoMap = new Map<string, { name: string; qty: number; unit: string; source: string }>();
          linkedRecipes.forEach(r => {
            (r.packagingMaterials ?? []).forEach(p => {
              const key = p.name.toLowerCase();
              const existing = pkgMap.get(key);
              if (existing) existing.qty += p.qtyPerBatch;
              else pkgMap.set(key, { name: p.name, qty: p.qtyPerBatch, unit: p.unit, source: r.productName });
            });
            (r.decorationSupplies ?? []).forEach(s => {
              const key = s.name.toLowerCase();
              const existing = decoMap.get(key);
              if (existing) existing.qty += s.qtyPerBatch;
              else decoMap.set(key, { name: s.name, qty: s.qtyPerBatch, unit: s.unit, source: r.productName });
            });
          });
          const packagingItems = [...pkgMap.values()];
          const decorationItems = [...decoMap.values()];
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => { setDesignModal(null); setSelectedBaseCakes([]); }}>
              <div className="w-full max-w-[780px] max-h-[92vh] rounded-[32px] bg-white shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 py-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-[24px] font-bold text-white">Design Product</h2>
                      <p className="text-[14px] text-violet-200 mt-1">Review customization details and link materials</p>
                    </div>
                    <button onClick={() => { setDesignModal(null); setSelectedBaseCakes([]); }} className="grid h-10 w-10 place-items-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors text-[18px]">✕</button>
                  </div>
                </div>

                <div className="overflow-y-auto px-8 py-6 space-y-6 flex-1">
                  {/* Customer Customization Card */}
                  {(designModal.theme || designModal.colorScheme || designModal.notes || designModal.topper || designModal.referenceImage || designModal.messageCaption || designModal.layers) && (
                    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 overflow-hidden">
                      <div className="px-6 py-4 bg-violet-100/60 border-b border-violet-200/60">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center text-[20px]">🎨</div>
                          <div>
                            <h3 className="text-[16px] font-bold text-violet-900">Customer Customization</h3>
                            <p className="text-[12px] text-violet-600">Special requests for this order</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="grid grid-cols-2 gap-4">
                          {designModal.theme && (
                            <div className="rounded-xl bg-white/80 border border-violet-100 px-4 py-3">
                              <div className="text-[11px] uppercase tracking-wider text-violet-500 font-semibold">Theme</div>
                              <div className="text-[16px] text-zinc-800 font-bold mt-1">{designModal.theme}</div>
                            </div>
                          )}
                          {designModal.layers && (
                            <div className="rounded-xl bg-white/80 border border-violet-100 px-4 py-3">
                              <div className="text-[11px] uppercase tracking-wider text-violet-500 font-semibold">Layers</div>
                              <div className="text-[16px] text-zinc-800 font-bold mt-1">{designModal.layers} Layer{designModal.layers !== "1" ? "s" : ""}</div>
                            </div>
                          )}
                          {designModal.colorScheme && (
                            <div className="rounded-xl bg-white/80 border border-violet-100 px-4 py-3">
                              <div className="text-[11px] uppercase tracking-wider text-violet-500 font-semibold">Colors</div>
                              <div className="text-[16px] text-zinc-800 font-bold mt-1">{designModal.colorScheme}</div>
                            </div>
                          )}
                          {designModal.topper && (
                            <div className="rounded-xl bg-white/80 border border-violet-100 px-4 py-3">
                              <div className="text-[11px] uppercase tracking-wider text-violet-500 font-semibold">Topper</div>
                              <div className="text-[16px] text-zinc-800 font-bold mt-1">{designModal.topper}</div>
                            </div>
                          )}
                        </div>
                        {designModal.messageCaption && (
                          <div className="mt-4 rounded-xl bg-white/80 border border-violet-100 px-5 py-4">
                            <div className="text-[11px] uppercase tracking-wider text-violet-500 font-semibold">Message on Cake</div>
                            <div className="text-[18px] text-zinc-800 font-bold mt-1 italic">"{designModal.messageCaption}"</div>
                          </div>
                        )}
                        {designModal.notes && (
                          <div className="mt-4 rounded-xl bg-white/80 border border-violet-100 px-5 py-4">
                            <div className="text-[11px] uppercase tracking-wider text-violet-500 font-semibold">Special Notes</div>
                            <p className="text-[14px] text-zinc-600 mt-1 leading-relaxed">{designModal.notes}</p>
                          </div>
                        )}
                        {designModal.referenceImage && (
                          <a href={designModal.referenceImage} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-3 rounded-xl bg-violet-500 hover:bg-violet-600 border border-violet-400 px-5 py-3 transition-colors cursor-pointer">
                            <svg className="w-5 h-5 text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <span className="text-[14px] text-white font-semibold">View Reference Image</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Base Cake Selection */}
                  {(() => {
                    const bakerInventory = inventory.filter(i => i.source === "came-from-baker" && i.onHand > 0);
                    const prepInventory = inventory.filter(i => i.source === "production-prep" && i.onHand > 0);
                    const allBaseCakes = [...bakerInventory, ...prepInventory];
                    if (allBaseCakes.length === 0) return null;

                    const toggleBaseCake = (item: typeof allBaseCakes[0], source: string) => {
                      const isSelected = selectedBaseCakes.some(b => b.inventoryId === item.id);
                      if (isSelected) {
                        setSelectedBaseCakes(prev => prev.filter(b => b.inventoryId !== item.id));
                      } else {
                        setSelectedBaseCakes(prev => [...prev, {
                          inventoryId: item.id,
                          name: item.name,
                          qty: 1,
                          unit: item.unit,
                          source: source
                        }]);
                      }
                    };

                    const updateBaseCakeQty = (inventoryId: string, newQty: number) => {
                      setSelectedBaseCakes(prev => prev.map(b =>
                        b.inventoryId === inventoryId ? { ...b, qty: Math.max(1, newQty) } : b
                      ));
                    };

                    const totalSelected = selectedBaseCakes.reduce((sum, b) => sum + b.qty, 0);

                    return (
                      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden">
                        <div className="px-6 py-4 bg-amber-100/60 border-b border-amber-200/60">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-[18px]">🎂</div>
                              <div>
                                <h3 className="text-[15px] font-bold text-amber-900">Base Cake Selection</h3>
                                <p className="text-[12px] text-amber-600">Select one or more base cakes to decorate</p>
                              </div>
                            </div>
                            {selectedBaseCakes.length > 0 && (
                              <div className="rounded-xl bg-amber-500 px-3 py-1.5 text-[12px] font-bold text-white">
                                {selectedBaseCakes.length} selected · {totalSelected} total
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="p-5 space-y-4">
                          {/* From Baker Section */}
                          {bakerInventory.length > 0 && (
                            <div>
                              <div className="text-[11px] uppercase tracking-wider text-amber-700 font-semibold mb-3">From Baker</div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {bakerInventory.map(item => {
                                  const selected = selectedBaseCakes.find(b => b.inventoryId === item.id);
                                  return (
                                    <div key={`baker-${item.id}`} onClick={() => toggleBaseCake(item, "From Baker")} className={`rounded-xl border p-4 cursor-pointer transition-all ${selected ? 'border-amber-500 bg-amber-100 shadow-md' : 'border-amber-200 bg-white/80 hover:border-amber-400 hover:shadow-sm'}`}>
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-[13px] font-bold text-zinc-900 truncate">{item.name}</div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className="text-[14px] font-semibold text-zinc-600">{item.onHand} {item.unit}</span>
                                          {selected && <span className="text-amber-500 font-bold text-[16px]">✓</span>}
                                        </div>
                                      </div>
                                      {selected && (
                                        <div className="mt-3 flex items-center gap-2 pl-9" onClick={(e) => e.stopPropagation()}>
                                          <span className="text-[11px] text-amber-700 font-semibold">Qty:</span>
                                          <button
                                            onClick={() => updateBaseCakeQty(item.id, selected.qty - 1)}
                                            className="w-7 h-7 rounded-lg border border-amber-300 bg-white flex items-center justify-center text-amber-700 hover:bg-amber-100 font-bold text-[14px]"
                                          >−</button>
                                          <input
                                            type="number"
                                            min="1"
                                            max={item.onHand}
                                            value={selected.qty}
                                            onChange={e => updateBaseCakeQty(item.id, parseInt(e.target.value) || 1)}
                                            className="w-14 text-center rounded-lg border border-amber-300 px-1 py-1 text-[13px] font-mono font-bold outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                                          />
                                          <button
                                            onClick={() => updateBaseCakeQty(item.id, Math.min(selected.qty + 1, item.onHand))}
                                            className="w-7 h-7 rounded-lg border border-amber-300 bg-white flex items-center justify-center text-amber-700 hover:bg-amber-100 font-bold text-[14px]"
                                          >+</button>
                                          <span className="text-[11px] text-zinc-500">{item.unit}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Production Prep Section */}
                          {prepInventory.length > 0 && (
                            <div>
                              <div className="text-[11px] uppercase tracking-wider text-blue-700 font-semibold mb-3">Production Prep</div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {prepInventory.map(item => {
                                  const selected = selectedBaseCakes.find(b => b.inventoryId === item.id);
                                  return (
                                    <div key={`prep-${item.id}`} onClick={() => toggleBaseCake(item, "Production Prep")} className={`rounded-xl border p-4 cursor-pointer transition-all ${selected ? 'border-blue-500 bg-blue-100 shadow-md' : 'border-blue-200 bg-white/80 hover:border-blue-400 hover:shadow-sm'}`}>
                                      <div className="flex items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[13px] font-bold text-zinc-900 truncate">{item.name}</div>
                                          <div className="text-[11px] text-zinc-500">{item.onHand} {item.unit} available</div>
                                        </div>
                                        {selected && <span className="text-blue-500 font-bold text-[16px]">✓</span>}
                                      </div>
                                      {selected && (
                                        <div className="mt-3 flex items-center gap-2 pl-9" onClick={(e) => e.stopPropagation()}>
                                          <span className="text-[11px] text-blue-700 font-semibold">Qty:</span>
                                          <button
                                            onClick={() => updateBaseCakeQty(item.id, selected.qty - 1)}
                                            className="w-7 h-7 rounded-lg border border-blue-300 bg-white flex items-center justify-center text-blue-700 hover:bg-blue-100 font-bold text-[14px]"
                                          >−</button>
                                          <input
                                            type="number"
                                            min="1"
                                            max={item.onHand}
                                            value={selected.qty}
                                            onChange={e => updateBaseCakeQty(item.id, parseInt(e.target.value) || 1)}
                                            className="w-14 text-center rounded-lg border border-blue-300 px-1 py-1 text-[13px] font-mono font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                          />
                                          <button
                                            onClick={() => updateBaseCakeQty(item.id, Math.min(selected.qty + 1, item.onHand))}
                                            className="w-7 h-7 rounded-lg border border-blue-300 bg-white flex items-center justify-center text-blue-700 hover:bg-blue-100 font-bold text-[14px]"
                                          >+</button>
                                          <span className="text-[11px] text-zinc-500">{item.unit}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {selectedBaseCakes.length === 0 && (
                            <div className="rounded-xl border border-dashed border-amber-300 bg-white/60 px-4 py-6 text-center">
                              <p className="text-[13px] text-amber-600 font-semibold">Click on items above to select base cakes</p>
                              <p className="text-[11px] text-zinc-400 mt-1">You can select multiple base cakes and set quantity for each</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Linked Packaging */}
                  <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50 overflow-hidden">
                    <div className="px-6 py-4 bg-blue-100/60 border-b border-blue-200/60">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-[18px]">📦</div>
                        <div>
                          <h3 className="text-[15px] font-bold text-blue-900">Packaging Materials</h3>
                          <p className="text-[12px] text-blue-600">Select boxes, stickers, and packaging</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-5 space-y-3">
                      {packagingItems.length === 0 && extraPackaging.length === 0 ? (
                        <>
                          <div className="rounded-xl border border-dashed border-blue-300 bg-white/60 px-4 py-4 text-center">
                            <p className="text-[13px] text-blue-400">No packaging materials linked yet</p>
                            <p className="text-[11px] text-zinc-400 mt-1">Select from dropdown below to add</p>
                          </div>
                          <SearchableDropdown items={inventory.filter(i => i.group === "packaging-materials" && i.onHand > 0 && !extraPackaging.some(p => p.inventoryId === i.id)).map(i => ({ id: i.id, label: i.name, sublabel: `${i.onHand} ${i.unit} available` }))} onChange={id => { const inv = inventory.find(i => i.id === id); if (inv) setExtraPackaging(prev => [...prev, { name: inv.name, qty: 1, unit: inv.unit, inventoryId: inv.id }]); }} placeholder="Search packaging items..." accentColor="blue" />
                        </>
                      ) : (
                        <>
                          <div className="rounded-xl border border-blue-200 bg-white/80 divide-y divide-blue-100/60 overflow-hidden">
                            {packagingItems.map((p, i) => (
                              <div key={`pkg-${i}`} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-[14px]">📦</div>
                                  <div>
                                    <div className="text-[14px] font-semibold text-zinc-800">{p.name}</div>
                                    <div className="text-[11px] text-zinc-400">from {p.source}</div>
                                  </div>
                                </div>
                                <div className="text-[14px] font-mono font-bold text-blue-600">{formatQty(p.qty * designQty, p.unit)} {p.unit}</div>
                              </div>
                            ))}
                            {extraPackaging.map((p, i) => (
                              <div key={`extra-pkg-${i}`} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-[14px]">📦</div>
                                  <div>
                                    <div className="text-[14px] font-semibold text-zinc-800">{p.name}</div>
                                    <div className="text-[11px] text-blue-500">manually added</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <input type="number" min="1" value={p.qty} onChange={e => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    setExtraPackaging(prev => prev.map((item, idx) => idx === i ? { ...item, qty: val } : item));
                                  }} className="w-16 text-center rounded-lg border border-blue-200 px-2 py-1.5 text-[13px] font-mono outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                                  <span className="text-[12px] text-zinc-500">{p.unit}</span>
                                  <button onClick={() => setExtraPackaging(prev => prev.filter((_, idx) => idx !== i))} className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 hover:text-red-700 transition-colors text-[12px]">✕</button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <SearchableDropdown items={inventory.filter(i => i.group === "packaging-materials" && i.onHand > 0 && !extraPackaging.some(p => p.inventoryId === i.id)).map(i => ({ id: i.id, label: i.name, sublabel: `${i.onHand} ${i.unit} available` }))} onChange={id => { const inv = inventory.find(i => i.id === id); if (inv) setExtraPackaging(prev => [...prev, { name: inv.name, qty: 1, unit: inv.unit, inventoryId: inv.id }]); }} placeholder="Search packaging items..." accentColor="blue" />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Linked Decoration Supplies */}
                  <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 overflow-hidden">
                    <div className="px-6 py-4 bg-purple-100/60 border-b border-purple-200/60">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center text-[18px]">✨</div>
                        <div>
                          <h3 className="text-[15px] font-bold text-purple-900">Decoration Supplies</h3>
                          <p className="text-[12px] text-purple-600">Toppers, candles, and decorations</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-5 space-y-3">
                      {decorationItems.length === 0 && extraDecoration.length === 0 ? (
                        <>
                          <div className="rounded-xl border border-dashed border-purple-300 bg-white/60 px-4 py-4 text-center">
                            <p className="text-[13px] text-purple-400">No decoration supplies linked yet</p>
                            <p className="text-[11px] text-zinc-400 mt-1">Select from dropdown below to add</p>
                          </div>
                          <SearchableDropdown items={inventory.filter(i => i.group === "decoration-supplies" && i.onHand > 0 && !extraDecoration.some(d => d.inventoryId === i.id)).map(i => ({ id: i.id, label: i.name, sublabel: `${i.onHand} ${i.unit} available` }))} onChange={id => { const inv = inventory.find(i => i.id === id); if (inv) setExtraDecoration(prev => [...prev, { name: inv.name, qty: 1, unit: inv.unit, inventoryId: inv.id }]); }} placeholder="Search decoration supplies..." accentColor="purple" />
                        </>
                      ) : (
                        <>
                          <div className="rounded-xl border border-purple-200 bg-white/80 divide-y divide-purple-100/60 overflow-hidden">
                            {decorationItems.map((s, i) => (
                              <div key={`deco-${i}`} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-[14px]">✨</div>
                                  <div>
                                    <div className="text-[14px] font-semibold text-zinc-800">{s.name}</div>
                                    <div className="text-[11px] text-zinc-400">from {s.source}</div>
                                  </div>
                                </div>
                                <div className="text-[14px] font-mono font-bold text-purple-600">{formatQty(s.qty * designQty, s.unit)} {s.unit}</div>
                              </div>
                            ))}
                            {extraDecoration.map((d, i) => (
                              <div key={`extra-deco-${i}`} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-[14px]">✨</div>
                                  <div>
                                    <div className="text-[14px] font-semibold text-zinc-800">{d.name}</div>
                                    <div className="text-[11px] text-purple-500">manually added</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <input type="number" min="1" value={d.qty} onChange={e => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    setExtraDecoration(prev => prev.map((item, idx) => idx === i ? { ...item, qty: val } : item));
                                  }} className="w-16 text-center rounded-lg border border-purple-200 px-2 py-1.5 text-[13px] font-mono outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100" />
                                  <span className="text-[12px] text-zinc-500">{d.unit}</span>
                                  <button onClick={() => setExtraDecoration(prev => prev.filter((_, idx) => idx !== i))} className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 hover:text-red-700 transition-colors text-[12px]">✕</button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <SearchableDropdown items={inventory.filter(i => i.group === "decoration-supplies" && i.onHand > 0 && !extraDecoration.some(d => d.inventoryId === i.id)).map(i => ({ id: i.id, label: i.name, sublabel: `${i.onHand} ${i.unit} available` }))} onChange={id => { const inv = inventory.find(i => i.id === id); if (inv) setExtraDecoration(prev => [...prev, { name: inv.name, qty: 1, unit: inv.unit, inventoryId: inv.id }]); }} placeholder="Search decoration supplies..." accentColor="purple" />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Extra Ingredients */}
                  <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden">
                    <div className="px-6 py-4 bg-amber-100/60 border-b border-amber-200/60">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-[20px]">🥚</div>
                        <div>
                          <h3 className="text-[15px] font-bold text-amber-900">Extra Ingredients</h3>
                          <p className="text-[12px] text-amber-600">Add ingredients from My Inventory if needed</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-5 space-y-3">
                      {extraIngredients.length === 0 ? (
                        <>
                          <div className="rounded-xl border border-dashed border-amber-300 bg-white/60 px-4 py-4 text-center">
                            <p className="text-[13px] text-amber-400">No extra ingredients added</p>
                            <p className="text-[11px] text-zinc-400 mt-1">Select from below to add</p>
                          </div>
                          <SearchableDropdown items={inventory.filter(i => i.group === "ingredients" && i.onHand > 0 && !extraIngredients.some(e => e.inventoryId === i.id)).map(i => ({ id: i.id, label: i.name, sublabel: `${i.onHand} ${i.unit} available` }))} onChange={id => { const inv = inventory.find(i => i.id === id); if (inv) setExtraIngredients(prev => [...prev, { name: inv.name, qty: 1, unit: inv.unit, inventoryId: inv.id }]); }} placeholder="Search ingredients..." accentColor="amber" />
                        </>
                      ) : (
                        <>
                          <div className="rounded-xl border border-amber-200 bg-white/80 divide-y divide-amber-100/60 overflow-hidden">
                            {extraIngredients.map((item, i) => (
                              <div key={`ing-${i}`} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-[14px]">🥚</div>
                                  <div>
                                    <div className="text-[14px] font-semibold text-zinc-800">{item.name}</div>
                                    <div className="text-[11px] text-amber-500">manually added</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <input type="number" min="1" value={item.qty} onFocus={e => e.target.select()} onChange={e => { const v = e.target.value; setExtraIngredients(prev => prev.map((it, idx) => idx === i ? { ...it, qty: v === "" ? "" : Math.max(1, Number(v) || 1) } : it)); }} onBlur={e => { if (e.target.value === "" || Number(e.target.value) < 1) setExtraIngredients(prev => prev.map((it, idx) => idx === i ? { ...it, qty: 1 } : it)); }} className="w-16 text-center rounded-lg border border-amber-200 px-2 py-1.5 text-[13px] font-mono outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                                  <span className="text-[12px] text-zinc-500">{item.unit}</span>
                                  <button onClick={() => setExtraIngredients(prev => prev.filter((_, idx) => idx !== i))} className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 hover:text-red-700 transition-colors text-[12px]">✕</button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <SearchableDropdown items={inventory.filter(i => i.group === "ingredients" && i.onHand > 0 && !extraIngredients.some(e => e.inventoryId === i.id)).map(i => ({ id: i.id, label: i.name, sublabel: `${i.onHand} ${i.unit} available` }))} onChange={id => { const inv = inventory.find(i => i.id === id); if (inv) setExtraIngredients(prev => [...prev, { name: inv.name, qty: 1, unit: inv.unit, inventoryId: inv.id }]); }} placeholder="Search ingredients..." accentColor="amber" />
                        </>
                      )}
                    </div>
                  </div>

                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-zinc-100 bg-zinc-50/50 flex gap-3">
                  <button onClick={() => { setDesignModal(null); setSelectedBaseCakes([]); }} className="flex-1 rounded-2xl border-2 border-zinc-200 py-3.5 text-[15px] font-semibold text-zinc-600 hover:bg-zinc-100 transition-all">Cancel</button>
                  <button onClick={confirmDesign} className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3.5 text-[15px] font-semibold text-white hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl">
                    {selectedBaseCakes.length > 0 ? `Add ${selectedBaseCakes.length} Base Cake${selectedBaseCakes.length > 1 ? 's' : ''} to Queue` : 'Add to Queue'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Workflow Nav */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
          <div className="text-[12px] text-zinc-400">Step {currentStepIdx + 1} of {workflowSteps.length}</div>
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
          <p className="mt-1 text-[13px] text-zinc-500">View ingredient stock from the Stock Room.</p>
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

  if (activeTab === "freezer") {
    const myFreezer = freezerItems.filter(i => i.producedBy === "deco");
    const decoOnlyInventory = inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("deco"));
    
    // Categorization logic
    const tabs: ("Display Cakes" | "Production Recipe" | "Advanced Premix" | "My Inventory")[] = ["Display Cakes", "Production Recipe", "Advanced Premix", "My Inventory"];
    const displayCakes = myFreezer.filter(i => !i.notes?.startsWith("Production Recipe") && !i.batchRef?.startsWith("ADV-") && i.qty > 0);
    const productionRecipes = myFreezer.filter(i => i.notes?.startsWith("Production Recipe") && !i.batchRef?.startsWith("ADV-") && i.qty > 0);
    const advancedPremixItems = myFreezer.filter(i => i.batchRef?.startsWith("ADV-") && i.qty > 0);
    const getFilteredItems = () => {
        if (freezerTab === "Display Cakes") return displayCakes;
        if (freezerTab === "Production Recipe") return productionRecipes;
        if (freezerTab === "Advanced Premix") return advancedPremixItems;
        return decoOnlyInventory as unknown as FreezerItem[];
    };
    
    const isInventoryTab = freezerTab === "My Inventory";
    const filtered = (isInventoryTab
      ? (getFilteredItems() as unknown as InventoryItem[]).filter(i => !freezerSearch || i.name.toLowerCase().includes(freezerSearch.toLowerCase()))
      : getFilteredItems().filter(i => !freezerSearch || i.productName.toLowerCase().includes(freezerSearch.toLowerCase()))
    );
    const sortedInventory = isInventoryTab
      ? ([...filtered as unknown as InventoryItem[]].sort((a, b) => {
          const sourceOrder = (s?: string) => s === "production-prep" ? 0 : s === "came-from-baker" ? 1 : 2;
          const aOrder = sourceOrder(a.source);
          const bOrder = sourceOrder(b.source);
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.name.localeCompare(b.name);
        }))
      : null;

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
      <>
      <div className="space-y-5">
        <div className="rounded-3xl bg-white p-8 shadow-lg border border-zinc-200">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-[36px] font-bold tracking-tight text-zinc-900">Freezer — Finished Products</h1>
              <p className="mt-2 text-[15px] text-zinc-500">Track decorated products ready for dispatch.</p>
            </div>
          </div>
        </div>

        {/* Pill Tabs */}
        <div className="flex gap-2 rounded-2xl bg-zinc-100 p-1.5">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setFreezerTab(tab)} className={`flex-1 rounded-xl py-3 text-[14px] font-semibold transition-all ${freezerTab === tab ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {tabs.map(tab => {
            const count = tab === "Display Cakes" ? displayCakes.length : tab === "Production Recipe" ? productionRecipes.length : tab === "Advanced Premix" ? advancedPremixItems.length : decoOnlyInventory.length;
            return (
              <button key={tab} onClick={() => setFreezerTab(tab)} className={`rounded-2xl border p-5 text-left transition-all hover:shadow-md ${freezerTab === tab ? "bg-amber-50 border-amber-300" : "bg-white border-zinc-200 hover:border-zinc-300"}`}>
                <div className="text-[12px] text-zinc-400 uppercase tracking-wider font-semibold">{tab}</div>
                <div className="text-[28px] font-bold text-zinc-900 mt-2">{count}</div>
              </button>
            );
          })}
        </div>

        <div className="relative max-w-[280px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px]">⌕</span>
          <input value={freezerSearch} onChange={e => setFreezerSearch(e.target.value)} placeholder={isInventoryTab ? "Search inventory..." : "Search products..."} className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-2.5 text-[13px] focus:outline-none focus:border-zinc-400" />
        </div>

        {isInventoryTab ? (() => {
          const prepItems = (sortedInventory ?? []).filter(i => i.source === "production-prep");
          const bakerItems = (sortedInventory ?? []).filter(i => i.source === "came-from-baker");
          const manualItems = (sortedInventory ?? []).filter(i => !i.source || i.source === "manual");
          return (
            <div className="space-y-4">
              {/* Production Prep Items */}
              {prepItems.length > 0 && (
                <div className="rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-emerald-50/60 border-b border-emerald-100">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-700">From Production Prep</span>
                    <span className="ml-2 text-[10px] text-emerald-600">({prepItems.length})</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-50 border-b border-zinc-100">
                        <tr className="text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                          <th className="px-5 py-3">Product</th>
                          <th className="px-5 py-3 text-right">Qty</th>
                          <th className="px-5 py-3">Category</th>
                          <th className="px-5 py-3">Section</th>
                          <th className="px-5 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {prepItems.map(inv => (
                          <tr key={inv.id} className="hover:bg-emerald-50/20 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="text-[13px] font-medium text-zinc-900">{inv.name}</div>
                              <div className="text-[11px] text-zinc-400 font-mono mt-0.5">{inv.sku}</div>
                            </td>
                            <td className="px-5 py-3.5 text-[13px] text-right font-mono font-semibold" style={{ color: inv.onHand === 0 ? "#ef4444" : inv.onHand < inv.threshold ? "#f59e0b" : "#16a34a" }}>{inv.onHand} {inv.unit}</td>
                            <td className="px-5 py-3.5"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{inv.category}</span></td>
                            <td className="px-5 py-3.5"><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">Production Prep</span></td>
                            <td className="px-5 py-3.5">
                              <button onClick={() => {
                                onUpdateInventory((prev: InventoryItem[]) => prev.filter(i => i.id !== inv.id));
                                db.deleteInventoryItem(inv.id, inv.group).catch(console.error);
                              }} className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 transition-all">Del</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* From Baker Items */}
              {true && (
                <div className="rounded-[24px] border border-amber-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-amber-50/60 border-b border-amber-100">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-700">From Baker</span>
                      <span className="ml-2 text-[10px] text-amber-600">({bakerItems.length})</span>
                    </div>
                    <button onClick={() => { setBakerInvProduct(""); setBakerInvSize(""); setBakerInvQty(0); setBakerInvCategory("dry"); db.fetchProductCategories().then(map => setProductCategoryMap(map)).catch(() => {}); setShowAddBakerInventory(true); }} className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-amber-700 transition-colors">+ Add</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-amber-50/30 border-b border-amber-100">
                        <tr className="text-[11px] uppercase tracking-wider text-amber-700" style={{ fontFamily: "Fragment Mono, monospace" }}>
                          <th className="px-5 py-3">Product</th>
                          <th className="px-5 py-3 text-right">Qty</th>
                          <th className="px-5 py-3">Category</th>
                          <th className="px-5 py-3">Section</th>
                          <th className="px-5 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-50">
                        {bakerItems.map(inv => (
                          <tr key={inv.id} className="hover:bg-amber-50/30 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="text-[13px] font-medium text-zinc-900">{inv.name}</div>
                              <div className="text-[11px] text-zinc-400 font-mono mt-0.5">{inv.sku}</div>
                            </td>
                            <td className="px-5 py-3.5 text-[13px] text-right font-mono font-semibold" style={{ color: inv.onHand === 0 ? "#ef4444" : inv.onHand < inv.threshold ? "#f59e0b" : "#16a34a" }}>{inv.onHand} {inv.unit}</td>
                            <td className="px-5 py-3.5"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{inv.category}</span></td>
                            <td className="px-5 py-3.5"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">From Baker</span></td>
                            <td className="px-5 py-3.5">
                              <button onClick={() => {
                                onUpdateInventory((prev: InventoryItem[]) => prev.filter(i => i.id !== inv.id));
                                db.deleteInventoryItem(inv.id, inv.group).catch(console.error);
                              }} className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 transition-all">Del</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Manual Items */}
              {manualItems.length > 0 && (
                <div className="rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">Manual</span>
                    <span className="ml-2 text-[10px] text-zinc-400">({manualItems.length})</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-50 border-b border-zinc-100">
                        <tr className="text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                          <th className="px-5 py-3">Product</th>
                          <th className="px-5 py-3 text-right">Qty</th>
                          <th className="px-5 py-3">Category</th>
                          <th className="px-5 py-3">Section</th>
                          <th className="px-5 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {manualItems.map(inv => (
                          <tr key={inv.id} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="text-[13px] font-medium text-zinc-900">{inv.name}</div>
                              <div className="text-[11px] text-zinc-400 font-mono mt-0.5">{inv.sku}</div>
                            </td>
                            <td className="px-5 py-3.5 text-[13px] text-right font-mono font-semibold" style={{ color: inv.onHand === 0 ? "#ef4444" : inv.onHand < inv.threshold ? "#f59e0b" : "#16a34a" }}>{inv.onHand} {inv.unit}</td>
                            <td className="px-5 py-3.5"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{inv.category}</span></td>
                            <td className="px-5 py-3.5"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 border border-zinc-200">Manual</span></td>
                            <td className="px-5 py-3.5"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {prepItems.length === 0 && bakerItems.length === 0 && manualItems.length === 0 && (
                <div className="rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-12 text-center text-[13px] text-zinc-400">No inventory items with deco-only access.</div>
                </div>
              )}
            </div>
          );
        })() : freezerTab === "Display Cakes" ? (
              <div className="rounded-[24px] border border-rose-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-rose-50/60 border-b border-rose-100">
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-rose-700">Display Cakes</span>
                  <span className="ml-2 text-[10px] text-rose-600">({displayCakes.length})</span>
                </div>
                <button onClick={() => { setDisplayCakeProduct(""); setDisplayCakeSize(""); setDisplayCakeQty(0); db.fetchProductCategories().then(map => setProductCategoryMap(map)).catch(() => {}); setShowAddDisplayCake(true); }} className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-rose-700 transition-colors">+ Add</button>
              </div>
              <table className="w-full text-left">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr className="text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3 text-right">Qty</th>
                    <th className="px-5 py-3">Unit</th>
                    <th className="px-5 py-3">Date Added</th>
                    <th className="px-5 py-3 text-center">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {(filtered as FreezerItem[]).length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-zinc-400">No display cakes in freezer.</td></tr>
                  ) : (filtered as FreezerItem[]).map(item => (
                    <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="text-[13px] font-medium text-zinc-900">{item.productName}</div>
                        {item.notes && <div className="text-[11px] text-zinc-400 mt-0.5">{item.notes}</div>}
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-right font-mono">{item.qty}</td>
                      <td className="px-5 py-3.5 text-[13px] text-zinc-500">{item.unit}</td>
                      <td className="px-5 py-3.5 text-[12px] text-zinc-500">{item.dateProduced}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`text-[11px] font-medium ${item.status === "stored" ? "text-emerald-600" : item.status === "dispatched" ? "text-blue-600" : "text-amber-600"}`}>
                          {item.status === "stored" ? "✓ In Stock" : item.status === "dispatched" ? "→ Dispatched" : "⚠ Low Stock"}
                        </span>
                      </td>
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
            ) : freezerTab === "Advanced Premix" ? (
              <div className="space-y-3">
                {(filtered as FreezerItem[]).length === 0 ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-[13px] text-zinc-400">No advanced premix items in freezer.</div>
                ) : (filtered as FreezerItem[]).map(item => (
                  <div key={item.id} className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white text-[13px] font-bold">ADV</div>
                      <div>
                        <div className="text-[14px] font-semibold text-zinc-900">{item.productName}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-mono text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">{item.batchRef}</span>
                          {item.notes && <span className="text-[11px] text-zinc-400 truncate max-w-[200px]">{item.notes}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[18px] font-bold text-zinc-900 font-mono">{item.qty} <span className="text-[12px] font-normal text-zinc-500">{item.unit}</span></div>
                        <div className="text-[11px] text-zinc-400">{item.dateProduced}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { setEditingFreezerItem(item); setShowEditFreezer(true); }} className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-amber-50">Edit</button>
                        <button onClick={() => { if (confirm(`Delete ${item.productName}?`)) { const updated = freezerItems.filter(f => f.id !== item.id); onUpdateFreezer?.(updated); db.deleteFreezerItem(item.id).catch(console.error); } }} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50">Del</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
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
                  {(filtered as FreezerItem[]).length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-zinc-400">No products in Production Recipe freezer.</td></tr>
                  ) : (filtered as FreezerItem[]).map(item => (
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
            )}
          </div>

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

        {showAddBakerInventory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddBakerInventory(false)}>
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-[18px] font-semibold mb-4">Add to From Baker</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Product</label>
                  <select value={bakerInvProduct} onChange={e => setBakerInvProduct(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400">
                    <option value="">Select product...</option>
                    {productCatalog.filter(p => productCategoryMap[p] === "Freezer Deco").map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Size</label>
                  <select value={bakerInvSize} onChange={e => setBakerInvSize(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400">
                    <option value="">No size</option>
                    {["Small","Regular","Large","6x1","6x2","6x3","8x1","8x2","8x3","10x1","10x2","10x3","12x1","12x2","14x1","14x2","16x1","Sheet"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Qty</label>
                  <input type="number" min={1} value={bakerInvQty || ""} onChange={e => setBakerInvQty(Number(e.target.value) || 0)} placeholder="0" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] font-mono outline-none focus:border-zinc-400" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowAddBakerInventory(false)} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button disabled={!bakerInvProduct || bakerInvQty <= 0} onClick={() => {
                  const newItem: InventoryItem = {
                    id: `INV-BAKER-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    name: bakerInvProduct,
                    sku: `BAKE-DECO-${Date.now()}`,
                    unit: "pcs",
                    onHand: bakerInvQty,
                    threshold: 0,
                    cost: 0,
                    supplier: "",
                    lastIn: new Date().toISOString(),
                    category: "dry",
                    group: "ingredients",
                    accessRoles: ["deco"],
                    source: "came-from-baker",
                    size: bakerInvSize || undefined,
                  };
                  onUpdateInventory((prev: InventoryItem[]) => [...prev, newItem]);
                  db.upsertInventory([newItem]).then(() => {
                    showToast("Item saved to database");
                  }).catch(err => {
                    console.error(err);
                    showToast("Failed to save to database: " + (err.message || "Unknown error"));
                    onUpdateInventory((prev: InventoryItem[]) => prev.filter(i => i.id !== newItem.id));
                  });
                  setShowAddBakerInventory(false);
                }} className="flex-1 rounded-xl bg-amber-600 py-2.5 text-[13px] font-medium text-white hover:bg-amber-700 disabled:opacity-40">Add Item</button>
              </div>
            </div>
          </div>
        )}

        {showAddDisplayCake && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddDisplayCake(false)}>
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-[18px] font-semibold mb-4">Add to Display Cakes</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Product</label>
                  <select value={displayCakeProduct} onChange={e => setDisplayCakeProduct(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400">
                    <option value="">Select product...</option>
                    {productCatalog.filter(p => productCategoryMap[p] === "Display Cakes").map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Size</label>
                  <select value={displayCakeSize} onChange={e => setDisplayCakeSize(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400">
                    <option value="">No size</option>
                    {["Small","Regular","Large","6x1","6x2","6x3","8x1","8x2","8x3","10x1","10x2","10x3","12x1","12x2","14x1","14x2","16x1","Sheet"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Qty</label>
                  <input type="number" min={1} value={displayCakeQty || ""} onChange={e => setDisplayCakeQty(Number(e.target.value) || 0)} placeholder="0" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] font-mono outline-none focus:border-zinc-400" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowAddDisplayCake(false)} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button disabled={!displayCakeProduct || displayCakeQty <= 0} onClick={() => {
                  const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
                  const newItem: FreezerItem = {
                    id: `FRZ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    productName: displayCakeProduct,
                    qty: displayCakeQty,
                    unit: "pcs",
                    batchRef: `DECO-${Date.now()}`,
                    producedBy: "deco",
                    dateProduced: today,
                    status: "stored",
                    notes: displayCakeSize ? `Size: ${displayCakeSize}` : undefined,
                    size: displayCakeSize || undefined,
                  };
                  onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, newItem]);
                  db.upsertFreezerItems([newItem]).then(() => {
                    showToast("Display cake added to freezer");
                  }).catch(err => {
                    console.error(err);
                    showToast("Failed to save: " + (err.message || "Unknown error"));
                    onUpdateFreezer?.((prev: FreezerItem[]) => prev.filter(i => i.id !== newItem.id));
                  });
                  setShowAddDisplayCake(false);
                }} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-[13px] font-medium text-white hover:bg-rose-700 disabled:opacity-40">Add Item</button>
              </div>
            </div>
          </div>
        )}

      </>
    );
  }

  /* ── Waste / Adjustment ── */
  if (activeTab === "waste-adjustment") {
    const wasteReasons = ["Spoilage", "Damaged / Breakage", "Expired", "Overproduction", "Quality Issue", "Wrong Product", "Contamination", "Other"];
    const sourceOptions = [
      { id: "freezer-display" as const, label: "Freezer - Display Cakes" },
      { id: "freezer-production" as const, label: "Freezer - Production Recipe" },
      { id: "freezer-advanced" as const, label: "Freezer - Advanced Premix" },
      { id: "my-inventory" as const, label: "My Inventory" },
    ];

    const getSourceItems = () => {
      switch (wasteSource) {
        case "freezer-display": return freezerItems.filter(i => i.producedBy === "deco" && !i.notes?.startsWith("Production Recipe") && !i.batchRef?.startsWith("ADV-") && i.qty > 0).map(i => ({ id: i.id, name: i.productName, qty: i.qty, unit: i.unit, source: "freezer" as const }));
        case "freezer-production": return freezerItems.filter(i => i.producedBy === "deco" && i.notes?.startsWith("Production Recipe") && !i.batchRef?.startsWith("ADV-") && i.qty > 0).map(i => ({ id: i.id, name: i.productName, qty: i.qty, unit: i.unit, source: "freezer" as const }));
        case "freezer-advanced": return freezerItems.filter(i => i.producedBy === "deco" && i.batchRef?.startsWith("ADV-") && i.qty > 0).map(i => ({ id: i.id, name: i.productName, qty: i.qty, unit: i.unit, source: "freezer" as const }));
        case "my-inventory": return inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("deco")).map(i => ({ id: i.id, name: i.name, qty: i.onHand, unit: i.unit, source: "inventory" as const }));
      }
    };
    const sourceItems = getSourceItems();
    const selectedItem = sourceItems.find(s => s.id === wasteItemId);

    const handleRecordWaste = async () => {
      if (!selectedItem || wasteQty <= 0) return;
      if (wasteQty > selectedItem.qty) {
        if (!confirm(`Only ${selectedItem.qty} ${selectedItem.unit} available. Record waste of ${wasteQty} anyway?`)) return;
      }

      const sourceLabels: Record<string, string> = {
        "freezer-display": "Deco - Freezer Display Cakes",
        "freezer-production": "Deco - Freezer Production Recipe",
        "freezer-advanced": "Deco - Freezer Advanced Premix",
        "my-inventory": "Deco - My Inventory",
      };

      // Get cost info from inventory item
      const itemCost = selectedItem.source === "inventory"
        ? inventory.find(i => i.id === selectedItem.id)?.cost ?? 0
        : 0;
      const unitCost = itemCost;
      const totalCost = unitCost * wasteQty;

      const log: WasteLog = {
        id: `WASTE-${Date.now()}`,
        product: selectedItem.name,
        qtyRejected: wasteQty,
        unitCost,
        totalCost,
        reason: wasteReason,
        source: sourceLabels[wasteSource] || wasteSource,
        referenceId: selectedItem.id,
        date: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0],
      };

      // Deduct from source
      const deductedQty = wasteQty;
      try {
        if (selectedItem.source === "inventory") {
          const currentItem = inventory.find(i => i.id === selectedItem.id);
          if (!currentItem) { alert("Item not found in inventory."); return; }
          const newOnHand = Math.max(0, currentItem.onHand - deductedQty);
          onUpdateInventory(prev => prev.map(i => i.id === currentItem.id ? { ...i, onHand: newOnHand } : i));
          await db.upsertInventoryItem({ ...currentItem, onHand: newOnHand });
          onStockTransaction?.({ id: `STX-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, type: "out", itemName: selectedItem.name, itemId: selectedItem.id, qty: deductedQty, unit: selectedItem.unit, reference: `Waste: ${wasteReason || "adjustment"}`, timestamp: new Date().toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), target: "deco", group: currentItem.group, role: "deco" });
        } else {
          const currentFz = freezerItems.find(i => i.id === selectedItem.id);
          if (!currentFz) { alert("Item not found in freezer."); return; }
          const newQty = Math.max(0, currentFz.qty - deductedQty);
          onUpdateFreezer?.(prev => prev.map(i => i.id === currentFz.id ? { ...i, qty: newQty } : i));
          await db.upsertFreezerItems([{ ...currentFz, qty: newQty }]);
        }
      } catch (err) {
        alert("Failed to deduct stock: " + (err instanceof Error ? err.message : String(err)));
        return;
      }

      // Save to shared waste_log (visible in Admin Finance)
      try {
        onUpdateWasteLog?.(prev => [log, ...prev]);
        await db.upsertWasteLog([log]);
      } catch (err) {
        alert("Failed to save waste record: " + (err instanceof Error ? err.message : String(err)));
        return;
      }
      onAddAuditLog?.("DECO_WASTE_RECORDED", `${selectedItem.name} ×${wasteQty} ${selectedItem.unit} — ${wasteReason} (${wasteSource})`);

      // Reset form
      setWasteQty(1);
      setWasteReason(wasteReasons[0]);

      setWasteItemId("");
      setWasteSearch("");
    };

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Waste & Adjustment</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Record wasted or adjusted stock from your inventory and freezer.</p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/40 p-5">
          <h2 className="text-[15px] font-semibold text-zinc-900 mb-4">Record Waste / Adjustment (- Stock)</h2>

          {/* Source Type */}
          <div className="mb-4">
            <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">Source</label>
            <div className="flex flex-wrap gap-2">
              {sourceOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setWasteSource(opt.id); setWasteItemId(""); }}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                    wasteSource === opt.id
                      ? "bg-red-600 text-white shadow-sm"
                      : "bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-400"
                  }`}
                >{opt.label}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Item Select */}
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">Item</label>
              {sourceItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-white/60 p-4 text-center text-[12px] text-zinc-400">No items in this source.</div>
              ) : (
                <div ref={wasteSearchRef} className="relative">
                  <input
                    value={wasteSearch}
                    onChange={e => { setWasteSearch(e.target.value); setWasteShowDropdown(true); setWasteItemId(""); }}
                    onFocus={() => setWasteShowDropdown(true)}
                    placeholder="Search items..."
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-red-400"
                  />
                  {wasteItemId && (() => {
                    const sel = sourceItems.find(s => s.id === wasteItemId);
                    return sel ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400 font-mono">{sel.qty} {sel.unit}</span> : null;
                  })()}
                  {wasteShowDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-48 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
                      {sourceItems
                        .filter(i => !wasteSearch || i.name.toLowerCase().includes(wasteSearch.toLowerCase()))
                        .map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => { setWasteItemId(item.id); setWasteSearch(item.name); setWasteShowDropdown(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-[13px] text-left hover:bg-red-50 transition-colors ${wasteItemId === item.id ? "bg-red-50 font-medium" : ""}`}
                          >
                            <span className="truncate">{item.name}</span>
                            <span className="shrink-0 ml-2 font-mono text-[12px] text-zinc-400">{item.qty} {item.unit}</span>
                          </button>
                        ))}
                      {sourceItems.filter(i => !wasteSearch || i.name.toLowerCase().includes(wasteSearch.toLowerCase())).length === 0 && (
                        <div className="px-3 py-3 text-[12px] text-zinc-400 text-center">No matches.</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Qty + Reason */}
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">Quantity to deduct</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWasteQty(q => Math.max(1, q - 1))}
                    disabled={!selectedItem}
                    className="w-8 h-8 rounded-lg border border-zinc-200 bg-white text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 flex items-center justify-center"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    value={wasteQty}
                    disabled={!selectedItem}
                    onChange={e => setWasteQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center font-mono text-[14px] font-semibold text-zinc-900 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 outline-none focus:border-red-400"
                  />
                  <button
                    onClick={() => setWasteQty(q => q + 1)}
                    disabled={!selectedItem}
                    className="w-8 h-8 rounded-lg border border-zinc-200 bg-white text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 flex items-center justify-center"
                  >+</button>
                  {selectedItem && <span className="text-[11px] text-zinc-400 font-mono">/ {selectedItem.qty} {selectedItem.unit}</span>}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">Reason</label>
                <select
                  value={wasteReason}
                  onChange={e => setWasteReason(e.target.value)}
                  disabled={!selectedItem}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-red-400"
                >
                  {wasteReasons.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>



          {/* Record Button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleRecordWaste}
              disabled={!selectedItem || wasteQty <= 0}
              className="rounded-xl bg-red-600 px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >Record Waste / Adjustment</button>
          </div>
        </div>

        {/* Waste History */}
        <div>
          <h2 className="text-[15px] font-semibold text-zinc-900 mb-3">Waste / Adjustment History</h2>
          {(() => {
            const decoEntries = wasteLog.filter(e => e.source.startsWith("Deco - "));
            if (decoEntries.length === 0) {
              return <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center"><p className="text-[14px] text-zinc-400">No waste/adjustment records yet.</p></div>;
            }
            return (
              <div className="overflow-hidden rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 border-b border-zinc-100">
                    <tr className="text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-[13px]">
                    {decoEntries.map(entry => (
                      <tr key={entry.id} className="hover:bg-red-50/30 transition-colors">
                        <td className="px-4 py-3 text-zinc-500 font-mono text-[12px]">{entry.date}</td>
                        <td className="px-4 py-3 font-medium text-zinc-900">{entry.product}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">-{entry.qtyRejected} pcs</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{entry.source}</span>
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{entry.reason}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={async () => {
                              if (confirm(`Delete waste record for ${entry.product}? This will NOT restore the stock.`)) {
                                onUpdateWasteLog?.(prev => prev.filter(e => e.id !== entry.id));
                                await db.upsertWasteLog([{ ...entry, source: entry.source + " (deleted)" }]).catch(console.error);
                              }
                            }}
                            className="rounded-lg border border-red-200 bg-white px-2 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-50 transition-all"
                          >Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  return null;
}

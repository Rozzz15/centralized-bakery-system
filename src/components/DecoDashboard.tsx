import { useEffect, useState, useRef, Fragment } from "react";
import type { ProductionTask, DOSItem, ProductRecipe, InventoryItem, FreezerItem, FreezerHistory, Role, WasteLog } from "../types";
import * as db from "../lib/db";

type DecoProductionPrep = { dosId: string; productName: string; productQty: number; prepared: boolean; done: boolean };

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
  freezerItemId?: string;
  sourceQty?: number;
  sourceBatchRef?: string;
  sourceProducedBy?: string;
  sourceSnapshot?: InventoryItem;
  createdAt?: string;
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
  wasteLog?: WasteLog[];
  onUpdateWasteLog?: (cb: WasteLog[] | ((prev: WasteLog[]) => WasteLog[])) => void;
};

export default function DecoDashboard({ production, dosItems, onCompleteTask, activeTab, setActiveTab, productCatalog, recipes, inventory, onUpdateInventory, onUpdateRecipes, onAddAuditLog, newDOSIds, onMarkDOSSeen, freezerItems = [], onUpdateFreezer, freezerHistory = [], wasteLog = [], onUpdateWasteLog }: Props) {
  // Defer setState calls to the next macrotask (setTimeout 0) to avoid
  // "Cannot update a component (App) while rendering DecoDashboard" warning.
  // queueMicrotask is NOT enough — React's setState also runs in microtasks.
  const defer = (fn: () => void) => { setTimeout(fn, 0); };

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

  const todayDOS = dosItems.filter(d => {
    if (d.status === "scheduled") return false;
    // Include items that were activated from scheduled (scheduledDate is still set but status !== "scheduled")
    if (d.scheduledDate && d.scheduledDate <= new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0]) return true;
    const ts = d.id.match(/DOS-(\d+)/)?.[1];
    if (!ts) return false;
    const itemDate = new Date(Number(ts)).toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    return itemDate === new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
  });
  const decoTaskProducts = new Set(production.filter(p => p.assignedTo === "deco").map(t => t.product));
  const dosForDeco = todayDOS.filter(d => (d.roles ?? []).includes("deco") && decoTaskProducts.has(d.product));

  useEffect(() => {
    if ((activeTab === "dashboard" || activeTab === "deco-queue") && dosForDeco.length > 0 && newDOSIds && onMarkDOSSeen) {
      const unseen = dosForDeco.filter(d => newDOSIds.has(d.id));
      if (unseen.length > 0) onMarkDOSSeen(unseen.map(d => d.id));
    }
  }, [activeTab]);

  const [editingRecipe, setEditingRecipe] = useState<string | null>(null);
  const [recipeDraft, setRecipeDraft] = useState<{ inventoryId: string; name: string; qtyPerBatch: number; unit: string }[]>([]);
  const [preMixPrepared, setPreMixPrepared] = useState<Set<string>>(new Set());
  const [preMixDone, setPreMixDone] = useState<Set<string>>(new Set());
  const [productQty, setProductQty] = useState<Record<string, number>>({});

  // Load from Supabase on mount
  useEffect(() => {
    db.fetchDecoProductionPrep().then(items => {
      const prepared = new Set<string>();
      const done = new Set<string>();
      const qty: Record<string, number> = {};
      items.forEach(i => {
        const key = `${i.dosId}-${i.productName.toLowerCase()}`;
        if (i.prepared) prepared.add(key);
        if (i.done) done.add(key);
        qty[i.dosId] = i.productQty;
      });
      setPreMixPrepared(prepared);
      setPreMixDone(done);
      setProductQty(qty);
    }).catch(console.error);
  }, []);

  // Save to Supabase on change
  useEffect(() => {
    const items: DecoProductionPrep[] = [];
    const allDosIds = new Set([...[...preMixPrepared].map(k => k.split("-")[0]), ...[...preMixDone].map(k => k.split("-")[0]), ...Object.keys(productQty)]);
    allDosIds.forEach(dosId => {
      const dos = dosForDeco.find(d => d.id === dosId);
      if (!dos) return;
      const directRecipe = recipes.find(r => r.productName === dos.product);
      const linkedRecipes = (directRecipe?.linkedProduct ?? [])
        .map(name => recipes.find(r => r.productName === name))
        .filter(Boolean)
        .filter(r => r!.productName !== dos.product);
      const allRecipes = linkedRecipes;
      if (allRecipes.length === 0) {
        const key = `${dosId}-${dos.product.toLowerCase()}`;
        items.push({ dosId, productName: dos.product, productQty: productQty[dosId] ?? dos.qty, prepared: preMixPrepared.has(key), done: preMixDone.has(key) });
      }
      allRecipes.forEach(r => {
        const key = `${dosId}-${r!.productName.toLowerCase()}`;
        items.push({ dosId, productName: r!.productName, productQty: productQty[dosId] ?? dos.qty, prepared: preMixPrepared.has(key), done: preMixDone.has(key) });
      });
    });
    if (items.length > 0) db.saveDecoProductionPrep(items).catch(console.error);
  }, [preMixPrepared, preMixDone, productQty]);
  const [advMixSearch, setAdvMixSearch] = useState("");
  const [selectedAdvRecipes, setSelectedAdvRecipes] = useState<Set<string>>(new Set());
  const [advMixQtys, setAdvMixQtys] = useState<Record<string, number>>({});
  const [advMixAdjustments, setAdvMixAdjustments] = useState<Record<string, Record<string, number>>>({});
  const [isAdvLocked, setIsAdvLocked] = useState(false);
  const [showAdvConfirm, setShowAdvConfirm] = useState(false);

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
  const [freezerTab, setFreezerTab] = useState<"Display Cakes" | "Production Recipe" | "Advanced Premix" | "My Inventory">("Display Cakes");

  const [customOrders, setCustomOrders] = useState<CustomOrder[]>([
    { id: "CO-001", customer: "Anna Santos", product: "Chocolate Cake", request: "Pink ribbon + gold topper + #21 candle", status: "pending", createdAt: "May 28, 10:30 AM" },
    { id: "CO-002", customer: "Mike Reyes", product: "Choco Moist Cake", request: "Add happy birthday text + sprinkles", status: "in-progress", createdAt: "May 28, 09:15 AM" },
    { id: "CO-003", customer: "Lisa Cruz", product: "Sponge Fudge", request: "Minimalist white icing + fresh flowers", status: "pending", createdAt: "May 28, 11:00 AM" },
  ]);

  const [decoQueue, setDecoQueue] = useState<DecoTask[]>([]);

  // Load decoration queue from Supabase on mount
  useEffect(() => {
    db.fetchDecorationQueue().then(rows => {
      setDecoQueue(rows.map(r => ({
        id: r.id,
        product: r.product,
        orderRef: r.orderRef,
        theme: r.theme,
        status: r.status,
        notes: r.notes,
        freezerItemId: r.freezerItemId,
        sourceQty: r.sourceQty,
        sourceBatchRef: r.sourceBatchRef,
        sourceProducedBy: r.sourceProducedBy,
        sourceSnapshot: r.sourceSnapshot,
        createdAt: r.createdAt,
      })));
    }).catch(console.error);
  }, []);

  const [designModal, setDesignModal] = useState<{ product: string; inventoryId: string; qty: number } | null>(null);
  const [designTheme, setDesignTheme] = useState("");
  const [designNotes, setDesignNotes] = useState("");
  const [designQty, setDesignQty] = useState(1);
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [prepSearch, setPrepSearch] = useState("");
  const [prepSlide, setPrepSlide] = useState(0);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [summaryModal, setSummaryModal] = useState<"products" | "ingredients" | "packaging" | "deco" | null>(null);
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

  const allIngredients = inventory.filter(i => i.group === "ingredients" || i.group === "decoration-supplies" || i.group === "packaging-materials");
  const decoMaterials = inventory.filter(i => i.group === "decoration-supplies");
  const ingredientItems = inventory.filter(i => i.group === "ingredients");
  const lowDecoMaterials = decoMaterials.filter(i => i.onHand > 0 && i.onHand < i.threshold);

  const togglePrepared = (id: string) => setPreMixPrepared(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

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
          freezerItemId: task.freezerItemId, sourceQty: task.sourceQty,
          sourceBatchRef: task.sourceBatchRef, sourceProducedBy: undefined, createdAt: task.createdAt,
          sourceSnapshot: task.sourceSnapshot,
        }).catch(console.error);

        // On Start Decorating (pending → in-progress), deduct packaging + decoration supplies
        if (status === "in-progress" && prevTask?.status === "pending") {
          const productRecipes = getRecipesForProduct(task.product);
          if (productRecipes.length > 0) {
            const qtyMultiplier = task.sourceQty && task.sourceQty > 0 ? task.sourceQty : 1;
            const newInv = [...inventory];
            const deductions: string[] = [];
            const skipped: string[] = [];
            productRecipes.forEach(recipe => {
              const consume = (name: string, inventoryId: string, perBatch: number, unit: string, kind: string) => {
                if (!inventoryId) {
                  const matchByName = newInv.find(i => i.name.toLowerCase() === name.toLowerCase());
                  if (matchByName) inventoryId = matchByName.id;
                }
                if (!inventoryId) { skipped.push(`${name} (no inventory link)`); return; }
                const idx = newInv.findIndex(i => i.id === inventoryId);
                if (idx < 0) { skipped.push(`${name} (not in inventory)`); return; }
                const needed = perBatch * qtyMultiplier;
                const before = newInv[idx].onHand;
                newInv[idx] = { ...newInv[idx], onHand: Math.max(0, before - needed) };
                const actualDeducted = before - newInv[idx].onHand;
                deductions.push(`${kind}: ${name} -${actualDeducted}${unit}`);
              };
              (recipe.packagingMaterials ?? []).forEach(p => consume(p.name, p.inventoryId, p.qtyPerBatch, p.unit, "Pack"));
              (recipe.decorationSupplies ?? []).forEach(s => consume(s.name, s.inventoryId, s.qtyPerBatch, s.unit, "Deco"));
            });
            if (deductions.length > 0) {
              defer(() => onUpdateInventory(newInv));
              db.upsertInventory(newInv).catch(console.error);
              defer(() => onAddAuditLog?.("DECO_TASK_STARTED", `${task.product} ×${qtyMultiplier} (${task.theme}): ${deductions.join(", ")}`));
            }
            if (skipped.length > 0) {
              defer(() => onAddAuditLog?.("DECO_DEDUCTION_SKIPPED", `${task.product}: ${skipped.join(", ")}`));
            }
          }
        }

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
      if (task && task.freezerItemId && task.sourceQty && task.sourceQty > 0) {
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
              i.id === task.freezerItemId
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
              const restored: InventoryItem = { ...snap, id: task.freezerItemId! };
              db.upsertInventoryItem(restored).catch(err => {
                console.error("Inventory re-add failed:", err);
              });
              defer(() => onAddAuditLog?.("DECO_TASK_DELETED", `${task.product} ×${snap.onHand} re-added to My Inventory`));
              return [...prevInv, restored];
            }
          }));
        } else {
          // No snapshot (older task) — use the partial-use restore path
          const sourceItem = inventory.find(i => i.id === task.freezerItemId);
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
    const direct = recipes.filter(r => r.productName === product);
    // Recipes that explicitly link TO this product (via their linkedProduct field)
    const linked = recipes.filter(r => (r.linkedProduct ?? []).includes(product) && r.productName !== product);
    // Recipes that are linked FROM this product's own linkedProduct field
    const productRecipe = recipes.find(r => r.productName === product);
    const fromLinks = productRecipe
      ? ((productRecipe.linkedProduct ?? [])
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
    const directRecipe = recipes.find(r => r.productName === d.product);
    const linkedRecipes = (directRecipe?.linkedProduct ?? [])
      .map(name => recipes.find(r => r.productName === name))
      .filter(Boolean)
      .filter(r => r!.productName !== d.product);
    return s + linkedRecipes.length;
  }, 0);
  const totalPrepared = preMixPrepared.size;
  const allMixesDone = dosForDeco.every(d => preMixDone.has(d.product));

  const workflowSteps = [
    { id: "dashboard", label: "DOS Received" },
    { id: "pre-mix", label: "Pre-Mix" },
    { id: "advanced-premix", label: "Advanced Premix" },
    { id: "deco-queue", label: "Decoration Queue" },
    { id: "freezer", label: "Finished Products" },
  ];
  const currentStepIdx = workflowSteps.findIndex(s => s.id === activeTab);
  const nextStep = currentStepIdx >= 0 && currentStepIdx < workflowSteps.length - 1 ? workflowSteps[currentStepIdx + 1] : null;

  /* ── Dashboard ── */
  if (activeTab === "dashboard") {
    const totalPkg = dosForDeco.reduce((s, d) => {
      const directRecipe = recipes.find(r => r.productName === d.product);
      const linkedRecipes = (directRecipe?.linkedProduct ?? [])
        .map(name => recipes.find(r => r.productName === name))
        .filter(Boolean)
        .filter(r => r!.productName !== d.product);
      const allRecipes = linkedRecipes;
      const pkgSet = new Set<string>();
      allRecipes.forEach(r => (r!.packagingMaterials ?? []).forEach(p => pkgSet.add(p.name.toLowerCase())));
      return s + pkgSet.size;
    }, 0);
    const totalDecoItems = dosForDeco.reduce((s, d) => {
      const directRecipe = recipes.find(r => r.productName === d.product);
      const linkedRecipes = (directRecipe?.linkedProduct ?? [])
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
        <div className="rounded-2xl bg-zinc-900 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-white">DOS Received</h1>
              <p className="mt-1 text-[13px] text-zinc-400">Admin issued these items. Your job is to prepare the Pre-Mix (ingredient pre-mixes) for each product.</p>
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
                  <th className="px-2 py-2.5">Product</th>
                  <th className="px-2 py-2.5">Priority</th>
                  <th className="px-2 py-2.5 text-right">Total</th>
                  <th className="w-14 px-3 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {dosForDeco.map(d => {
                  const directRecipe = recipes.find(r => r.productName === d.product);
                  const linkedRecipes = (directRecipe?.linkedProduct ?? [])
                    .map(name => recipes.find(r => r.productName === name))
                    .filter(Boolean)
                    .filter(r => r!.productName !== d.product);
                  const allRecipes = linkedRecipes;
                  const hasDetails = allRecipes.length > 0;
                  const isExpanded = expandedRows.has(d.id);
                  const pColor = d.priority === "HIGH" ? "bg-red-900/60 text-red-300" : d.priority === "MEDIUM" ? "bg-amber-900/60 text-amber-300" : "bg-zinc-700 text-zinc-400";
                  const sDot = d.status === "completed" ? "bg-emerald-500" : d.status === "in-progress" ? "bg-amber-500" : "bg-zinc-500";
                  return (
                    <Fragment key={d.id}>
                      <tr className="border-b border-zinc-800 text-[13px] hover:bg-zinc-800/50 transition-colors">
                        <td className="px-2 py-2.5">
                          {hasDetails ? (
                            <button onClick={() => setExpandedRows(prev => { const n = new Set(prev); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} className="inline-flex items-center gap-1.5 font-medium text-zinc-100 hover:text-white transition-colors text-left w-full cursor-pointer">
                              <span className={`text-[10px] transition-transform ${isExpanded ? "rotate-90" : ""} text-zinc-500`}>▸</span>
                              {d.product}
                            </button>
                          ) : (
                            <span className="font-medium text-zinc-100">{d.product}</span>
                          )}
                          {newDOSIds?.has(d.id) && <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-900/60 px-1.5 py-0.5 text-[9px] font-bold text-blue-300 uppercase tracking-wider">New</span>}
                        </td>
                        <td className="px-2 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${pColor}`}>{d.priority}</span></td>
                        <td className="px-2 py-2.5 text-right font-mono text-zinc-300">{d.qty}</td>
                        <td className="px-3 py-2.5 text-right"><span className={`inline-flex items-center gap-1.5 ${d.status === "completed" ? "text-emerald-400" : d.status === "in-progress" ? "text-amber-400" : "text-zinc-400"}`}><span className={`h-1.5 w-1.5 rounded-full ${sDot}`} />{d.status === "in-progress" ? "In Progress" : d.status === "completed" ? "Completed" : "Pending"}</span></td>
                      </tr>
                      {isExpanded && hasDetails && (
                        <tr key={`${d.id}-detail`}>
                          <td colSpan={4} className="px-3 pb-3">
                            <div className="bg-zinc-800 rounded-xl p-3 space-y-2 mt-1">
                              {linkedRecipes.length > 0 && (
                                <div>
                                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-1">Linked Recipes</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {linkedRecipes.map(r => (
                                      <span key={r!.productName} className="rounded-lg bg-rose-900/50 border border-rose-700 px-2 py-1 text-[11px] text-rose-200">{r!.productName}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(() => {
                                const pkgMap = new Map<string, { name: string; qty: number; unit: string }>();
                                const decoMap = new Map<string, { name: string; qty: number; unit: string }>();
                                allRecipes.forEach(r => {
                                  (r!.packagingMaterials ?? []).forEach(p => {
                                    const pk = p.name.toLowerCase();
                                    if (!pkgMap.has(pk)) pkgMap.set(pk, { name: p.name, qty: 0, unit: p.unit });
                                    const e = pkgMap.get(pk)!;
                                    e.qty += p.qtyPerBatch;
                                  });
                                  (r!.decorationSupplies ?? []).forEach(s => {
                                    const dk = s.name.toLowerCase();
                                    if (!decoMap.has(dk)) decoMap.set(dk, { name: s.name, qty: 0, unit: s.unit });
                                    const e = decoMap.get(dk)!;
                                    e.qty += s.qtyPerBatch;
                                  });
                                });
                                const pkgItems = [...pkgMap.values()];
                                const decoItems = [...decoMap.values()];
                                return (
                                  <>
                                    {pkgItems.length > 0 && (
                                      <div>
                                        <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-1">Packaging</div>
                                        <div className="flex flex-wrap gap-1.5">
                                          {pkgItems.map((p, i) => (
                                            <span key={`pkg-${i}`} className="rounded-lg bg-zinc-700 border border-blue-800 px-2 py-1 text-[11px] text-blue-300">
                                              {p.name} {p.qty}{p.unit}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {decoItems.length > 0 && (
                                      <div>
                                        <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-1">Decoration</div>
                                        <div className="flex flex-wrap gap-1.5">
                                          {decoItems.map((s, i) => (
                                            <span key={`deco-${i}`} className="rounded-lg bg-zinc-700 border border-purple-800 px-2 py-1 text-[11px] text-purple-300">
                                              {s.name} {s.qty}{s.unit}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
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
                {summaryModal === "ingredients" && dosForDeco.map(d => {
                  const directRecipe = recipes.find(r => r.productName === d.product);
                  const linkedRecipes = (directRecipe?.linkedProduct ?? [])
                    .map(name => recipes.find(r => r.productName === name))
                    .filter(Boolean)
                    .filter(r => r!.productName !== d.product);
                  const recipeNames = linkedRecipes.map(r => r!.productName);
                  if (recipeNames.length === 0) return null;
                  return (
                    <div key={d.id} className="rounded-xl border border-rose-100 px-3.5 py-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[13px] font-medium text-zinc-900">{d.product} <span className="text-[12px] text-zinc-400 font-mono">×{d.qty}</span></span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {recipeNames.map(name => (
                          <span key={name} className="rounded-lg bg-rose-100 border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-700">{name}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {summaryModal === "packaging" && dosForDeco.flatMap(d => {
                  const directRecipe = recipes.find(r => r.productName === d.product);
                  const linkedRecipes = (directRecipe?.linkedProduct ?? [])
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
                  <div key={item.key} className="flex items-center justify-between rounded-xl border border-blue-100 px-3.5 py-2.5">
                    <div>
                      <span className="text-[13px] font-medium text-zinc-900">{item.name}</span>
                      <span className="ml-2 text-[11px] text-zinc-400">for {item.product}</span>
                    </div>
                    <span className="text-[13px] font-mono font-medium text-blue-600">{item.qty} {item.unit}</span>
                  </div>
                ))}
                {summaryModal === "deco" && dosForDeco.flatMap(d => {
                  const directRecipe = recipes.find(r => r.productName === d.product);
                  const linkedRecipes = (directRecipe?.linkedProduct ?? [])
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
  if (activeTab === "pre-mix") {
    const updateIngredientQty = (recipeName: string, ingredientName: string, newQty: number) => {
      if (!onUpdateRecipes) return;
      onUpdateRecipes(prev => {
        const idx = prev.findIndex(r => r.productName === recipeName);
        if (idx < 0) return prev;
        const nextRecipes = [...prev];
        const recipe = { ...nextRecipes[idx] };
        recipe.ingredients = recipe.ingredients.map(i => i.name === ingredientName ? { ...i, qtyPerBatch: newQty } : i);
        nextRecipes[idx] = recipe;
        return nextRecipes;
      });
    };

    function toggleProduct(dosId: string, productRecipes: (ProductRecipe | undefined)[]) {
      const keys = productRecipes.map(r => `${dosId}:::${r!.productName.toLowerCase()}`);
      setSelectedProducts(prev => {
        const next = new Set(prev);
        if (next.has(dosId)) {
          next.delete(dosId);
          setSelectedRecipes(prevR => {
            const nextR = new Set(prevR);
            keys.forEach(k => nextR.delete(k));
            return nextR;
          });
        } else {
          next.add(dosId);
          setSelectedRecipes(prevR => {
            const nextR = new Set(prevR);
            keys.forEach(k => nextR.add(k));
            return nextR;
          });
        }
        return next;
      });
    }

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Production Preparation</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Tap a recipe card to view and adjust ingredients, then save to freezer.</p>
        </div>

        {dosForDeco.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center"><p className="text-[14px] text-zinc-400">No DOS items assigned for today.</p></div>
        ) : (
          <div className="space-y-6">
            {dosForDeco.map(d => {
              const directRecipe = recipes.find(r => r.productName === d.product);
              const linkedRecipes = (directRecipe?.linkedProduct ?? [])
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
                      const dosQty = productQty[d.id] ?? d.qty;

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

        {/* Recipe Detail Modal */}
        {selectedRecipeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setSelectedRecipeModal(null)}>
            <div className="w-full max-w-[520px] max-h-[90vh] rounded-[28px] border border-[#E8E0D5] bg-white shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <div>
                  <h3 className="text-[16px] font-semibold text-zinc-900">{selectedRecipeModal.recipe.productName}</h3>
                  <p className="text-[12px] text-zinc-500 mt-0.5">for {selectedRecipeModal.dosProduct} × {(() => { const dos = dosForDeco.find(dd => dd.id === selectedRecipeModal.dosId); return saveAmounts[dos?.id ?? ""] ?? productQty[dos?.id ?? ""] ?? dos?.qty ?? 1; })()}</p>
                </div>
                <button onClick={() => setSelectedRecipeModal(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-all">✕</button>
              </div>

              <div className="overflow-y-auto px-6 py-4 space-y-3 flex-1">
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">Ingredients</div>
                {(() => {
                  const dos = dosForDeco.find(dd => dd.id === selectedRecipeModal.dosId);
                  const dosQty = saveAmounts[dos?.id ?? ""] ?? productQty[dos?.id ?? ""] ?? dos?.qty ?? 1;
                  return selectedRecipeModal.recipe.ingredients.map((ing, i) => {
                    const baseQty = ing.qtyPerBatch;
                    const totalQty = baseQty * dosQty;
                    return (
                      <div key={i} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
                        <div className="flex-1">
                          <span className="text-[13px] font-medium text-zinc-800">{ing.name}</span>
                          <span className="text-[11px] text-zinc-400 ml-2">{ing.unit}</span>
                          <div className="text-[10px] text-zinc-400 mt-0.5">{baseQty} per batch × {dosQty} = <span className="font-semibold text-zinc-600">{totalQty} {ing.unit} total</span></div>
                        </div>
                        <div className="w-20 text-center font-mono text-[15px] font-bold text-zinc-900">
                          {totalQty}
                        </div>
                      </div>
                    );
                  });
                })()}

                {(selectedRecipeModal.recipe.packagingMaterials ?? []).length > 0 && (() => {
                  const dos = dosForDeco.find(dd => dd.id === selectedRecipeModal.dosId);
                  const dosQty = saveAmounts[dos?.id ?? ""] ?? productQty[dos?.id ?? ""] ?? dos?.qty ?? 1;
                  return (
                    <>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium pt-2">Packaging</div>
                      {selectedRecipeModal.recipe.packagingMaterials.map((mat, i) => (
                        <div key={`pkg-${i}`} className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/30 px-4 py-2.5">
                          <span className="text-[12px] font-medium text-zinc-700">{mat.name}</span>
                          <span className="text-[11px] font-mono text-zinc-500">{mat.qtyPerBatch * dosQty} {mat.unit}</span>
                        </div>
                      ))}
                    </>
                  );
                })()}
                {(selectedRecipeModal.recipe.decorationSupplies ?? []).length > 0 && (() => {
                  const dos = dosForDeco.find(dd => dd.id === selectedRecipeModal.dosId);
                  const dosQty = saveAmounts[dos?.id ?? ""] ?? productQty[dos?.id ?? ""] ?? dos?.qty ?? 1;
                  return (
                    <>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium pt-2">Decoration</div>
                      {selectedRecipeModal.recipe.decorationSupplies.map((sup, i) => (
                        <div key={`deco-${i}`} className="flex items-center justify-between rounded-xl border border-purple-100 bg-purple-50/30 px-4 py-2.5">
                          <span className="text-[12px] font-medium text-zinc-700">{sup.name}</span>
                          <span className="text-[11px] font-mono text-zinc-500">{sup.qtyPerBatch * dosQty} {sup.unit}</span>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>

              <div className="px-6 py-4 border-t border-zinc-100">
                <button onClick={() => setSelectedRecipeModal(null)} className="w-full rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Freezer Action Bar */}
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
                  // Working inventory for ingredient deductions
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
                      db.upsertFreezerItems([updatedItem]).catch(err => {
                        console.error("Freezer update failed:", err);
                      });
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
                    const linkedRecipes = (recipes.find(r => r.productName === dos.product)?.linkedProduct ?? [])
                      .map(name => recipes.find(r => r.productName === name))
                      .filter(Boolean);
                    linkedRecipes.forEach(r => {
                      const preparedKey = `${dos.id}:::${r!.productName.toLowerCase()}`;
                      setPreMixPrepared(prev => new Set(prev).add(preparedKey));
                    });
                    // Deduct ingredients (with custom adjustment) from My Inventory
                    const productRecipes = getRecipesForProduct(dos.product);
                    const findInventoryMatch = (ingredient: { name: string; inventoryId?: string; sku?: string }): InventoryItem | undefined => {
                      // 1. Direct inventoryId
                      if (ingredient.inventoryId) {
                        const direct = workingInv.find(i => i.id === ingredient.inventoryId);
                        if (direct) return direct;
                      }
                      // 2. Exact name match (case-insensitive, trimmed)
                      const ingLower = ingredient.name.toLowerCase().trim();
                      let match = workingInv.find(i => i.name.toLowerCase().trim() === ingLower);
                      if (match) return match;
                      // 3. Partial contains (either direction)
                      match = workingInv.find(i =>
                        i.name.toLowerCase().includes(ingLower) || ingLower.includes(i.name.toLowerCase())
                      );
                      if (match) return match;
                      // 4. SKU match
                      if (ingredient.sku) {
                        match = workingInv.find(i => i.sku === ingredient.sku);
                      }
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
                  // Persist ingredient deductions
                  if (allDeductions.length > 0 || allSkipped.length > 0) {
                    onUpdateInventory?.(workingInv);
                    const changedItems = workingInv.filter(item => {
                      const orig = inventory.find(o => o.id === item.id);
                      return orig && Math.abs(orig.onHand - item.onHand) > 0.0001;
                    });
                    if (changedItems.length > 0) {
                      db.upsertInventory(changedItems).catch(err => console.error("Inventory deduction save failed:", err));
                    }
                    if (allDeductions.length > 0) {
                      onAddAuditLog?.("INGREDIENTS_DEDUCTED", `Put in Production Recipe: ${allDeductions.join(", ")}`);
                    }
                    if (allSkipped.length > 0) {
                      onAddAuditLog?.("DEDUCTION_SKIPPED", `Put in Production Recipe: ${allSkipped.join(", ")}`);
                    }
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
                  // Working inventory: start with current, add product updates, then deduct ingredients
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
                    const linkedRecipes = (recipes.find(r => r.productName === dos.product)?.linkedProduct ?? [])
                      .map(name => recipes.find(r => r.productName === name))
                      .filter(Boolean);
                    linkedRecipes.forEach(r => {
                      const preparedKey = `${dos.id}:::${r!.productName.toLowerCase()}`;
                      setPreMixPrepared(prev => new Set(prev).add(preparedKey));
                    });
                    // Deduct ingredients (with custom adjustment) from My Inventory
                    const productRecipes = getRecipesForProduct(dos.product);
                    const findInventoryMatch = (ingredient: { name: string; inventoryId?: string; sku?: string }): InventoryItem | undefined => {
                      // 1. Direct inventoryId
                      if (ingredient.inventoryId) {
                        const direct = workingInv.find(i => i.id === ingredient.inventoryId);
                        if (direct) return direct;
                      }
                      // 2. Exact name match (case-insensitive, trimmed)
                      const ingLower = ingredient.name.toLowerCase().trim();
                      let match = workingInv.find(i => i.name.toLowerCase().trim() === ingLower);
                      if (match) return match;
                      // 3. Partial contains (either direction)
                      match = workingInv.find(i =>
                        i.name.toLowerCase().includes(ingLower) || ingLower.includes(i.name.toLowerCase())
                      );
                      if (match) return match;
                      // 4. SKU match
                      if (ingredient.sku) {
                        match = workingInv.find(i => i.sku === ingredient.sku);
                      }
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
                  // Single setState for all inventory changes (product add/update + ingredient deductions)
                  onUpdateInventory?.(workingInv);
                  // Persist only changed items
                  const persistIds = new Set([...allUpdatedItems.map(i => i.id), ...allNewItems.map(i => i.id)]);
                  const changedByDeduction = workingInv.filter(item => {
                    if (persistIds.has(item.id)) return false;
                    const orig = inventory.find(o => o.id === item.id);
                    return orig && Math.abs(orig.onHand - item.onHand) > 0.0001;
                  });
                  const allToPersist = [...allUpdatedItems, ...allNewItems, ...changedByDeduction];
                  if (allToPersist.length > 0) {
                    db.upsertInventory(allToPersist).catch(err => console.error("Inventory save failed:", err));
                  }
                  if (allDeductions.length > 0) {
                    onAddAuditLog?.("INGREDIENTS_DEDUCTED", `Put in My Inventory: ${allDeductions.join(", ")}`);
                  }
                  if (allSkipped.length > 0) {
                    onAddAuditLog?.("DEDUCTION_SKIPPED", `Put in My Inventory: ${allSkipped.join(", ")}`);
                  }
                  onAddAuditLog?.("INVENTORY_ADDED", `Items added to My Inventory`);
                  setSelectedRecipes(new Set());
                  setSelectedProducts(new Set());
                }}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-[12px] font-medium text-white hover:bg-blue-700 transition-all"
              >Put in My Inventory</button>
            </div>
          </div>
        )}
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
            <h1 className="text-[32px] font-extrabold tracking-tight text-zinc-900">Advanced Premix</h1>
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
              <button onClick={() => setShowAdvConfirm(true)} className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-white bg-zinc-900 hover:bg-zinc-800 flex items-center gap-2">
                Save to Freezer 📦
              </button>
            </div>

            {showAdvConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAdvConfirm(false)}>
                <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                  <h2 className="text-[18px] font-semibold mb-1">Confirm Save</h2>
                  <p className="text-[13px] text-zinc-500 mb-5">The following Advanced Premix items will be saved to the freezer and sent to Baker's Assembly:</p>

                  <div className="space-y-2 max-h-64 overflow-y-auto mb-5">
                    {Array.from(selectedAdvRecipes).map(productName => {
                      const recipe = recipes.find(r => r.productName === productName);
                      const qty = advMixQtys[productName] || 1;
                      const adjustments = advMixAdjustments[productName];
                      const hasAdjustments = adjustments && Object.values(adjustments).some(v => v !== 0);
                      return (
                        <div key={productName} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[14px] font-medium text-zinc-900">{productName}</span>
                            <span className="text-[13px] font-mono font-medium">×{qty} batch</span>
                          </div>
                          {hasAdjustments && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {Object.entries(adjustments).filter(([, v]) => v !== 0).map(([name, v]) => (
                                <span key={name} className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${v > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                  {name} {v > 0 ? "+" : ""}{v.toFixed(1)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setShowAdvConfirm(false)} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                    <button onClick={() => {
                      setShowAdvConfirm(false);
                      const batchRef = `ADV-${Date.now()}`;
                      const items: FreezerItem[] = Array.from(selectedAdvRecipes).map(productName => {
                        const recipe = recipes.find(r => r.productName === productName);
                        const qty = advMixQtys[productName] || 1;
                        const adjustments = advMixAdjustments[productName];
                        const notes = adjustments
                          ? Object.entries(adjustments).filter(([, v]) => v !== 0).map(([name, v]) => `${name}: ${v > 0 ? "+" : ""}${v.toFixed(1)}`).join("; ")
                          : "";
                        return {
                          id: `FRZ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                          productName,
                          qty,
                          unit: "batch",
                          batchRef,
                          producedBy: "deco",
                          dateProduced: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0],
                          status: "stored",
                          notes: notes || `Advanced Premix composition`,
                        };
                      });
                      onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, ...items]);
                      db.upsertFreezerItems(items).then(() => {
                        const assemblyTasks = items.map(item => ({
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
                      onAddAuditLog?.("ADVANCED_PREMIX_SAVED", `Saved ${items.length} compositions to freezer (batch: ${batchRef})`);
                      setSelectedAdvRecipes(new Set());
                      setAdvMixQtys({});
                      setAdvMixAdjustments({});
                      setIsAdvLocked(false);
                    }} className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[13px] font-bold text-white hover:bg-zinc-800">Confirm Save</button>
                  </div>
                </div>
              </div>
            )}
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
        </div>
      </div>
    );
  }

  /* ── Decoration Queue ── */
  if (activeTab === "deco-queue") {
    const prepInventory = inventory.filter(i => i.source === "production-prep" && (!i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("deco")));
    const activeDesignItem = selectedDesignId ? inventory.find(i => i.id === selectedDesignId) ?? null : null;

    const renderDecoCard = (task: DecoTask, opts?: { compact?: boolean; expanded?: boolean; onToggle?: () => void }) => {
      const taskRecipes = getRecipesForProduct(task.product);
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

      // Full card (Active Decoration Queue)
      return (
        <div key={task.id} className={`rounded-2xl border p-5 ${isCompleted ? "border-emerald-200 bg-emerald-50/30" : "border-zinc-200 bg-white"}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-zinc-900 text-white font-mono font-bold text-[13px] px-2.5 py-1">×{qtyMult}</span>
              <div>
                <span className="text-[15px] font-semibold text-zinc-900">{task.product}</span>
                <span className="ml-2 text-[12px] text-zinc-400">{task.orderRef}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${isCompleted ? "bg-emerald-100 text-emerald-700" : task.status === "in-progress" ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-600"}`}>{task.status}</span>
              <button onClick={() => { if (confirm(`Remove decoration task for ${task.product}?`)) deleteDecoTask(task.id); }} className="rounded-lg border border-red-200 bg-white px-2 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-50 transition-all">Delete</button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-zinc-500 mb-3">
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-600">{task.theme}</span>
            <span>{task.notes}</span>
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
            <div className="flex justify-center pt-1">
              {task.status === "pending" && (
                <button onClick={() => updateDecoTask(task.id, "in-progress")} className="rounded-xl bg-blue-600 px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-700 transition-all shadow-sm">Start Decorating</button>
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
      // Default designQty to the source on-hand qty (capped at qty, floor of 1)
      setDesignQty(Math.max(1, qty));
    };

    const confirmDesign = () => {
      if (!designModal) return;
      const sourceItem = inventory.find(i => i.id === designModal.inventoryId);
      if (!sourceItem) {
        alert("Source inventory item no longer exists.");
        return;
      }
      if (sourceItem.onHand < designQty) {
        if (!confirm(`Only ${sourceItem.onHand} on hand. Design ${designQty} anyway?`)) return;
      }

      const newTask: DecoTask = {
        id: `DQ-${Date.now()}`,
        product: designModal.product,
        orderRef: `INV-${designModal.inventoryId.slice(-6).toUpperCase()}`,
        theme: designTheme.trim() || "Custom Design",
        status: "pending",
        notes: designNotes.trim() || "Designed from My Inventory",
        freezerItemId: designModal.inventoryId,
        sourceQty: designQty,
        sourceSnapshot: { ...sourceItem },
        createdAt: new Date().toISOString(),
      };
      setDecoQueue(prev => [newTask, ...prev]);
      setSelectedDesignId(designModal.inventoryId);
      setDesignModal(null);
      db.upsertDecorationQueueTask({
        id: newTask.id, product: newTask.product, orderRef: newTask.orderRef,
        theme: newTask.theme, status: newTask.status, notes: newTask.notes,
        freezerItemId: newTask.freezerItemId, sourceQty: newTask.sourceQty,
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
    };

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Decoration Queue</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Pick a product from My Inventory (Production Prep), design it, then add to the queue.</p>
        </div>

        {/* Available from My Inventory — Production Prep group */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div>
              <h2 className="text-[15px] font-semibold text-zinc-900">Available from My Inventory</h2>
              <p className="text-[12px] text-zinc-500 mt-0.5">Group: <span className="font-semibold text-emerald-700">Production Prep</span> · Select a product to design</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px]">⌕</span>
                <input
                  value={prepSearch}
                  onChange={e => { setPrepSearch(e.target.value); setPrepSlide(0); }}
                  placeholder="Search products..."
                  className="w-56 rounded-xl border border-emerald-200 bg-white pl-9 pr-3 py-2 text-[13px] outline-none focus:border-emerald-400"
                />
              </div>
              <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">{prepInventory.length} item{prepInventory.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
          {prepInventory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-emerald-200 bg-white/60 p-6 text-center">
              <p className="text-[12px] text-zinc-500">No Production Prep items in My Inventory yet. Put items in My Inventory from <span className="font-semibold">Production Prep</span> first.</p>
            </div>
          ) : (() => {
            const filtered = prepInventory.filter(inv => !prepSearch || inv.name.toLowerCase().includes(prepSearch.toLowerCase()) || inv.sku.toLowerCase().includes(prepSearch.toLowerCase()));
            const pageSize = 3;
            const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
            const safeSlide = Math.min(prepSlide, totalPages - 1);
            const pageItems = filtered.slice(safeSlide * pageSize, safeSlide * pageSize + pageSize);
            return (
            <>
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-emerald-200 bg-white/60 p-6 text-center">
                <p className="text-[12px] text-zinc-500">No products match "<span className="font-semibold">{prepSearch}</span>".</p>
              </div>
            ) : (
              <div className="relative">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {pageItems.map(inv => {
                    const isSelected = selectedDesignId === inv.id;
                    return (
                      <div
                        key={inv.id}
                        onClick={() => setSelectedDesignId(isSelected ? null : inv.id)}
                        className={`rounded-xl border p-3.5 cursor-pointer transition-all ${isSelected ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200" : "border-zinc-200 bg-white hover:border-emerald-300"}`}
                      >
                    <div className="flex items-start justify-between mb-1.5">
                      <div>
                        <div className="text-[13px] font-semibold text-zinc-900 truncate">{inv.name}</div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{inv.sku}</div>
                      </div>
                      {isSelected && <span className="shrink-0 rounded-full bg-emerald-500 text-white w-5 h-5 grid place-items-center text-[10px] font-bold">✓</span>}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-zinc-500">On hand: <span className="font-mono font-semibold text-zinc-900">{inv.onHand}</span> {inv.unit}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); openDesign(inv.name, inv.id, inv.onHand); }}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 transition-all"
                      >Design →</button>
                    </div>
                  </div>
                    );
                  })}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3">
                    <button
                      onClick={() => setPrepSlide(s => Math.max(0, s - 1))}
                      disabled={safeSlide === 0}
                      className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >← Prev</button>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setPrepSlide(i)}
                          className={`h-2 rounded-full transition-all ${i === safeSlide ? "w-6 bg-emerald-600" : "w-2 bg-emerald-200 hover:bg-emerald-300"}`}
                          aria-label={`Go to page ${i + 1}`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => setPrepSlide(s => Math.min(totalPages - 1, s + 1))}
                      disabled={safeSlide === totalPages - 1}
                      className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >Next →</button>
                  </div>
                )}
              </div>
            )}
            </>
            );
          })()}

          {activeDesignItem && (
            <div className="mt-4 rounded-xl border border-emerald-300 bg-white p-4 flex items-center justify-between">
              <div className="text-[12px] text-zinc-700">
                <span className="text-zinc-400">Selected:</span> <span className="font-semibold text-zinc-900">{activeDesignItem.name}</span>
                <span className="ml-2 text-zinc-400">·</span>
                <span className="ml-2 text-zinc-500">on hand <span className="font-mono font-semibold">{activeDesignItem.onHand}</span> {activeDesignItem.unit}</span>
              </div>
              <button
                onClick={() => openDesign(activeDesignItem.name, activeDesignItem.id, activeDesignItem.onHand)}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-zinc-800 transition-all"
              >Open Design</button>
            </div>
          )}
        </div>

        {/* Active Decoration Queue */}
        <div>
          <h2 className="text-[15px] font-semibold text-zinc-900 mb-3">Active Decoration Queue</h2>
          {(() => {
            const activeTasks = decoQueue.filter(t => t.status !== "completed");
            if (activeTasks.length === 0) {
              return <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center"><p className="text-[14px] text-zinc-400">No active decoration tasks.</p></div>;
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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setDesignModal(null)}>
              <div className="w-full max-w-[560px] max-h-[90vh] rounded-[28px] border border-[#E8E0D5] bg-white shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                  <div>
                    <h3 className="text-[16px] font-semibold text-zinc-900">Design Product</h3>
                    <p className="text-[12px] text-zinc-500 mt-0.5">from My Inventory · <span className="font-semibold text-emerald-700">{designModal.product}</span></p>
                  </div>
                  <button onClick={() => setDesignModal(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600">✕</button>
                </div>
                <div className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">Quantity to Design</label>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setDesignQty(q => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg border border-zinc-200 bg-white text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 flex items-center justify-center">−</button>
                      <input
                        type="number"
                        min={1}
                        max={designModal.qty}
                        value={designQty}
                        onChange={e => setDesignQty(Math.max(1, Math.min(designModal.qty, parseInt(e.target.value) || 1)))}
                        className="flex-1 text-center font-mono text-[14px] font-bold text-zinc-900 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2 outline-none focus:border-zinc-400"
                      />
                      <button onClick={() => setDesignQty(q => Math.min(designModal.qty, q + 1))} className="w-9 h-9 rounded-lg border border-zinc-200 bg-white text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 flex items-center justify-center">+</button>
                      <span className="text-[11px] text-zinc-400 font-mono">/ {designModal.qty} avail</span>
                    </div>
                  </div>

                  {/* Linked Packaging */}
                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">Linked Packaging</label>
                    {packagingItems.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/40 px-3 py-2.5 text-[12px] text-zinc-400">No packaging materials linked to this product.</div>
                    ) : (
                      <div className="rounded-xl border border-blue-100 bg-blue-50/30 divide-y divide-blue-100/60 overflow-hidden">
                        {packagingItems.map((p, i) => (
                          <div key={`pkg-${i}`} className="flex items-center justify-between px-3 py-2.5">
                            <div>
                              <div className="text-[12px] font-medium text-zinc-800">{p.name}</div>
                              <div className="text-[10px] text-zinc-400">from {p.source}</div>
                            </div>
                            <div className="text-[12px] font-mono text-zinc-700">{formatQty(p.qty * designQty, p.unit)} {p.unit}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Linked Decoration Supplies */}
                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">Linked Decoration Supplies</label>
                    {decorationItems.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/40 px-3 py-2.5 text-[12px] text-zinc-400">No decoration supplies linked to this product.</div>
                    ) : (
                      <div className="rounded-xl border border-purple-100 bg-purple-50/30 divide-y divide-purple-100/60 overflow-hidden">
                        {decorationItems.map((s, i) => (
                          <div key={`deco-${i}`} className="flex items-center justify-between px-3 py-2.5">
                            <div>
                              <div className="text-[12px] font-medium text-zinc-800">{s.name}</div>
                              <div className="text-[10px] text-zinc-400">from {s.source}</div>
                            </div>
                            <div className="text-[12px] font-mono text-zinc-700">{formatQty(s.qty * designQty, s.unit)} {s.unit}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">Theme / Design Style</label>
                    <input
                      value={designTheme}
                      onChange={e => setDesignTheme(e.target.value)}
                      placeholder="e.g. Frozen Theme, Floral, Minimalist"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">Design Notes / Decorations</label>
                    <textarea
                      value={designNotes}
                      onChange={e => setDesignNotes(e.target.value)}
                      rows={3}
                      placeholder="e.g. Blue icing, snowflake toppers, gold ribbon"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400 resize-none"
                    />
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-zinc-100 flex gap-2">
                  <button onClick={() => setDesignModal(null)} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                  <button onClick={confirmDesign} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-[13px] font-medium text-white hover:bg-emerald-700">Add to Queue</button>
                </div>
              </div>
            </div>
          );
        })()}

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
    const decoOnlyInventory = inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("deco"));
    
    // Categorization logic
    const tabs: ("Display Cakes" | "Production Recipe" | "Advanced Premix" | "My Inventory")[] = ["Display Cakes", "Production Recipe", "Advanced Premix", "My Inventory"];
    const displayCakes = myFreezer.filter(i => !i.notes?.startsWith("Production Recipe") && !i.batchRef?.startsWith("ADV-"));
    const productionRecipes = myFreezer.filter(i => i.notes?.startsWith("Production Recipe") && i.qty > 0);
    const advancedPremix = myFreezer.filter(i => i.batchRef?.startsWith("ADV-") && i.qty > 0);
    const getFilteredItems = () => {
        if (freezerTab === "Display Cakes") return displayCakes;
        if (freezerTab === "Production Recipe") return productionRecipes;
        if (freezerTab === "Advanced Premix") return advancedPremix;
        return decoOnlyInventory as unknown as FreezerItem[];
    };
    
    const isInventoryTab = freezerTab === "My Inventory";
    const filtered = (isInventoryTab
      ? (getFilteredItems() as unknown as InventoryItem[]).filter(i => !freezerSearch || i.name.toLowerCase().includes(freezerSearch.toLowerCase()))
      : getFilteredItems().filter(i => !freezerSearch || i.productName.toLowerCase().includes(freezerSearch.toLowerCase()))
    );
    const sortedInventory = isInventoryTab
      ? ([...filtered as unknown as InventoryItem[]].sort((a, b) => {
          const aPrep = a.source === "production-prep" ? 0 : 1;
          const bPrep = b.source === "production-prep" ? 0 : 1;
          if (aPrep !== bPrep) return aPrep - bPrep;
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
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">{isInventoryTab ? "Total Stock" : "Total Qty"}</div>
            <div className="text-[24px] font-semibold mt-1">
              {isInventoryTab
                ? `${(filtered as unknown as InventoryItem[]).reduce((s, i) => s + i.onHand, 0)} units`
                : `${(filtered as FreezerItem[]).reduce((s, i) => s + i.qty, 0)} pcs`}
            </div>
          </div>
        </div>

        <div className="relative max-w-[280px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px]">⌕</span>
          <input value={freezerSearch} onChange={e => setFreezerSearch(e.target.value)} placeholder={isInventoryTab ? "Search inventory..." : "Search products..."} className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-2.5 text-[13px] focus:outline-none focus:border-zinc-400" />
        </div>

        <div className="rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {isInventoryTab ? (
              <table className="w-full text-left">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr className="text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3 text-right">On Hand</th>
                    <th className="px-5 py-3 text-right">Threshold</th>
                    <th className="px-5 py-3">Unit</th>
                    <th className="px-5 py-3">Section</th>
                    <th className="px-5 py-3">Group</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {(sortedInventory ?? []).length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-[13px] text-zinc-400">No inventory items with deco-only access.</td></tr>
                  ) : (() => {
                    const rows: React.ReactNode[] = [];
                    let lastGroup: string | null = null;
                    (sortedInventory ?? []).forEach((inv, idx) => {
                      const groupKey = inv.source === "production-prep" ? "production-prep" : "manual";
                      if (lastGroup !== null && lastGroup !== groupKey) {
                        rows.push(
                          <tr key={`divider-${idx}`}>
                            <td colSpan={7} className="px-5 py-2 bg-zinc-50/60 border-y border-zinc-100">
                              <div className="flex items-center gap-2">
                                <span className="h-px flex-1 bg-zinc-200" />
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">Manual</span>
                                <span className="h-px flex-1 bg-zinc-200" />
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      if (lastGroup !== groupKey && groupKey === "production-prep") {
                        rows.push(
                          <tr key={`header-production-prep`}>
                            <td colSpan={7} className="px-5 py-2 bg-emerald-50/60 border-b border-emerald-100">
                              <div className="flex items-center gap-2">
                                <span className="h-px flex-1 bg-emerald-200" />
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700">From Production Prep</span>
                                <span className="h-px flex-1 bg-emerald-200" />
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      lastGroup = groupKey;
                      const isPrep = inv.source === "production-prep";
                      rows.push(
                        <tr key={inv.id} className={`hover:bg-zinc-50/50 transition-colors ${isPrep ? "bg-emerald-50/20" : ""}`}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="text-[13px] font-medium text-zinc-900">{inv.name}</div>
                              {isPrep && <span className="rounded-full bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 uppercase tracking-wider">Prep</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-[12px] text-zinc-600 font-mono">{inv.sku}</td>
                          <td className="px-5 py-3.5 text-[13px] text-right font-mono" style={{ color: inv.onHand === 0 ? "#ef4444" : inv.onHand < inv.threshold ? "#f59e0b" : "#16a34a" }}>{inv.onHand}</td>
                          <td className="px-5 py-3.5 text-[13px] text-right font-mono text-zinc-500">{inv.threshold}</td>
                          <td className="px-5 py-3.5 text-[13px] text-zinc-500">{inv.unit}</td>
                          <td className="px-5 py-3.5"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{inv.group.replace(/-/g, ' ')}</span></td>
                          <td className="px-5 py-3.5">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isPrep ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-zinc-100 text-zinc-600 border border-zinc-200"}`}>
                              {isPrep ? "Production Prep" : "Manual"}
                            </span>
                          </td>
                        </tr>
                      );
                    });
                    return rows;
                  })()}
                </tbody>
              </table>
            ) : freezerTab === "Display Cakes" ? (
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
            ) : freezerTab === "Advanced Premix" ? (
              <table className="w-full text-left">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr className="text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                    <th className="px-5 py-3">Recipe</th>
                    <th className="px-5 py-3 text-right">Qty</th>
                    <th className="px-5 py-3">Batch</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-center">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {(filtered as FreezerItem[]).length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-zinc-400">No Advanced Premix batches saved.</td></tr>
                  ) : (() => {
                    const grouped = new Map<string, { items: FreezerItem[]; totalQty: number }>();
                    (filtered as FreezerItem[]).forEach(f => {
                      if (!grouped.has(f.productName)) grouped.set(f.productName, { items: [], totalQty: 0 });
                      const g = grouped.get(f.productName)!;
                      g.items.push(f);
                      g.totalQty += f.qty;
                    });
                    return [...grouped.entries()].map(([productName, g]) => (
                      <tr key={productName} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="text-[13px] font-medium text-zinc-900">{productName}</div>
                          <div className="text-[11px] text-zinc-400 mt-0.5 flex flex-wrap gap-1.5">
                            {g.items.map(f => (
                              <span key={f.id} className="text-[10px] font-mono">{f.batchRef?.replace("ADV-", "") || "—"}: {f.qty}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{g.totalQty} batch</td>
                        <td className="px-5 py-3.5 text-[12px] text-zinc-600">{g.items.length} batch{g.items.length > 1 ? "es" : ""}</td>
                        <td className="px-5 py-3.5 text-[12px] text-zinc-500">{g.items.map(f => f.dateProduced).filter((v, i, a) => a.indexOf(v) === i).join(", ")}</td>
                        <td className="px-5 py-3.5 text-center"><span className="text-[11px] text-emerald-600 font-medium">✓ In Stock</span></td>
                        <td className="px-5 py-3.5 text-right">
                          <button onClick={() => { if (confirm(`Delete ALL batches of ${productName}?`)) { const ids = new Set(g.items.map(x => x.id)); const updated = freezerItems.filter(f => !ids.has(f.id)); onUpdateFreezer?.(updated); ids.forEach(id => db.deleteFreezerItem(id).catch(console.error)); } }} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Del All</button>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
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

  /* ── Waste / Adjustment ── */
  if (activeTab === "waste-adjustment") {
    const wasteReasons = ["Spoilage", "Damaged / Breakage", "Expired", "Overproduction", "Quality Issue", "Wrong Product", "Contamination", "Other"];
    const sourceOptions = [
      { id: "freezer-display" as const, label: "Freezer - Display Cakes" },
      { id: "freezer-production" as const, label: "Freezer - Production Recipe" },
      { id: "my-inventory" as const, label: "My Inventory" },
    ];

    const getSourceItems = () => {
      switch (wasteSource) {
        case "freezer-display": return freezerItems.filter(i => i.producedBy === "deco" && !i.notes?.startsWith("Production Recipe")).map(i => ({ id: i.id, name: i.productName, qty: i.qty, unit: i.unit, source: "freezer" as const }));
        case "freezer-production": return freezerItems.filter(i => i.producedBy === "deco" && i.notes?.startsWith("Production Recipe")).map(i => ({ id: i.id, name: i.productName, qty: i.qty, unit: i.unit, source: "freezer" as const }));
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

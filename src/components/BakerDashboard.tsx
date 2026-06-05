import { useEffect, useState, Fragment } from "react";
import type { ProductionTask, DOSItem, BakerIngredientRequest, ProductRecipe, FreezerItem, FreezerHistory, InventoryItem } from "../types";
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
  freezerItems?: FreezerItem[];
  onUpdateFreezer?: (cb: FreezerItem[] | ((prev: FreezerItem[]) => FreezerItem[])) => void;
  freezerHistory?: FreezerHistory[];
  inventory?: InventoryItem[];
  onUpdateInventory?: (cb: InventoryItem[] | ((prev: InventoryItem[]) => InventoryItem[])) => void;
};

const steps = [
  { id: "dos", label: "DOS" },
  { id: "produce", label: "Produce" },
  { id: "withdraw", label: "Withdraw Ingredients" },
  { id: "freezer", label: "Save to Freezer" },
];

export default function BakerDashboard({ production, dosItems, onCompleteTask, activeTab, productCatalog, recipes, newDOSIds, onMarkDOSSeen, freezerItems = [], onUpdateFreezer, freezerHistory = [], inventory = [], onUpdateInventory }: Props) {
  const [step, setStep] = useState(0);
  const [ingredientReqs, setIngredientReqs] = useState<BakerIngredientRequest[]>([]);
  const [sent, setSent] = useState(false);
  const [expandedDOS, setExpandedDOS] = useState<Set<string>>(new Set());
  const toggleDOS = (id: string) => setExpandedDOS(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [expandedSched, setExpandedSched] = useState<Set<string>>(new Set());
  const toggleSched = (date: string) => setExpandedSched(prev => { const n = new Set(prev); if (n.has(date)) n.delete(date); else n.add(date); return n; });

  // Filling state
  const [fillingName, setFillingName] = useState("");
  const [fillingQty, setFillingQty] = useState("");
  const [fillingSearch, setFillingSearch] = useState("");

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
  const [freezerTab, setFreezerTab] = useState<"baked-products" | "my-inventory" | "deco-production-recipe">("baked-products");

  // Bake selection flow state
  const [bakerBakeQty, setBakerBakeQty] = useState<Record<string, number>>({});
  const [selectedForBaking, setSelectedForBaking] = useState<Set<string>>(new Set());
  const [withdrawnQtys, setWithdrawnQtys] = useState<Record<string, Record<string, number>>>({});
  const [modalSearch, setModalSearch] = useState("");
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Assembly tab state
  const [assemblyProduct, setAssemblyProduct] = useState("");
  const [assemblyPremixId, setAssemblyPremixId] = useState("");
  const [assemblyQty, setAssemblyQty] = useState("");
  const [assemblyTasks, setAssemblyTasks] = useState<db.BakerAssemblyTask[]>([]);
  const [assemblyQtys, setAssemblyQtys] = useState<Record<string, number>>({});
  const [pendingDOSProducts, setPendingDOSProducts] = useState<Record<string, string>>({});
  const [pendingQtys, setPendingQtys] = useState<Record<string, number>>({});

  useEffect(() => {
    db.fetchBakerIngredientRequests().then(setIngredientReqs).catch(() => {});
  }, []);

  useEffect(() => {
    db.fetchBakerAssemblyTasks().then(setAssemblyTasks).catch(() => {});
  }, []);

  useEffect(() => {
    if (step === 0 && bakerDOS.length > 0 && newDOSIds && onMarkDOSSeen) {
      const unseen = bakerDOS.filter(d => newDOSIds.has(d.id));
      if (unseen.length > 0) onMarkDOSSeen(unseen.map(d => d.id));
    }
  }, [step]);

  const todayDOS = dosItems.filter(d => {
    if (d.status === "scheduled") return false;
    // Include items that were activated from scheduled (scheduledDate is still set but status !== "scheduled")
    if (d.scheduledDate && d.scheduledDate <= new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0]) return true;
    const ts = d.id.match(/DOS-(\d+)/)?.[1];
    if (!ts) return false;
    const itemDate = new Date(Number(ts)).toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
    return itemDate === new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
  });
  // Compute Deco Production Recipe items for the step wizard
  // Also include items assembled from Advanced Premix by the baker
  const decoProductionItems = freezerItems.filter(i => 
    i.status === "stored" && (
      (i.producedBy === "deco" && i.notes?.startsWith("Production Recipe")) ||
      (i.producedBy === "baker" && i.notes === "Production Recipe (Assembled)")
    )
  );

  const bakerDOS = todayDOS;
  const decoProductSet = new Set(decoProductionItems.map(i => i.productName));
  // Total DOS qty per product (for display)
  const dosQtyMap = new Map<string, number>();
  bakerDOS.forEach(d => { dosQtyMap.set(d.product, (dosQtyMap.get(d.product) || 0) + d.qty); });
  // Already baked qty per product (from freezer items — survives refresh)
  const bakedQtyMap = new Map<string, number>();
  freezerItems.filter(i => i.producedBy === "baker" && i.status === "stored").forEach(i => {
    bakedQtyMap.set(i.productName, (bakedQtyMap.get(i.productName) || 0) + i.qty);
  });

  // Only show products that exist in BOTH DOS and Deco Production Recipe
  // Baker bakes the Deco PR qty; DOS remaining = DOS - Deco PR
  const myTasks = (() => {
    const seen = new Set<string>();
    return bakerDOS
      .filter(d => decoProductSet.has(d.product) && !seen.has(d.product) && seen.add(d.product))
      .map((d, idx) => {
        const decoQty = decoProductionItems
          .filter(i => i.productName === d.product)
          .reduce((s, i) => s + i.qty, 0);
        return {
          id: `TASK-${d.product.replace(/[^a-zA-Z0-9]/g, "-")}`,
          product: d.product,
          target: decoQty,
          completed: 0,
          assignedTo: "baker" as const,
          status: "pending" as const,
        };
      });
  })();
  const tomorrowStr = (() => { const t = new Date(); t.setDate(t.getDate() + 1); return t.toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0]; })();
  const allBakerTasks = production.filter(p => p.assignedTo === "baker");
  const bakerScheduled = dosItems.filter(d => d.status === "scheduled" && d.scheduledDate === tomorrowStr && allBakerTasks.some(t => t.product === d.product));
  const releasedReqs = ingredientReqs.filter(r => r.status === "released");

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
  const handleSendToKitchen = () => {
    myTasks.forEach(t => {
      const prodTasks = production.filter(p => p.product === t.product && p.assignedTo === "baker");
      prodTasks.forEach(pt => onCompleteTask(pt.id));
    });
    setSent(true);
  };

  /* ── Assembly Tab ── */
  if (activeTab === "assembly") {
    // Only Advanced Premix items from Deco (batchRef starts with ADV-)
    const decoPremixItems = freezerItems.filter(i => i.producedBy === "deco" && i.status === "stored" && i.qty > 0 && i.batchRef?.startsWith("ADV-"));
    const pendingTasks = assemblyTasks.filter(t => t.status === "pending" && !t.dosId);
    const completedTasks = assemblyTasks.filter(t => t.status === "completed");
    const todayDOSProducts = [...new Set(bakerDOS.map(d => d.product))];

    // How much has already been assembled per product
    const assembledQtyMap = new Map<string, number>();
    completedTasks.forEach(t => {
      assembledQtyMap.set(t.productName, (assembledQtyMap.get(t.productName) || 0) + t.qtyAssembled);
    });

    const handleCompleteTask = (taskId: string, dosProduct: string, qty: number) => {
      const task = assemblyTasks.find(t => t.id === taskId);
      if (!task) return;
      const premixItem = freezerItems.find(i => i.id === task.premixItemId);
      if (!premixItem) return;
      if (qty > premixItem.qty) { alert("Not enough premix stock."); return; }
      const dosItemsForProduct = bakerDOS.filter(d => d.product === dosProduct);
      if (dosItemsForProduct.length === 0) { alert("No DOS item found for this product."); return; }
      const dosQtyTotal = dosItemsForProduct.reduce((s, d) => s + d.qty, 0);
      const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];

      // Deduct premix qty from freezer
      const updatedFreezer = freezerItems.map(f =>
        f.id === task.premixItemId ? { ...f, qty: Math.max(0, f.qty - qty) } : f
      );
      onUpdateFreezer?.(updatedFreezer);
      db.upsertFreezerItems(updatedFreezer.filter(f => f.id === task.premixItemId)).catch(console.error);

      // Create Production Recipe freezer item so baking step picks it up
      const assembledItem: FreezerItem = {
        id: `FRZ-${Date.now()}`,
        productName: dosProduct,
        qty,
        unit: "pcs",
        batchRef: `ASM-${Date.now()}`,
        producedBy: "baker",
        dateProduced: today,
        status: "stored",
        notes: "Production Recipe (Assembled)",
      };
      onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, assembledItem]);
      db.upsertFreezerItems([assembledItem]).catch(console.error);

      // Update assembly task to completed
      const updated: db.BakerAssemblyTask = {
        ...task,
        dosId: dosItemsForProduct[0].id,
        dosQty: dosQtyTotal,
        qtyAssembled: qty,
        status: "completed",
        notes: `Assembled to ${dosProduct} (${qty} pcs)`,
      };
      db.saveBakerAssemblyTask(updated).catch(console.error);
      setAssemblyTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    };

    const handleDirectAssemble = (product: string, premixId: string, qty: number) => {
      if (qty <= 0) return;
      const premixItem = freezerItems.find(i => i.id === premixId);
      if (!premixItem) return;
      if (qty > premixItem.qty) { alert("Not enough premix stock."); return; }
      const dosItemsForProduct = bakerDOS.filter(d => d.product === product);
      if (dosItemsForProduct.length === 0) { alert("No DOS item found for this product."); return; }
      const dosQtyTotal = dosItemsForProduct.reduce((s, d) => s + d.qty, 0);
      const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];

      // Deduct premix qty from freezer
      const updatedFreezer = freezerItems.map(f =>
        f.id === premixItem.id ? { ...f, qty: Math.max(0, f.qty - qty) } : f
      );
      onUpdateFreezer?.(updatedFreezer);
      db.upsertFreezerItems(updatedFreezer.filter(f => f.id === premixItem.id)).catch(console.error);

      // Create Production Recipe freezer item so baking step picks it up
      const assembledItem: FreezerItem = {
        id: `FRZ-${Date.now()}`,
        productName: product,
        qty,
        unit: "pcs",
        batchRef: `ASM-${Date.now()}`,
        producedBy: "baker",
        dateProduced: today,
        status: "stored",
        notes: "Production Recipe (Assembled)",
      };
      onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, assembledItem]);
      db.upsertFreezerItems([assembledItem]).catch(console.error);

      // Save assembly task
      const task: db.BakerAssemblyTask = {
        id: crypto.randomUUID?.() ?? `ASM-${Date.now()}`,
        productName: product,
        dosId: dosItemsForProduct[0].id,
        dosQty: dosQtyTotal,
        premixItemId: premixItem.id,
        premixQtyUsed: qty,
        qtyAssembled: qty,
        status: "completed",
        assembledBy: "baker",
        notes: `Assembled from premix ${premixItem.batchRef}`,
      };
      db.saveBakerAssemblyTask(task).catch(console.error);
      setAssemblyTasks(prev => [task, ...prev]);
    };

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-[24px] font-semibold">Assembly</h1>
          <p className="mt-1 text-[13px] text-zinc-600">Receive Advanced Premix from Deco and assemble recipe ingredients to DOS products — makes them ready for baking.</p>
        </div>

        {/* Pending Tasks from Deco */}
        {pendingTasks.length > 0 && (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50/30 p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
              Pending from Deco ({pendingTasks.length})
            </h2>
            <div className="space-y-3">
              {pendingTasks.map(task => {
                const premixItem = freezerItems.find(i => i.id === task.premixItemId);
                return (
                  <div key={task.id} className="rounded-xl border border-amber-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-[14px] font-medium text-zinc-900">{task.productName}</div>
                        <div className="text-[12px] text-zinc-500">Premix: {premixItem?.batchRef || "—"} &middot; Qty: {task.premixQtyUsed}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Link to DOS Product</label>
                        <input value={pendingDOSProducts[task.id] || ""} onChange={e => setPendingDOSProducts(prev => ({ ...prev, [task.id]: e.target.value }))} placeholder="Type product name" list={`pending-dos-${task.id}`} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] outline-none focus:border-zinc-400" />
                        <datalist id={`pending-dos-${task.id}`}>
                          {todayDOSProducts.map(p => <option key={p} value={p} />)}
                        </datalist>
                      </div>
                      <div className="w-24">
                        <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Qty</label>
                        <input type="number" min={1} max={task.premixQtyUsed} value={pendingQtys[task.id] ?? Math.min(1, task.premixQtyUsed)} onChange={e => setPendingQtys(prev => ({ ...prev, [task.id]: Math.max(1, Math.min(Number(e.target.value) || 1, task.premixQtyUsed))}))} className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-[13px] text-center outline-none focus:border-zinc-400" />
                      </div>
                      <div className="flex items-end">
                        <button onClick={() => handleCompleteTask(task.id, pendingDOSProducts[task.id] || "", pendingQtys[task.id] ?? Math.min(1, task.premixQtyUsed))} disabled={!pendingDOSProducts[task.id]?.trim() || (pendingQtys[task.id] ?? 0) <= 0} className="rounded-lg bg-amber-600 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-amber-500 disabled:opacity-40">Complete Assembly</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DOS Assembly Progress */}
        {todayDOSProducts.filter(p => completedTasks.some(t => t.productName === p) || decoPremixItems.some(i => i.productName === p)).length === 0 ? (
          pendingTasks.length === 0 && (
            <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-10 text-center shadow-sm">
              <p className="text-[14px] text-zinc-400">No Advanced Premix from Deco or completed assemblies yet.</p>
            </div>
          )
        ) : todayDOSProducts.filter(p => completedTasks.some(t => t.productName === p) || decoPremixItems.some(i => i.productName === p)).map(product => {
          const dosQtyTotal = bakerDOS.filter(d => d.product === product).reduce((s, d) => s + d.qty, 0);
          const recipe = recipes.find(r => r.productName === product);
          const availablePremix = decoPremixItems.filter(i => i.productName === product);
          const alreadyAssembled = assembledQtyMap.get(product) || 0;
          const remaining = dosQtyTotal - alreadyAssembled;
          const isComplete = alreadyAssembled >= dosQtyTotal;

          return (
            <div key={product} className={`rounded-[24px] border p-5 shadow-sm ${isComplete ? 'border-emerald-200 bg-emerald-50/30' : 'border-[#E8E0D5] bg-white'}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-[17px] font-semibold text-zinc-900">{product}</h2>
                  <p className="text-[13px] text-zinc-500 mt-0.5">DOS Qty: <strong>{dosQtyTotal}</strong> &middot; Assembled: <strong className={isComplete ? 'text-emerald-600' : ''}>{alreadyAssembled}</strong> &middot; Remaining: <strong>{Math.max(0, remaining)}</strong></p>
                </div>
                {isComplete && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-[12px] font-medium text-emerald-700">Complete</span>
                )}
              </div>

              {/* Recipe Ingredients */}
              {recipe && (
                <div className="mb-4 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4">
                  <h3 className="text-[13px] font-semibold text-zinc-700 mb-2">Recipe Ingredients</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                    {recipe.ingredients.map((ing, idx) => (
                      <div key={idx} className="text-[12px] text-zinc-600">
                        <span className="font-medium text-zinc-800">{ing.name}</span> — {ing.qtyPerBatch}{ing.unit} per batch
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Premix + Assemble */}
              {!isComplete && (
                <div>
                  {availablePremix.length === 0 ? (
                    <p className="text-[12px] text-zinc-400 italic">No Advanced Premix available from Deco for this product yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {availablePremix.map(premix => {
                        const localQty = assemblyQtys[premix.id] ?? Math.min(1, Math.min(premix.qty, remaining));
                        return (
                          <div key={premix.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-medium text-zinc-800">Batch: {premix.batchRef}</div>
                              <div className="text-[12px] text-zinc-500">Available: <strong>{premix.qty}</strong> &middot; Produced: {premix.dateProduced}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="number" min={1} max={Math.min(premix.qty, remaining)} value={localQty} onChange={e => setAssemblyQtys(prev => ({ ...prev, [premix.id]: Math.max(1, Math.min(Number(e.target.value) || 1, Math.min(premix.qty, remaining)))}))} className="w-20 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] text-center outline-none focus:border-zinc-400" />
                              <button onClick={() => handleDirectAssemble(product, premix.id, localQty)} disabled={localQty <= 0 || localQty > premix.qty} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-zinc-800 disabled:opacity-40">Assemble</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Assembly History */}
        <div className="rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
            <h2 className="text-[15px] font-semibold">Assembly History</h2>
            <span className="text-[12px] text-zinc-400">{assemblyTasks.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3 text-right">DOS Qty</th>
                  <th className="px-5 py-3 text-right">Assembled</th>
                  <th className="px-5 py-3">Premix Batch</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {assemblyTasks.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-[13px] text-zinc-400">No assemblies yet.</td></tr>
                ) : assemblyTasks.map(t => (
                  <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-5 py-3.5"><div className="text-[13px] font-medium text-zinc-900">{t.productName}</div></td>
                    <td className="px-5 py-3.5 text-[13px] text-right font-mono">{t.dosQty || "—"}</td>
                    <td className="px-5 py-3.5 text-[13px] text-right font-mono">{t.qtyAssembled}</td>
                    <td className="px-5 py-3.5 text-[12px] text-zinc-500 font-mono">{t.notes || "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${t.status === "completed" ? "bg-emerald-100 text-emerald-700" : t.status === "in_progress" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-500"}`}>{t.status.replace("_", " ")}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-zinc-500">{t.dosId ? "Baker" : "Deco"}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => { if (confirm(`Delete assembly for ${t.productName}?`)) { setAssemblyTasks(prev => prev.filter(x => x.id !== t.id)); db.deleteBakerAssemblyTask(t.id).catch(console.error); } }} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  /* ── Filling Tab ── */
  if (activeTab === "filling") {
    const fillings = freezerItems.filter(i => i.notes === "Filling" && i.status === "stored");
    const filtered = fillingSearch ? fillings.filter(i => i.productName.toLowerCase().includes(fillingSearch.toLowerCase())) : fillings;

    const handleAddFilling = () => {
      if (!fillingName.trim() || !fillingQty) return;
      const batchQty = Number(fillingQty);
      const recipe = recipes.find(r => r.productName === fillingName.trim());
      if (!recipe) { alert("No recipe found for this filling."); return; }

      // Deduct ingredients from inventory
      let workingInv = inventory;
      const deductions: string[] = [];
      recipe.ingredients.forEach(ing => {
        const match = ing.inventoryId
          ? workingInv.find(i => i.id === ing.inventoryId)
          : workingInv.find(i => i.name.toLowerCase() === ing.name.toLowerCase());
        if (!match) { deductions.push(`${ing.name} (not in inventory — skipped)`); return; }
        const idx = workingInv.findIndex(i => i.id === match.id);
        const needed = ing.qtyPerBatch * batchQty;
        const before = workingInv[idx].onHand;
        workingInv = workingInv.map((it, i) => i === idx ? { ...it, onHand: Math.max(0, before - needed) } : it);
        const actual = before - workingInv[idx].onHand;
        deductions.push(`${ing.name} -${actual}${ing.unit}`);
      });
      const changedItems = workingInv.filter(item => {
        const orig = inventory.find(o => o.id === item.id);
        return orig && Math.abs(orig.onHand - item.onHand) > 0.0001;
      });
      if (changedItems.length > 0) {
        onUpdateInventory?.(workingInv);
        db.upsertInventory(changedItems).catch(err => console.error("Failed to deduct ingredients:", err));
      }

      // Save filling to freezer — merge with existing today's batch if same productName
      const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
      const existing = freezerItems.find(f => f.productName === fillingName.trim() && f.dateProduced === today && f.notes === "Filling");
      if (existing) {
        const updated = freezerItems.map(f => f.id === existing.id ? { ...f, qty: f.qty + batchQty } : f);
        onUpdateFreezer?.(updated);
        db.upsertFreezerItems(updated.filter(f => f.id === existing.id)).catch(console.error);
      } else {
        const item: FreezerItem = {
          id: `FRZ-${Date.now()}`,
          productName: fillingName.trim(),
          qty: batchQty,
          unit: "batches",
          batchRef: `BATCH-${Date.now()}`,
          producedBy: "baker",
          dateProduced: today,
          status: "stored",
          notes: "Filling",
        };
        onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, item]);
        db.upsertFreezerItems([item]).catch(console.error);
      }

      // Add to My Inventory (or increment existing)
      const existingInv = inventory.find(i => i.name === fillingName.trim() && i.group === "ingredients");
      if (existingInv) {
        db.updateInventoryItem(existingInv.id, { onHand: existingInv.onHand + batchQty }).catch(console.error);
        onUpdateInventory?.(prev => prev.map(i => i.id === existingInv.id ? { ...i, onHand: i.onHand + batchQty } : i));
      } else {
        const newInv: InventoryItem = {
          id: `INV-${Date.now()}`,
          name: fillingName.trim(),
          onHand: batchQty,
          unit: "batches",
          category: "produce",
          group: "ingredients",
          accessRoles: ["baker"],
        };
        onUpdateInventory?.(prev => [...prev, newInv]);
        db.upsertInventoryItem(newInv).catch(console.error);
      }

      setFillingName(""); setFillingQty("");
    };

    return (
      <div className="space-y-5">
        <div><h1 className="text-[24px] font-semibold">Filling</h1><p className="mt-1 text-[13px] text-zinc-600">Record filling batches produced.</p></div>

        {/* Add Filling Form */}
        <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
          <h2 className="text-[15px] font-semibold mb-4">New Filling Batch</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Filling Name</label>
              <input value={fillingName} onChange={e => setFillingName(e.target.value)} placeholder="e.g. Vanilla Custard" list="filling-list" className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400" />
              <datalist id="filling-list">
                {recipes.map(r => <option key={r.productName} value={r.productName} />)}
              </datalist>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">Qty Produced</label>
              <input type="number" min={1} value={fillingQty} onChange={e => setFillingQty(e.target.value)} placeholder="0" className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-zinc-400" />
            </div>
            <div className="flex items-end">
              <button onClick={handleAddFilling} disabled={!fillingName.trim() || !fillingQty} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 disabled:opacity-40">Create Filling</button>
            </div>
          </div>
        </div>

        {/* Fillings List */}
        <div className="rounded-[24px] border border-[#E8E0D5] bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
            <h2 className="text-[15px] font-semibold">Filling Batches</h2>
            <div className="relative max-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px]">⌕</span>
              <input value={fillingSearch} onChange={e => setFillingSearch(e.target.value)} placeholder="Search..." className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-1.5 text-[13px] focus:outline-none focus:border-zinc-400" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3">Filling</th>
                  <th className="px-5 py-3 text-right">Qty</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Batch</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-[13px] text-zinc-400">No fillings recorded yet.</td></tr>
                ) : filtered.map(f => (
                  <tr key={f.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-5 py-3.5"><div className="text-[13px] font-medium text-zinc-900">{f.productName}</div></td>
                    <td className="px-5 py-3.5 text-[13px] text-right font-mono">{f.qty}</td>
                    <td className="px-5 py-3.5 text-[12px] text-zinc-500">{f.dateProduced}</td>
                    <td className="px-5 py-3.5 text-[12px] text-zinc-500 font-mono">{f.batchRef || "—"}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => { if (confirm(`Delete ${f.productName} batch?`)) { const updated = freezerItems.filter(x => x.id !== f.id); onUpdateFreezer?.(updated); db.deleteFreezerItem(f.id).catch(console.error); } }} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  /* ── Freezer Tab ── */
  if (activeTab === "freezer") {
    const bakerItems = freezerItems.filter(i => i.producedBy === "baker" && i.status === "stored");
    const bakerAccessInventory = inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("baker"));
    const decoItems = freezerItems.filter(i => i.producedBy === "deco" && i.status === "stored" && i.qty > 0);

    const tabItems = freezerTab === "baked-products" ? bakerItems : freezerTab === "my-inventory" ? bakerAccessInventory : decoItems;
    const filtered = tabItems.filter(i => !freezerSearch || (("name" in i ? (i as unknown as InventoryItem).name : (i as FreezerItem).productName).toLowerCase().includes(freezerSearch.toLowerCase())));

    const handleAdd = () => {
      if (!newProduct.trim() || !newQty) return;
      const item: FreezerItem = {
        id: `FRZ-${Date.now()}`,
        productName: newProduct.trim(),
        qty: Number(newQty),
        unit: newUnit,
        batchRef: newBatch.trim(),
        producedBy: "baker",
        dateProduced: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0],
        status: "stored",
        notes: newNotes.trim(),
      };
      onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, item]);
      db.upsertFreezerItems([item]).catch(console.error);
      setShowAddFreezer(false);
      setNewProduct(""); setNewQty(""); setNewBatch(""); setNewNotes("");
    };

    const canEdit = (item: FreezerItem) => item.producedBy === "baker";

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div><h1 className="text-[24px] font-semibold">Freezer</h1><p className="mt-1 text-[13px] text-zinc-600">Browse all freezer stocks by category.</p></div>
          <button onClick={() => setShowAddFreezer(true)} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Add Product</button>
        </div>

        <div className="flex gap-1.5 rounded-xl bg-zinc-100 p-1">
          <button onClick={() => setFreezerTab("baked-products")} className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all ${freezerTab === "baked-products" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>Baked Products</button>
          <button onClick={() => setFreezerTab("my-inventory")} className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all ${freezerTab === "my-inventory" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>My Inventory</button>
          <button onClick={() => setFreezerTab("deco-production-recipe")} className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all ${freezerTab === "deco-production-recipe" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>Deco Production Recipe</button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Baked Products</div><div className="text-[24px] font-semibold mt-1">{bakerItems.length}</div></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">My Inventory</div><div className="text-[24px] font-semibold mt-1">{bakerAccessInventory.length}</div></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Deco Cakes</div><div className="text-[24px] font-semibold mt-1">{decoItems.length}</div></div>
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
                  {freezerTab !== "my-inventory" && <th className="px-5 py-3">Batch</th>}
                  <th className="px-5 py-3">{freezerTab === "my-inventory" ? "Category" : "Date"}</th>
                  <th className="px-5 py-3">Section</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={freezerTab === "my-inventory" ? 5 : 6} className="px-5 py-12 text-center text-[13px] text-zinc-400">No items in this section.</td></tr>
                ) : freezerTab === "baked-products" ? (() => {
                  const grouped = new Map<string, { items: FreezerItem[]; totalQty: number }>();
                  (filtered as FreezerItem[]).forEach(f => {
                    if (!grouped.has(f.productName)) grouped.set(f.productName, { items: [], totalQty: 0 });
                    const g = grouped.get(f.productName)!;
                    g.items.push(f);
                    g.totalQty += f.qty;
                  });
                  return [...grouped.entries()].map(([productName, g]) => (
                    <tr key={productName} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-5 py-3.5"><div className="text-[13px] font-medium text-zinc-900">{productName}</div></td>
                      <td className="px-5 py-3.5 text-[13px] text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{g.totalQty} pcs</td>
                      <td className="px-5 py-3.5 text-[12px] text-zinc-600">{g.items.length} batch{g.items.length > 1 ? "es" : ""}</td>
                      <td className="px-5 py-3.5 text-[12px] text-zinc-500">{g.items[0]?.dateProduced || "—"}</td>
                      <td className="px-5 py-3.5"><span className="rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-medium">Baker</span></td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => { if (confirm(`Delete ALL batches of ${productName}?`)) { const ids = new Set(g.items.map(x => x.id)); const updated = freezerItems.filter(f => !ids.has(f.id)); onUpdateFreezer?.(updated); ids.forEach(id => db.deleteFreezerItem(id).catch(console.error)); } }} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Del All</button>
                      </td>
                    </tr>
                  ));
                })() : filtered.map(item => {
                  if (freezerTab === "my-inventory") {
                    const inv = item as unknown as InventoryItem;
                    return (
                      <tr key={inv.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-5 py-3.5"><div className="text-[13px] font-medium text-zinc-900">{inv.name}</div></td>
                        <td className="px-5 py-3.5 text-[13px] text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{inv.onHand} {inv.unit}</td>
                        <td className="px-5 py-3.5 text-[12px] text-zinc-500">{inv.group === "ingredients" ? "Ingredient" : inv.group === "packaging-materials" ? "Packaging" : inv.group === "decoration-supplies" ? "Decoration" : "Operational"}</td>
                        <td className="px-5 py-3.5"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{inv.group}</span></td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-[11px] text-zinc-400">View only</span>
                        </td>
                      </tr>
                    );
                  }
                  const frz = item as FreezerItem;
                  return (
                    <tr key={frz.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-5 py-3.5"><div className="text-[13px] font-medium text-zinc-900">{frz.productName}</div>{frz.notes && <div className="text-[11px] text-zinc-400 mt-0.5">{frz.notes}</div>}</td>
                      <td className="px-5 py-3.5 text-[13px] text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{frz.qty} {frz.unit}</td>
                      <td className="px-5 py-3.5 text-[12px] text-zinc-600" style={{ fontFamily: "Fragment Mono, monospace" }}>{frz.batchRef || "—"}</td>
                      <td className="px-5 py-3.5 text-[12px] text-zinc-500">{frz.dateProduced}</td>
                      <td className="px-5 py-3.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${frz.producedBy === "baker" ? "bg-amber-50 text-amber-700" : frz.producedBy === "deco" ? "bg-rose-50 text-rose-700" : "bg-zinc-100 text-zinc-600"}`}>{frz.producedBy === "baker" ? "Baker" : frz.producedBy === "deco" ? "Deco" : frz.producedBy}</span></td>
                      <td className="px-5 py-3.5 text-right">
                        {canEdit(frz) ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => { setEditingFreezerItem(frz); setShowEditFreezer(true); }} className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50">Edit</button>
                            <button onClick={() => { if (confirm(`Delete ${frz.productName}?`)) { const updated = freezerItems.filter(f => f.id !== frz.id); onUpdateFreezer?.(updated); db.deleteFreezerItem(frz.id).catch(console.error); } }} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Del</button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-400">View only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
        {steps.map((s, i) => {
          const canClick = i <= step + 1;
          return (
          <button key={s.id} onClick={() => canClick && setStep(i)} disabled={!canClick} className={`flex items-center gap-2.5 rounded-full px-5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-all ${i === step ? "bg-zinc-900 text-white shadow-sm" : i < step ? "bg-emerald-100 text-emerald-700" : "bg-zinc-50 text-zinc-300 cursor-not-allowed"}`}>
            <span className={`grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold ${i === step ? "bg-white/20" : i < step ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-300"}`}>{i < step ? "✓" : i + 1}</span>
            {s.label}
          </button>
          );
        })}
      </div>

      <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-6 shadow-sm">
        {step === 0 && (
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[21px] font-semibold">Your DOS Orders</h2>
                <p className="mt-1 text-[13px] text-zinc-500">Admin assigned these items for you to bake. Deco items are hidden — focus on your section.</p>
              </div>
  
            </div>
            {bakerDOS.length === 0 ? (
              <div className="mt-8 text-center py-8"><p className="text-[14px] text-zinc-400">No baking orders yet.</p><p className="text-[12px] text-zinc-400 mt-1">Wait for Admin to create a DOS.</p></div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-700 bg-zinc-800 text-left text-[11px] font-medium text-zinc-300 uppercase tracking-wider">
                      <th className="w-8 px-3 py-2.5"></th>
                      <th className="px-2 py-2.5">Product</th>
                      <th className="px-2 py-2.5">Priority</th>
                      <th className="px-2 py-2.5 text-right">Total</th>

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
                          <tr className={`border-b border-zinc-700 text-[13px] transition-colors ${hasIngredients ? "cursor-pointer hover:bg-zinc-800/60" : ""}`} onClick={() => hasIngredients && toggleDOS(d.id)}>
                            <td className="px-3 py-2.5 text-zinc-500 text-[10px] text-center">{hasIngredients ? (isExpanded ? "▾" : "▸") : ""}</td>
                            <td className="px-2 py-2.5 font-medium text-white">{d.product} {newDOSIds?.has(d.id) && <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-800 px-1.5 py-0.5 text-[9px] font-bold text-blue-200 uppercase tracking-wider">New</span>}</td>
                            <td className="px-2 py-2.5"><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${pColor}`}>{d.priority}</span></td>
                            <td className="px-2 py-2.5 text-right font-mono text-white">{d.qty}</td>

                            <td className="px-3 py-2.5 text-right"><span className={`inline-block h-2 w-2 rounded-full ${sDot}`} /></td>
                          </tr>
                          {isExpanded && hasIngredients && (
                            <tr key={`${d.id}-ing`}>
                              <td colSpan={5} className="px-3 pb-2.5 pt-0 bg-zinc-800/60">
                                <div className="flex flex-wrap items-center gap-1.5 pl-7">
                                  <span className="text-[10px] font-medium text-zinc-400 uppercase mr-0.5">Ingredients:</span>
                                  {recipe!.ingredients.map((ing, i) => (
                                    <span key={i} className="rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">{ing.name} x{ing.qtyPerBatch}{ing.unit}</span>
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
                    <tr className="border-t border-zinc-700 bg-zinc-800 text-[13px] font-semibold text-white">
                      <td colSpan={3} className="px-3 py-2.5">Total</td>
                      <td className="px-2 py-2.5 text-right font-mono">{bakerDOS.reduce((s, d) => s + d.qty, 0)}</td>

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
            <div className="mt-4 flex justify-end">
              <button onClick={() => setStep(1)} className="rounded-xl bg-zinc-900 px-4 py-2 sm:px-6 sm:py-3 text-[14px] font-medium text-white hover:bg-zinc-800">Next →</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><h2 className="text-[21px] font-semibold">Production</h2><span className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[10px] font-medium text-emerald-700">Live</span></span><p className="mt-1 text-[13px] text-zinc-500">Select products and specify how many to bake for this batch.</p></div>
              {releasedReqs.length > 0 && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200">✓ Stock ready</span>}
            </div>
            {myTasks.length === 0 ? (
              <div className="mt-8 text-center py-8"><p className="text-[14px] text-zinc-400">No tasks assigned.</p></div>
            ) : (
              <div className="mt-4 space-y-3">
                {myTasks.map(task => {
                  const alreadyBaked = bakedQtyMap.get(task.product) || 0;
                  const dosQty = dosQtyMap.get(task.product) || 0;
                  const isSelected = selectedForBaking.has(task.id);
                  const decoQty = task.target;
                  const bakeTarget = Math.max(0, decoQty);
                  const dosRemaining = Math.max(0, dosQty - alreadyBaked);
                  const defaultBake = Math.min(bakeTarget, Math.max(1, dosRemaining));
                  const bakeQty = bakerBakeQty[task.id] ?? defaultBake;
                  const isComplete = dosQty > 0 && alreadyBaked >= dosQty;
                  const noStock = bakeTarget <= 0;
                  const remaining = noStock ? dosRemaining : Math.max(0, dosRemaining - bakeQty);
                  const maxBake = bakeTarget;
                  const pct = dosQty > 0 ? Math.min(100, Math.round(((alreadyBaked + bakeQty) / dosQty) * 100)) : 0;
                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        if (isComplete || noStock) return;
                        setSelectedForBaking(prev => {
                          const n = new Set(prev);
                          if (n.has(task.id)) n.delete(task.id); else n.add(task.id);
                          return n;
                        });
                        // Initialize bake qty to remaining DOS when first selected
                        setBakerBakeQty(prev => {
                          if (prev[task.id] === undefined) return { ...prev, [task.id]: defaultBake };
                          return prev;
                        });
                      }}
                      className={`rounded-2xl border-2 p-4 transition-all ${isComplete ? "border-emerald-400 bg-emerald-50/30" : noStock ? "border-zinc-200 bg-zinc-50/50 opacity-60" : "cursor-pointer hover:border-zinc-300"} ${isSelected ? "border-zinc-900 bg-zinc-50/60 shadow-sm" : "border-zinc-200 bg-white"} ${isComplete ? "" : ""}`}
                    >
                      {isComplete && (
                        <div className="-mx-4 -mt-4 mb-3 rounded-t-2xl bg-emerald-600 px-4 py-2 text-center">
                          <span className="text-[13px] font-bold tracking-wider text-white uppercase">✓ Complete</span>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"}`}>
                              {isSelected && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className="text-[15px] font-medium text-zinc-900">{task.product}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${isComplete ? "bg-emerald-100 text-emerald-700 border-emerald-200" : noStock ? "bg-amber-100 text-amber-700 border-amber-200" : task.status === "in-progress" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-zinc-100 text-zinc-600 border-zinc-200"}`}>{isComplete ? "Complete" : noStock ? "No Stock" : task.status}</span>
                          </div>
                          {/* DOS / Deco / Remaining summary */}
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
                            <span className="text-zinc-500">DOS: <strong className="text-zinc-800">{dosQty}</strong> pcs</span>
                            <span className="text-rose-600">Deco PR: <strong>{decoQty}</strong> pcs</span>
                            <span className="text-zinc-500">Already baked: <strong className="text-zinc-800">{alreadyBaked}</strong> pcs</span>
                            <span className="text-amber-600">{noStock ? "Unbaked:" : "After baking:"} <strong>{remaining}</strong> pcs remaining</span>
                          </div>
                          <div className="mt-3"><div className="h-2 rounded-full bg-zinc-100"><div className="h-full rounded-full bg-stone-500" style={{ width: `${pct}%` }} /></div></div>
                          {noStock && <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-center text-[12px] font-medium text-amber-700">No Deco stock — await restock</div>}
                        </div>
                      </div>
                      {/* Input row */}
                      {!isComplete && !noStock && <div className="mt-3 flex items-center gap-2.5">
                        <label className="text-[12px] text-zinc-600 font-medium">Bake this batch:</label>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={e => { e.stopPropagation(); setBakerBakeQty(prev => ({ ...prev, [task.id]: Math.max(isComplete ? dosQty : 1, (prev[task.id] ?? 1) - 1) })); }}
                            disabled={isComplete && bakeQty <= dosQty}
                            className="w-7 h-7 rounded-lg border border-zinc-200 bg-white text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 flex items-center justify-center disabled:opacity-30"
                          >−</button>
                          <input
                            type="number"
                            min={isComplete ? dosQty : 1}
                            max={bakeTarget}
                            value={bakeQty}
                            onClick={e => e.stopPropagation()}
                            onChange={e => {
                              const v = Math.min(bakeTarget, Math.max(isComplete ? dosQty : 1, Number(e.target.value) || 1));
                              setBakerBakeQty(prev => ({ ...prev, [task.id]: v }));
                              if (!selectedForBaking.has(task.id)) {
                                setSelectedForBaking(prev => new Set(prev).add(task.id));
                              }
                            }}
                            className="w-16 text-center rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[13px] font-mono font-semibold outline-none focus:border-zinc-400"
                          />
                          <button
                            onClick={e => { e.stopPropagation(); setBakerBakeQty(prev => ({ ...prev, [task.id]: Math.min(bakeTarget, (prev[task.id] ?? 1) + 1) })); }}
                            className="w-7 h-7 rounded-lg border border-zinc-200 bg-white text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 flex items-center justify-center"
                          >+</button>
                        </div>
                        <span className="text-[12px] text-zinc-400 font-mono">/ {bakeTarget}</span>
                      </div>}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={selectedForBaking.size === 0}
                className="rounded-xl bg-zinc-900 px-4 py-2 sm:px-6 sm:py-3 text-[14px] font-medium text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="flex items-center justify-between">
              <div><h2 className="text-[21px] font-semibold">Withdraw Ingredients</h2><p className="mt-1 text-[13px] text-zinc-500">Pull ingredients from your My Inventory for the selected products. Quantities are deducted when you withdraw.</p></div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowInventoryModal(true)} className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50">Browse My Inventory</button>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600 font-mono">{selectedForBaking.size} product{selectedForBaking.size > 1 ? "s" : ""}</span>
              </div>
            </div>

            {(() => {
              const selectedTasks = myTasks.filter(t => selectedForBaking.has(t.id));
              if (selectedTasks.length === 0) {
                return (
                  <div className="mt-6 text-center py-8">
                    <p className="text-[14px] text-zinc-400">No products selected. Go back to Step 1 to select products.</p>
                  </div>
                );
              }
              const bakerInventory = inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("baker"));

              return (
                <div className="mt-4 space-y-6">
                  {selectedTasks.map(task => {
                    const recipe = recipes.find(r => r.productName === task.product);
                    if (!recipe || recipe.ingredients.length === 0) {
                      return (
                        <div key={task.id} className="rounded-2xl border border-zinc-200 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[15px] font-medium text-zinc-900">{task.product}</span>
                            <span className="text-[12px] text-zinc-400 font-mono">×{bakerBakeQty[task.id] || 1}</span>
                          </div>
                          <p className="text-[13px] text-zinc-400">No recipe ingredients defined for this product.</p>
                        </div>
                      );
                    }
                    const batchQty = bakerBakeQty[task.id] || 1;
                    return (
                      <div key={task.id} className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
                        <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[15px] font-semibold text-zinc-900">{task.product}</span>
                            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-700 font-mono">×{batchQty}</span>
                            <span className="text-[12px] text-zinc-400">batch{batchQty > 1 ? "es" : ""}</span>
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          {/* Recipe Ingredients */}
                          <div className="space-y-2">
                            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Recipe Ingredients Needed</div>
                            {recipe.ingredients.map((ing, i) => {
                              const totalNeeded = ing.qtyPerBatch * batchQty;
                              const invItem = bakerInventory.find(ii => ii.name === ing.name);
                              const withdrawnSoFar = withdrawnQtys[task.id]?.[ing.name] || 0;

                              return (
                                <div key={i} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[13px] font-medium text-zinc-800">{ing.name}</span>
                                      <span className="text-[11px] text-zinc-400">{ing.unit}</span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-[11px]">
                                      <span className="text-zinc-500">Needed: <strong className="text-zinc-800">{totalNeeded}</strong> {ing.unit}</span>
                                      <span className="text-emerald-600">Withdrawn: <strong>{withdrawnSoFar}</strong> {ing.unit}</span>
                                      {invItem && (
                                        <span className="text-zinc-500">Available: <strong className={invItem.onHand >= totalNeeded - withdrawnSoFar ? "text-emerald-600" : "text-amber-600"}>{invItem.onHand}</strong> {ing.unit}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      onClick={() => {
                                        const current = withdrawnQtys[task.id]?.[ing.name] || 0;
                                        const newWithdrawn = Math.max(0, current - 1);
                                        setWithdrawnQtys(prev => {
                                          const taskPrev = { ...(prev[task.id] || {}) };
                                          if (newWithdrawn <= 0) delete taskPrev[ing.name];
                                          else taskPrev[ing.name] = newWithdrawn;
                                          return { ...prev, [task.id]: taskPrev };
                                        });
                                        // Restore to My Inventory
                                        if (invItem) {
                                          db.updateInventoryItem(invItem.id, { onHand: invItem.onHand + 1 }).catch(console.error);
                                          onUpdateInventory?.(prev => prev.map(ii => ii.id === invItem.id ? { ...ii, onHand: ii.onHand + 1 } : ii));
                                        }
                                      }}
                                      disabled={(withdrawnQtys[task.id]?.[ing.name] || 0) <= 0}
                                      className="w-7 h-7 rounded-lg border border-zinc-200 bg-white text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 flex items-center justify-center disabled:opacity-30"
                                    >−</button>
                                    <span className="w-10 text-center font-mono text-[13px] font-semibold text-zinc-900">{withdrawnQtys[task.id]?.[ing.name] || 0}</span>
                                    <button
                                      onClick={() => {
                                        const current = withdrawnQtys[task.id]?.[ing.name] || 0;
                                        const maxAvail = invItem ? invItem.onHand : 0;
                                        if (current >= maxAvail) return;
                                        const newWithdrawn = Math.min(maxAvail, current + 1);
                                        setWithdrawnQtys(prev => ({
                                          ...prev,
                                          [task.id]: { ...(prev[task.id] || {}), [ing.name]: newWithdrawn }
                                        }));
                                        // Deduct from My Inventory
                                        if (invItem) {
                                          db.updateInventoryItem(invItem.id, { onHand: Math.max(0, invItem.onHand - 1) }).catch(console.error);
                                          onUpdateInventory?.(prev => prev.map(ii => ii.id === invItem.id ? { ...ii, onHand: Math.max(0, ii.onHand - 1) } : ii));
                                        }
                                      }}
                                      disabled={!invItem || invItem.onHand <= 0}
                                      className="w-7 h-7 rounded-lg border border-zinc-200 bg-white text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 flex items-center justify-center disabled:opacity-30"
                                    >+</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Withdraw all helper */}
                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => {
                                recipe.ingredients.forEach(ing => {
                                  const totalNeeded = ing.qtyPerBatch * batchQty;
                                  const invItem = bakerInventory.find(ii => ii.name === ing.name);
                                  if (invItem) {
                                    const currentWithdrawn = withdrawnQtys[task.id]?.[ing.name] || 0;
                                    const remainingToWithdraw = Math.min(totalNeeded, invItem.onHand) - currentWithdrawn;
                                    if (remainingToWithdraw > 0) {
                                      const newWithdrawn = currentWithdrawn + remainingToWithdraw;
                                      setWithdrawnQtys(prev => ({
                                        ...prev,
                                        [task.id]: { ...(prev[task.id] || {}), [ing.name]: newWithdrawn }
                                      }));
                                      db.updateInventoryItem(invItem.id, { onHand: Math.max(0, invItem.onHand - remainingToWithdraw) }).catch(console.error);
                                      onUpdateInventory?.(prev => prev.map(ii => ii.id === invItem.id ? { ...ii, onHand: Math.max(0, ii.onHand - remainingToWithdraw) } : ii));
                                    }
                                  }
                                });
                              }}
                              disabled={recipe.ingredients.every(ing => {
                                const invItem = bakerInventory.find(ii => ii.name === ing.name);
                                return !invItem || invItem.onHand <= 0;
                              })}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                            >Withdraw All Needed</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Withdrawn Items Summary */}
            {(() => {
              const allWithdrawn = new Map<string, number>();
              Object.values(withdrawnQtys).forEach(taskQtys => {
                Object.entries(taskQtys).forEach(([name, qty]) => {
                  allWithdrawn.set(name, (allWithdrawn.get(name) || 0) + qty);
                });
              });
              if (allWithdrawn.size === 0) return null;
              return (
                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-emerald-700 mb-2">Withdrawn Items</h3>
                  <div className="flex flex-wrap gap-2">
                    {[...allWithdrawn.entries()].map(([name, qty]) => (
                      <span key={name} className="rounded-full bg-emerald-100 border border-emerald-200 px-3 py-1 text-[12px] font-medium text-emerald-800">{name} ×{qty}</span>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setStep(3)}
                className="rounded-xl bg-zinc-900 px-6 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 shadow-sm transition-all"
              >
                Proceed to Save to Freezer →
              </button>
            </div>
          </div>
        )}

        {/* Browse My Inventory Modal */}
        {showInventoryModal && (() => {
          const selectedTasks = myTasks.filter(t => selectedForBaking.has(t.id));
          const bakerAccessInventory = inventory.filter(i => !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes("baker"));
          const invFiltered = modalSearch ? bakerAccessInventory.filter(i => i.name.toLowerCase().includes(modalSearch.toLowerCase())) : bakerAccessInventory;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowInventoryModal(false); setModalSearch(""); }}>
              <div className="w-full max-w-2xl max-h-[80vh] rounded-3xl bg-white p-6 shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[18px] font-semibold">My Inventory</h2>
                  <button onClick={() => { setShowInventoryModal(false); setModalSearch(""); }} className="text-zinc-400 hover:text-zinc-600 text-[18px]">✕</button>
                </div>
                <div className="relative mb-4">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px]">⌕</span>
                  <input value={modalSearch} onChange={e => setModalSearch(e.target.value)} placeholder="Search inventory..." className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-2.5 text-[13px] outline-none focus:border-zinc-400" />
                </div>
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 border-b border-zinc-100">
                    <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3 text-right">Available</th>
                      <th className="px-4 py-3 text-right">Withdrawn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {invFiltered.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-12 text-center text-[13px] text-zinc-400">No inventory items found.</td></tr>
                    ) : invFiltered.map(inv => {
                      const withdrawn = Object.values(withdrawnQtys).reduce((sum, tq) => sum + (tq[inv.name] || 0), 0);
                      return (
                        <tr key={inv.id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-4 py-3 text-[13px] font-medium text-zinc-900">{inv.name}</td>
                          <td className="px-4 py-3 text-[13px] text-right font-mono text-zinc-600">{inv.onHand}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  if (withdrawn <= 0) return;
                                  const newWithdrawn = withdrawn - 1;
                                  setWithdrawnQtys(prev => {
                                    const next = { ...prev };
                                    selectedTasks.forEach(t => {
                                      const taskPrev = { ...(next[t.id] || {}) };
                                      if (newWithdrawn <= 0) delete taskPrev[inv.name];
                                      else taskPrev[inv.name] = newWithdrawn;
                                      next[t.id] = taskPrev;
                                    });
                                    return next;
                                  });
                                  db.updateInventoryItem(inv.id, { onHand: inv.onHand + 1 }).catch(console.error);
                                  onUpdateInventory?.(prev => prev.map(ii => ii.id === inv.id ? { ...ii, onHand: ii.onHand + 1 } : ii));
                                }}
                                disabled={withdrawn <= 0}
                                className="w-7 h-7 rounded-lg border border-zinc-200 bg-white text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 flex items-center justify-center disabled:opacity-30"
                              >−</button>
                              <span className="w-10 text-center font-mono text-[13px] font-semibold text-zinc-900">{withdrawn}</span>
                              <button
                                onClick={() => {
                                  if (inv.onHand <= 0) return;
                                  const newWithdrawn = withdrawn + 1;
                                  setWithdrawnQtys(prev => {
                                    const next = { ...prev };
                                    selectedTasks.forEach(t => {
                                      const current = next[t.id]?.[inv.name] || 0;
                                      next[t.id] = { ...(next[t.id] || {}), [inv.name]: current + 1 };
                                    });
                                    return next;
                                  });
                                  db.updateInventoryItem(inv.id, { onHand: Math.max(0, inv.onHand - 1) }).catch(console.error);
                                  onUpdateInventory?.(prev => prev.map(ii => ii.id === inv.id ? { ...ii, onHand: Math.max(0, ii.onHand - 1) } : ii));
                                }}
                                disabled={inv.onHand <= 0}
                                className="w-7 h-7 rounded-lg border border-zinc-200 bg-white text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 flex items-center justify-center disabled:opacity-30"
                              >+</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => { setShowInventoryModal(false); setModalSearch(""); }} className="rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">Done</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Save Success Modal */}
        {showSaveSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-[20px] font-semibold text-zinc-900">Saved to Freezer!</h2>
              <p className="mt-2 text-[13px] text-zinc-500">Your baked products have been saved to Baked Products in the Freezer.</p>
              <button
                onClick={() => { setShowSaveSuccess(false); setStep(0); }}
                className="mt-6 w-full rounded-xl bg-zinc-900 py-3 text-[14px] font-semibold text-white hover:bg-zinc-800"
              >Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="flex items-center justify-between">
              <div><h2 className="text-[21px] font-semibold">Save to Freezer</h2><p className="mt-1 text-[13px] text-zinc-500">Save finished products to your Baked Products freezer and mark tasks as complete.</p></div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200">Ready to store</span>
            </div>

            {(() => {
              const selectedTasks = myTasks.filter(t => selectedForBaking.has(t.id));
              if (selectedTasks.length === 0) {
                return (
                  <div className="mt-6 text-center py-8">
                    <p className="text-[14px] text-zinc-400">No products to save.</p>
                  </div>
                );
              }

              const handleSaveToFreezer = () => {
                selectedTasks.forEach(task => {
                  const bakeQty = bakerBakeQty[task.id] || 1;
                  const alreadyBaked = bakedQtyMap.get(task.product) || 0;
                  const newTotal = alreadyBaked + bakeQty;
                  const dosQty = dosQtyMap.get(task.product) || 0;
                  const isComplete = dosQty > 0 ? newTotal >= dosQty : newTotal >= task.target;

                  // Add to freezer as baked product
                  const newItem: FreezerItem = {
                    id: `FRZ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    productName: task.product,
                    qty: bakeQty,
                    unit: "pcs",
                    batchRef: `BATCH-${Date.now()}`,
                    producedBy: "baker",
                    dateProduced: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0],
                    status: "stored",
                    notes: `Baked batch from production`,
                  };
                  db.upsertFreezerItems([newItem]).catch(console.error);

                  // Deduct baked qty from Deco Production Recipe items (first-come-first-served)
                  const decoPRItems = decoProductionItems.filter(i => i.productName === task.product);
                  let remainingToDeduct = bakeQty;
                  const changedDecoIds: Set<string> = new Set();
                  const decoDeductions: FreezerItem[] = [];
                  for (const di of decoPRItems) {
                    if (remainingToDeduct <= 0) break;
                    const deductQty = Math.min(remainingToDeduct, di.qty);
                    decoDeductions.push({ ...di, qty: di.qty - deductQty });
                    changedDecoIds.add(di.id);
                    remainingToDeduct -= deductQty;
                  }

                  // Single batch update to parent
                  onUpdateFreezer?.((prev: FreezerItem[]) => {
                    let next = [...prev, newItem];
                    if (decoDeductions.length > 0) {
                      next = next.map(f => {
                        const sub = decoDeductions.find(d => d.id === f.id);
                        return sub || f;
                      });
                    }
                    return next;
                  });

                  if (changedDecoIds.size > 0) {
                    const changedItems = decoDeductions.filter(d => changedDecoIds.has(d.id));
                    db.upsertFreezerItems(changedItems).catch(console.error);
                  }

                  if (isComplete) {
                    // Mark production task(s) as completed
                    const prodTasks = production.filter(p => p.product === task.product && p.assignedTo === "baker");
                    if (prodTasks.length > 0) {
                      prodTasks.forEach(pt => onCompleteTask(pt.id));
                    } else {
                      // Virtual task (no production record yet) — persist directly
                      db.upsertProduction([{
                        id: `PRD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        product: task.product,
                        target: task.target,
                        completed: newTotal,
                        assignedTo: "baker",
                        status: "completed",
                      }]).catch(console.error);
                    }
                  } else {
                    // Persist as in-progress
                    db.upsertProduction([{
                      id: `PRD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      product: task.product,
                      target: task.target,
                      completed: newTotal,
                      assignedTo: "baker",
                      status: "in-progress",
                    }]).catch(console.error);
                  }
                });

                // Clear selection for completed items
                setSelectedForBaking(new Set());
                setBakerBakeQty({});
                setWithdrawnQtys({});
                setShowSaveSuccess(true);
              };

              return (
                <div className="mt-4 space-y-3">
                  {selectedTasks.map(task => {
                    const bakeQty = bakerBakeQty[task.id] || 1;
                    const hasWithdrawn = withdrawnQtys[task.id] && Object.keys(withdrawnQtys[task.id]).length > 0;
                    return (
                      <div key={task.id} className="rounded-2xl border border-zinc-200 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-[15px] font-medium text-zinc-900">{task.product}</span>
                          <span className="text-[13px] text-zinc-500 font-mono">×{bakeQty}</span>
                          {hasWithdrawn ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">✓ Ingredients withdrawn</span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">⚠ No ingredients withdrawn</span>
                          )}
                        </div>
                        <span className="text-[12px] text-zinc-400">will be saved to Baked Products in Freezer</span>
                      </div>
                    );
                  })}
                  {/* Withdrawn Items Summary */}
                  {(() => {
                    const allWithdrawn = new Map<string, number>();
                    Object.values(withdrawnQtys).forEach(taskQtys => {
                      Object.entries(taskQtys).forEach(([name, qty]) => {
                        allWithdrawn.set(name, (allWithdrawn.get(name) || 0) + qty);
                      });
                    });
                    if (allWithdrawn.size === 0) return null;
                    return (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-emerald-700 mb-2">Withdrawn Items</h3>
                        <div className="flex flex-wrap gap-2">
                          {[...allWithdrawn.entries()].map(([name, qty]) => (
                            <span key={name} className="rounded-full bg-emerald-100 border border-emerald-200 px-3 py-1 text-[12px] font-medium text-emerald-800">{name} ×{qty}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  <button
                    onClick={handleSaveToFreezer}
                    className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-[14px] font-semibold text-white hover:bg-emerald-700 shadow-sm transition-all"
                  >
                    Save to Baked Products Freezer & Mark Complete ({selectedTasks.reduce((s, t) => s + (bakerBakeQty[t.id] || 1), 0)} pcs)
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-100">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="rounded-xl border border-zinc-300 px-4 py-2 sm:px-6 sm:py-3 text-[14px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed">← Back</button>
          <div className="text-[14px] text-zinc-400">Step {step + 1} of {steps.length}</div>
          <div className="w-24" />
        </div>
      </div>
    </div>
  );
}
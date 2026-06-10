const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src", "components", "DecoDashboard.tsx");
let content = fs.readFileSync(filePath, "utf8");
const nl = content.includes("\r\n") ? "\r\n" : "\n";

let ok = true;

// ─── 1. Add AdditionalIngredient import ───
const m1 = `import * as db from "../lib/db";`;
if (content.includes(m1)) {
  content = content.replace(m1, m1 + nl + `import type { AdditionalIngredient } from "../lib/db";`);
  console.log("1. Added AdditionalIngredient import");
} else { console.log("FAIL 1"); ok = false; }

// ─── 2. Update DecoProductionPrep type ───
const m2 = `type DecoProductionPrep = { dosId: string; productName: string; productQty: number; prepared: boolean; done: boolean };`;
const r2 = `type DecoProductionPrep = { dosId: string; productName: string; productQty: number; prepared: boolean; done: boolean; additionalIngredients: AdditionalIngredient[] };`;
if (content.includes(m2)) { content = content.replace(m2, r2); console.log("2. Updated DecoProductionPrep type"); }
else { console.log("FAIL 2"); ok = false; }

// ─── 3. Update save items.push ───
const m3a = `items.push({ dosId, productName: dos.product, productQty: productQty[dosId] ?? dos.qty, prepared: preMixPrepared.has(key), done: preMixDone.has(key) });`;
const r3a = `items.push({ dosId, productName: dos.product, productQty: productQty[dosId] ?? dos.qty, prepared: preMixPrepared.has(key), done: preMixDone.has(key), additionalIngredients: productAdditionalIngredients[key] ?? [] });`;
if (content.includes(m3a)) { content = content.replace(m3a, r3a); console.log("3a. Updated push 1"); }
else { console.log("FAIL 3a"); ok = false; }

const m3b = `items.push({ dosId, productName: r!.productName, productQty: productQty[dosId] ?? dos.qty, prepared: preMixPrepared.has(key), done: preMixDone.has(key) });`;
const r3b = `items.push({ dosId, productName: r!.productName, productQty: productQty[dosId] ?? dos.qty, prepared: preMixPrepared.has(key), done: preMixDone.has(key), additionalIngredients: productAdditionalIngredients[key] ?? [] });`;
if (content.includes(m3b)) { content = content.replace(m3b, r3b); console.log("3b. Updated push 2"); }
else { console.log("FAIL 3b"); ok = false; }

// ─── 4. Add props to Props ───
const m4 = `  onUpdateWasteLog?: (cb: WasteLog[] | ((prev: WasteLog[]) => WasteLog[])) => void;`;
const r4 = `  onUpdateWasteLog?: (cb: WasteLog[] | ((prev: WasteLog[]) => WasteLog[])) => void;
  productRoutes?: Record<string, db.ProductRoute>;
  onUpdateProduction?: (cb: ProductionTask[] | ((prev: ProductionTask[]) => ProductionTask[])) => void;`;
if (content.includes(m4)) { content = content.replace(m4, r4); console.log("4. Added props"); }
else { console.log("FAIL 4"); ok = false; }

// ─── 5. Update function signature ───
const m5 = `export default function DecoDashboard({ production, dosItems, onCompleteTask, activeTab, setActiveTab, productCatalog, recipes, inventory, onUpdateInventory, onUpdateRecipes, onAddAuditLog, newDOSIds, onMarkDOSSeen, freezerItems = [], onUpdateFreezer, freezerHistory = [], wasteLog = [], onUpdateWasteLog }: Props) {`;
const r5 = `export default function DecoDashboard({ production, dosItems, onCompleteTask, activeTab, setActiveTab, productCatalog, recipes, inventory, onUpdateInventory, onUpdateRecipes, onAddAuditLog, newDOSIds, onMarkDOSSeen, freezerItems = [], onUpdateFreezer, freezerHistory = [], wasteLog = [], onUpdateWasteLog, productRoutes = {}, onUpdateProduction }: Props) {`;
if (content.includes(m5)) { content = content.replace(m5, r5); console.log("5. Updated function signature"); }
else { console.log("FAIL 5"); ok = false; }

// ─── 6. Add state variables ───
const m6 = `const [productQty, setProductQty] = useState<Record<string, number>>({});`;
const r6 = `const [productQty, setProductQty] = useState<Record<string, number>>({});
  const [activePreparation, setActivePreparation] = useState<{ dos: DOSItem; recipe: ProductRecipe; route: "baker" | "deco" } | null>(null);
  const [additionalIngredients, setAdditionalIngredients] = useState<AdditionalIngredient[]>([]);
  const [actualOutput, setActualOutput] = useState<number | "">("");
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
  const [newAddIngredient, setNewAddIngredient] = useState<AdditionalIngredient>({ name: "", qty: 0, unit: "", reason: "", source: "" });
  const [productAdditionalIngredients, setProductAdditionalIngredients] = useState<Record<string, AdditionalIngredient[]>>({});`;
if (content.includes(m6)) { content = content.replace(m6, r6); console.log("6. Added state variables"); }
else { console.log("FAIL 6"); ok = false; }

// ─── 7. Add toast state ───
const m7 = `  const [wasteQty, setWasteQty] = useState<number>(1);`;
const r7 = `  const [wasteQty, setWasteQty] = useState<number>(1);${nl}${nl}  // Toast state${nl}  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);${nl}  const showToast = (message: string, type: "success" | "error" = "success") => {${nl}    setToast({ message, type });${nl}    setTimeout(() => setToast(null), 4000);${nl}  };`;
if (content.includes(m7)) { content = content.replace(m7, r7); console.log("7. Added toast state"); }
else { console.log("FAIL 7"); ok = false; }

// ─── 8. Update fetchDecoProductionPrep to restore additionalIngredients ───
const m8a = `    db.fetchDecoProductionPrep().then(items => {`;
const r8a = `    db.fetchDecoProductionPrep().then(items => {${nl}      const addIngMap: Record<string, AdditionalIngredient[]> = {};`;
if (content.includes(m8a)) { content = content.replace(m8a, r8a); console.log("8a. Added addIngMap"); }
else { console.log("FAIL 8a"); ok = false; }

const m8b = `        qty[i.dosId] = i.productQty;`;
const r8b = `        qty[i.dosId] = i.productQty;${nl}        if (i.additionalIngredients?.length) addIngMap[key] = i.additionalIngredients;`;
if (content.includes(m8b)) { content = content.replace(m8b, r8b); console.log("8b. Added restore in forEach"); }
else { console.log("FAIL 8b"); ok = false; }

const m8c = `      setProductQty(qty);`;
const r8c = `      setProductQty(qty);${nl}      if (Object.keys(addIngMap).length > 0) setProductAdditionalIngredients(addIngMap);`;
if (content.includes(m8c)) { content = content.replace(m8c, r8c); console.log("8c. Added setProductAdditionalIngredients"); }
else { console.log("FAIL 8c"); ok = false; }

// ─── 9. Update save useEffect deps ───
const m9 = `  }, [preMixPrepared, preMixDone, productQty]);`;
const r9 = `  }, [preMixPrepared, preMixDone, productQty, productAdditionalIngredients]);`;
if (content.includes(m9)) { content = content.replace(m9, r9); console.log("9. Updated useEffect deps"); }
else { console.log("FAIL 9"); ok = false; }

// ─── 10. Update workflowSteps ───
const m10 = `  const workflowSteps = [
    { id: "dashboard", label: "DOS Received" },
    { id: "production-plan", label: "Production Plan" },
    { id: "advanced-premix", label: "Advanced Premix" },
    { id: "deco-queue", label: "Decoration Queue" },
    { id: "freezer", label: "Finished Products" },
  ];`;
const r10 = `  const workflowSteps = [
    { id: "dashboard", label: "DOS Received" },
    { id: "tasks-to-prepare", label: "Tasks to Prepare" },
    { id: "production-plan", label: "Production Plan" },
    { id: "advanced-premix", label: "Advanced Premix" },
    { id: "deco-queue", label: "Decoration Queue" },
    { id: "freezer", label: "Finished Products" },
  ];`;
if (content.includes(m10)) { content = content.replace(m10, r10); console.log("10. Updated workflow steps"); }
else { console.log("FAIL 10"); ok = false; }

// ─── 11. Update dashboard Next button (Step 1 of 6, next: tasks-to-prepare) ───
const m11 = `        <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
          <div className="text-[12px] text-zinc-400">Step 1 of 5</div>
          <button
            onClick={() => setActiveTab("production-plan")}
            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all"
          >
            Next: Production Plan →
          </button>
        </div>`;
const r11 = `        <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
          <div className="text-[12px] text-zinc-400">Step 1 of 6</div>
          <button
            onClick={() => setActiveTab("tasks-to-prepare")}
            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all"
          >
            Next: Tasks to Prepare →
          </button>
        </div>`;
if (content.includes(m11)) { content = content.replace(m11, r11); console.log("11. Updated dashboard Next button"); }
else { console.log("FAIL 11"); ok = false; }

// ─── 12. Insert Tasks to Prepare Today tab between Dashboard and Production Plan ───
// Find the boundary between dashboard end and Production Plan start
const dbEnd = "  /* ── Production Plan Panel ── */";
const dashClose = "  /* ── Production Plan Panel ── */";
// The dashboard ends with `}` then blank line then Production Plan marker
// Find: blank + Production Plan marker
const m12 = "  /* ── Production Plan Panel ── */";
const tasksPanel = `  /* ── Tasks to Prepare ── */
  if (activeTab === "tasks-to-prepare") {
    const bakerTasks = dosForDeco.filter(d => productRoutes[d.product] === "baker" || !productRoutes[d.product]);
    const decoTasks = dosForDeco.filter(d => productRoutes[d.product] === "deco");

    const getRecipeForProduct = (product: string): ProductRecipe | undefined => {
      const direct = recipes.find(r => r.productName === product);
      if (direct) return direct;
      return recipes.find(r => (r.linkedIngredients ?? []).includes(product));
    };

    // TASK LIST VIEW
    if (!activePreparation) {
      return (
        <div className="max-w-5xl mx-auto space-y-6">
          {toast && (
            <div style={{ position: "fixed", top: 20, right: 20, zIndex: 100, display: "flex", alignItems: "center", gap: 12, borderRadius: 12, padding: "14px 20px", boxShadow: "0 8px 30px rgba(0,0,0,0.2)", background: toast.type === "success" ? "#059669" : "#dc2626", color: "#fff" }}>
              <span style={{ fontSize: 18 }}>{toast.type === "success" ? "\\u2713" : "\\u2717"}</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{toast.message}</span>
              <button onClick={() => setToast(null)} style={{ marginLeft: 8, color: "rgba(255,255,255,0.7)", background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>x</button>
            </div>
          )}

          <div className="rounded-2xl bg-zinc-900 p-6 shadow-sm">
            <h1 className="text-[28px] font-semibold tracking-tight text-white">Tasks to Prepare Today</h1>
            <p className="mt-1 text-[13px] text-zinc-400">View and prepare DOS items assigned to your team.</p>
          </div>

          {dosForDeco.length === 0 ? (
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-10 text-center">
              <p className="text-[14px] text-zinc-400">No DOS items assigned for today.</p>
            </div>
          ) : (
            <>
              {bakerTasks.length > 0 && (
                <div>
                  <h2 className="text-[16px] font-semibold text-white mb-3 flex items-center gap-2">
                    <span>\\uD83C\\uDF5E</span> For Baker
                  </h2>
                  <div className="space-y-3">
                    {bakerTasks.map(d => {
                      const recipe = getRecipeForProduct(d.product);
                      if (!recipe) return null;
                      const yieldPerBatch = recipe.yield || 1;
                      const batchesNeeded = Math.ceil(d.qty / yieldPerBatch);
                      const estProdTotal = batchesNeeded * yieldPerBatch;
                      return (
                        <div key={d.id} className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-[17px] font-semibold text-white">{d.product}</h3>
                              <div className="flex items-center gap-3 mt-1 text-[13px] text-zinc-400">
                                <span>Demand: <span className="font-mono font-semibold text-zinc-200">{d.qty} pcs</span></span>
                                <span>Yield/Batch: <span className="font-mono font-semibold text-zinc-200">{yieldPerBatch} pcs</span></span>
                                <span>Expected: <span className="font-mono font-semibold text-emerald-300">{estProdTotal} pcs</span></span>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 p-3 mb-3">
                            <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium mb-2">Ingredients Needed</div>
                            <div className="space-y-1.5">
                              {recipe.ingredients.map((ing, i) => (
                                <div key={i} className="flex items-center justify-between text-[13px]">
                                  <span className="text-zinc-300">{ing.name}</span>
                                  <span className="font-mono text-zinc-400">{ing.qtyPerBatch * batchesNeeded}{ing.unit}</span>
                                </div>
                              ))}
                              {recipe.ingredients.length === 0 && (
                                <span className="text-[12px] text-zinc-500">No ingredients listed</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setViewingDOSRecipe({ recipe, totalQty: d.qty })} className="rounded-xl border border-zinc-600 px-3 py-2 text-[12px] font-medium text-zinc-300 hover:bg-zinc-800 transition-all">View Recipe</button>
                            <button onClick={() => { setActivePreparation({ dos: d, recipe, route: "baker" }); setAdditionalIngredients([]); setActualOutput(""); }} className="rounded-xl bg-amber-600 px-4 py-2 text-[12px] font-medium text-white hover:bg-amber-700 transition-all">Start Pre-Mix</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {decoTasks.length > 0 && (
                <div>
                  <h2 className="text-[16px] font-semibold text-white mb-3 flex items-center gap-2">
                    <span>\\uD83C\\uDF82</span> For Decoration
                  </h2>
                  <div className="space-y-3">
                    {decoTasks.map(d => {
                      const recipe = getRecipeForProduct(d.product);
                      if (!recipe) return null;
                      const yieldPerBatch = recipe.yield || 1;
                      const batchesNeeded = Math.ceil(d.qty / yieldPerBatch);
                      const estProdTotal = batchesNeeded * yieldPerBatch;
                      return (
                        <div key={d.id} className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-[17px] font-semibold text-white">{d.product}</h3>
                              <div className="flex items-center gap-3 mt-1 text-[13px] text-zinc-400">
                                <span>Demand: <span className="font-mono font-semibold text-zinc-200">{d.qty} pcs</span></span>
                                <span>Yield/Batch: <span className="font-mono font-semibold text-zinc-200">{yieldPerBatch} pcs</span></span>
                                <span>Expected: <span className="font-mono font-semibold text-emerald-300">{estProdTotal} pcs</span></span>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 p-3 mb-3">
                            <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium mb-2">Ingredients Needed</div>
                            <div className="space-y-1.5">
                              {recipe.ingredients.map((ing, i) => (
                                <div key={i} className="flex items-center justify-between text-[13px]">
                                  <span className="text-zinc-300">{ing.name}</span>
                                  <span className="font-mono text-zinc-400">{ing.qtyPerBatch * batchesNeeded}{ing.unit}</span>
                                </div>
                              ))}
                              {recipe.ingredients.length === 0 && (
                                <span className="text-[12px] text-zinc-500">No ingredients listed</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setViewingDOSRecipe({ recipe, totalQty: d.qty })} className="rounded-xl border border-zinc-600 px-3 py-2 text-[12px] font-medium text-zinc-300 hover:bg-zinc-800 transition-all">View Recipe</button>
                            <button onClick={() => { setActivePreparation({ dos: d, recipe, route: "deco" }); setAdditionalIngredients([]); setActualOutput(""); }} className="rounded-xl bg-rose-600 px-4 py-2 text-[12px] font-medium text-white hover:bg-rose-700 transition-all">Start Preparation</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {viewingDOSRecipe && (
            <DOSRecipeDetailModal
              recipe={viewingDOSRecipe.recipe}
              totalQty={viewingDOSRecipe.totalQty}
              onClose={() => setViewingDOSRecipe(null)}
              onSaveYield={(newYield) => {
                const updated = { ...viewingDOSRecipe.recipe, yield: newYield };
                setViewingDOSRecipe({ ...viewingDOSRecipe, recipe: updated });
                if (onUpdateRecipes) {
                  onUpdateRecipes(prev => prev.map(r => r.productName === updated.productName ? updated : r));
                }
                db.upsertRecipe(updated).catch(console.error);
              }}
            />
          )}

          <div className="flex items-center justify-between pt-4 border-t border-zinc-700">
            <div className="text-[12px] text-zinc-500">Step 2 of 6</div>
            <button onClick={() => setActiveTab("production-plan")} className="rounded-xl bg-zinc-800 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-700 transition-all">Next: Production Plan \\u2192</button>
          </div>
        </div>
      );
    }

    // PREPARATION VIEW
    const { dos, recipe, route } = activePreparation;
    const yieldPerBatch = recipe.yield || 1;
    const batchesNeeded = Math.ceil(dos.qty / yieldPerBatch);
    const expectedOutput = batchesNeeded * yieldPerBatch;
    const prepKey = dos.id + "-" + dos.product.toLowerCase();
    const savedAddIngs = productAdditionalIngredients[prepKey] || [];

    const handleComplete = () => {
      const output = actualOutput === "" ? expectedOutput : Number(actualOutput);
      const finalAddIngs = [...savedAddIngs, ...additionalIngredients];
      setProductAdditionalIngredients(prev => ({ ...prev, [prepKey]: finalAddIngs }));

      const newInv = [...inventory];
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

      recipe.ingredients.forEach(ing => {
        const match = findMatch(ing);
        if (!match) return;
        const idx = newInv.findIndex(i => i.id === match.id);
        const needed = ing.qtyPerBatch * dos.qty;
        newInv[idx] = { ...newInv[idx], onHand: Math.max(0, newInv[idx].onHand - needed) };
      });

      additionalIngredients.forEach(addIng => {
        const match = findMatch({ name: addIng.name });
        if (!match) return;
        const idx = newInv.findIndex(i => i.id === match.id);
        newInv[idx] = { ...newInv[idx], onHand: Math.max(0, newInv[idx].onHand - addIng.qty) };
      });

      onUpdateInventory(newInv);
      const changed = newInv.filter((item, i) => {
        const orig = inventory[i];
        return orig && Math.abs(orig.onHand - item.onHand) > 0.0001;
      });
      if (changed.length > 0) db.upsertInventory(changed).catch(console.error);

      if (route === "baker") {
        const freezerItem: FreezerItem = {
          id: "FRZ-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
          productName: dos.product,
          batchRef: "DEC-" + Date.now(),
          qty: output, unit: "pcs", status: "stored", producedBy: "deco",
          dateProduced: new Date().toISOString(), notes: "Production Recipe",
        };
        if (onUpdateFreezer) onUpdateFreezer((prev) => [...prev, freezerItem]);
        db.upsertFreezerItems([freezerItem]).catch(console.error);
        onAddAuditLog?.("TASK_COMPLETED", dos.product + " x" + output + " sent to Baker");
        showToast(dos.product + " sent to Baker. Ingredients deducted.");
      } else {
        const existingItem = newInv.find(i => i.name === dos.product && i.accessRoles?.includes("deco") && i.source === "production-prep");
        if (existingItem) {
          const updated = { ...existingItem, onHand: existingItem.onHand + output };
          const idx = newInv.findIndex(i => i.id === existingItem.id);
          newInv[idx] = updated;
          db.upsertInventory([updated]).catch(console.error);
        } else {
          const newItem: InventoryItem = {
            id: "INV-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
            name: dos.product,
            sku: "DECO-" + dos.product.substring(0, 8).toUpperCase() + "-" + Date.now(),
            unit: "pcs", onHand: output, threshold: 0, cost: 0, supplier: "",
            lastIn: new Date().toISOString(), category: "dry", group: "ingredients",
            accessRoles: ["deco"] as Role[], source: "production-prep",
          };
          onUpdateInventory((prev) => [...prev, newItem]);
          db.upsertInventory([newItem]).catch(console.error);
        }
        onAddAuditLog?.("TASK_COMPLETED", dos.product + " x" + output + " moved to Decoration Inventory");
        showToast(dos.product + " moved to Decoration Inventory. Ingredients deducted.");
      }
      setActivePreparation(null);
    };

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {toast && (
          <div style={{ position: "fixed", top: 20, right: 20, zIndex: 100, display: "flex", alignItems: "center", gap: 12, borderRadius: 12, padding: "14px 20px", boxShadow: "0 8px 30px rgba(0,0,0,0.2)", background: toast.type === "success" ? "#059669" : "#dc2626", color: "#fff" }}>
            <span style={{ fontSize: 18 }}>{toast.type === "success" ? "\\u2713" : "\\u2717"}</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{toast.message}</span>
            <button onClick={() => setToast(null)} style={{ marginLeft: 8, color: "rgba(255,255,255,0.7)", background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>x</button>
          </div>
        )}

        <button onClick={() => setActivePreparation(null)} className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-zinc-300 hover:bg-zinc-800 transition-all">
          <span className="text-[14px]">\\u2190</span> Back to Tasks
        </button>

        <div>
          <h1 className="text-[24px] font-semibold text-white">{dos.product}</h1>
          <p className="text-[13px] text-zinc-400 mt-1">Route: {route === "baker" ? "Bakery" : "Decoration"}</p>
        </div>

        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
          <h3 className="text-[14px] font-bold text-zinc-200 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-zinc-400"></span> Standard Ingredients
          </h3>
          <div className="space-y-2">
            {recipe.ingredients.map((ing, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2">
                <span className="text-[13px] text-zinc-300 font-medium">{ing.name}</span>
                <span className="font-mono text-[13px] text-zinc-400">{ing.qtyPerBatch * dos.qty}{ing.unit}</span>
              </div>
            ))}
            {recipe.ingredients.length === 0 && (
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
                  <span className="font-mono text-[13px] text-amber-200">{a.qty}{a.unit}</span>
                </div>
              ))}
            </div>
          )}

          {additionalIngredients.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {additionalIngredients.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-amber-900/20 border border-amber-800/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-zinc-200">{a.name}</span>
                    <span className="text-[11px] text-amber-400/60">{a.reason}</span>
                  </div>
                  <span className="font-mono text-[13px] text-amber-200">{a.qty}{a.unit}</span>
                </div>
              ))}
            </div>
          )}

          {showAddIngredientModal && (
            <div className="rounded-lg bg-amber-900/30 border border-amber-700/50 p-3 mb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input value={newAddIngredient.name} onChange={e => setNewAddIngredient(prev => ({ ...prev, name: e.target.value }))} placeholder="Ingredient name" className="rounded-md bg-zinc-900 border border-zinc-700 px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-amber-500" />
                <div className="flex gap-1">
                  <input type="number" min={0} value={newAddIngredient.qty || ""} onChange={e => setNewAddIngredient(prev => ({ ...prev, qty: Math.max(0, Number(e.target.value)) }))} placeholder="Qty" className="flex-1 rounded-md bg-zinc-900 border border-zinc-700 px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-amber-500" />
                  <input value={newAddIngredient.unit} onChange={e => setNewAddIngredient(prev => ({ ...prev, unit: e.target.value }))} placeholder="Unit" className="w-16 rounded-md bg-zinc-900 border border-zinc-700 px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-amber-500" />
                </div>
              </div>
              <input value={newAddIngredient.reason} onChange={e => setNewAddIngredient(prev => ({ ...prev, reason: e.target.value }))} placeholder="Reason (e.g. Dropped while preparing dough)" className="w-full rounded-md bg-zinc-900 border border-zinc-700 px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-amber-500" />
              <div className="flex gap-2">
                <button onClick={() => { if (!newAddIngredient.name || newAddIngredient.qty <= 0) return; setAdditionalIngredients(prev => [...prev, { ...newAddIngredient }]); setNewAddIngredient({ name: "", qty: 0, unit: "", reason: "", source: "" }); setShowAddIngredientModal(false); }} className="flex-1 rounded-md bg-amber-600 py-1.5 text-[11px] font-medium text-white hover:bg-amber-700 transition-all">Add</button>
                <button onClick={() => setShowAddIngredientModal(false)} className="rounded-md bg-zinc-800 px-3 py-1.5 text-[11px] font-medium text-zinc-400 hover:bg-zinc-700">Cancel</button>
              </div>
            </div>
          )}

          {!showAddIngredientModal && (
            <button onClick={() => setShowAddIngredientModal(true)} className="flex items-center gap-1.5 rounded-lg border border-dashed border-amber-700/50 px-3 py-2 text-[12px] font-medium text-amber-400 hover:bg-amber-900/20 transition-all w-full justify-center">+ Add Additional Ingredient</button>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
          <h3 className="text-[14px] font-bold text-zinc-200 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-zinc-400"></span> Production Result
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-zinc-800/50 p-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Expected Production</div>
              <div className="text-[20px] font-bold text-emerald-300 mt-1">{expectedOutput}</div>
            </div>
            <div className="rounded-lg bg-zinc-800/50 p-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Actual Production</div>
              <div className="mt-1">
                <input type="number" min={0} value={actualOutput} onChange={e => setActualOutput(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))} placeholder={String(expectedOutput)} className="w-full rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-[16px] font-bold font-mono text-white outline-none focus:border-emerald-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-700">
          <div className="text-[12px] text-zinc-500">Step 2 of 6</div>
          <button onClick={handleComplete} className="rounded-xl bg-emerald-600 px-6 py-2.5 text-[13px] font-medium text-white hover:bg-emerald-700 transition-all">
            {route === "baker" ? "Save & Send to Baker" : "Move to Decoration Inventory"}
          </button>
        </div>
      </div>
    );
  }`;

// Insert tasks-to-prepare tab before Production Plan Panel
if (content.includes(m12)) {
  content = content.replace(m12, tasksPanel + nl + nl + m12);
  console.log("12. Added Tasks to Prepare tab");
} else {
  console.log("FAIL 12"); ok = false;
}

// ─── 13. Also update Production Plan's step count ───
// Find and update "Step 2 of 5" in the production plan
const m13 = `          <div className="text-[12px] text-zinc-500">Step 2 of 5</div>`;
const r13 = `          <div className="text-[12px] text-zinc-500">Step 3 of 6</div>`;
const matches13 = content.match(new RegExp(m13.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
if (matches13) {
  // Replace only the first occurrence (the one in Production Plan)
  content = content.replace(m13, r13);
  console.log("13. Updated Production Plan step to 3 of 6");
} else { console.log("FAIL 13"); ok = false; }

// ─── 14. Update Advanced Premix step from 3 to 4 ───
// Looking for "Step 3 of 5" in advanced premix
const m14 = `            <div className="text-[12px] text-zinc-500">Step 3 of 5</div>`;
const r14 = `            <div className="text-[12px] text-zinc-500">Step 4 of 6</div>`;
if (content.includes(m14)) { content = content.replace(m14, r14); console.log("14. Updated Advanced Premix step"); }
else { console.log("FAIL 14"); ok = false; }

// ─── 15. Update Deco Queue step from 4 to 5 ───
const m15 = `            <div className="text-[12px] text-zinc-500">Step 4 of 5</div>`;
const r15 = `            <div className="text-[12px] text-zinc-500">Step 5 of 6</div>`;
if (content.includes(m15)) { content = content.replace(m15, r15); console.log("15. Updated Deco Queue step"); }
else { console.log("FAIL 15");; }

// ─── 16. Update Freezer step from 5 to 6 ───
const m16 = `            <div className="text-[12px] text-zinc-500">Step 5 of 5</div>`;
const r16 = `            <div className="text-[12px] text-zinc-500">Step 6 of 6</div>`;
if (content.includes(m16)) { content = content.replace(m16, r16); console.log("16. Updated Freezer step"); }
else { console.log("FAIL 16"); }

fs.writeFileSync(filePath, content, "utf8");
if (ok) {
  console.log("\n✅ All changes applied successfully!");
} else {
  console.log("\n⚠️ Some changes failed - check above");
}

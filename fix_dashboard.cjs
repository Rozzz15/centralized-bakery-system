const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src", "components", "DecoDashboard.tsx");
let content = fs.readFileSync(filePath, "utf8");
const nl = content.includes("\r\n") ? "\r\n" : "\n";

// ──────────────────────────────────────────────────────────────
// Change 1: Add import for AdditionalIngredient type
// ──────────────────────────────────────────────────────────────
const oldImport = `import * as db from "../lib/db";`;
const newImport = `import * as db from "../lib/db";${nl}import type { AdditionalIngredient } from "../lib/db";`;
if (content.includes(oldImport)) {
  content = content.replace(oldImport, newImport);
  console.log("✅ Change 1: Added AdditionalIngredient import");
} else {
  console.log("❌ Change 1: Could not find import line");
}

// ──────────────────────────────────────────────────────────────
// Change 2: Add productRoutes and onUpdateProduction to Props
// ──────────────────────────────────────────────────────────────
const oldPropsEnd = `  onUpdateWasteLog?: (cb: WasteLog[] | ((prev: WasteLog[]) => WasteLog[])) => void;`;
const newPropsEnd = oldPropsEnd + nl +
`  productRoutes?: Record<string, db.ProductRoute>;
  onUpdateProduction?: (cb: ProductionTask[] | ((prev: ProductionTask[]) => ProductionTask[])) => void;`;
if (content.includes(oldPropsEnd)) {
  content = content.replace(oldPropsEnd, newPropsEnd);
  console.log("✅ Change 2: Added props to Props type");
} else {
  console.log("❌ Change 2: Could not find Props end");
}

// ──────────────────────────────────────────────────────────────
// Change 3: Add productRoutes and onUpdateProduction to function signature
// ──────────────────────────────────────────────────────────────
const oldSig = `export default function DecoDashboard({ production, dosItems, onCompleteTask, activeTab, setActiveTab, productCatalog, recipes, inventory, onUpdateInventory, onUpdateRecipes, onAddAuditLog, newDOSIds, onMarkDOSSeen, freezerItems = [], onUpdateFreezer, freezerHistory = [], wasteLog = [], onUpdateWasteLog }: Props) {`;
const newSig = `export default function DecoDashboard({ production, dosItems, onCompleteTask, activeTab, setActiveTab, productCatalog, recipes, inventory, onUpdateInventory, onUpdateRecipes, onAddAuditLog, newDOSIds, onMarkDOSSeen, freezerItems = [], onUpdateFreezer, freezerHistory = [], wasteLog = [], onUpdateWasteLog, productRoutes = {}, onUpdateProduction }: Props) {`;
if (content.includes(oldSig)) {
  content = content.replace(oldSig, newSig);
  console.log("✅ Change 3: Updated function signature");
} else {
  console.log("❌ Change 3: Could not find function signature");
}

// ──────────────────────────────────────────────────────────────
// Change 4: Add state variables
// ──────────────────────────────────────────────────────────────
const oldStateLine = `const [productQty, setProductQty] = useState<Record<string, number>>({});`;
const newStateLines = `const [productQty, setProductQty] = useState<Record<string, number>>({});
  const [activePreparation, setActivePreparation] = useState<{
    dos: DOSItem;
    recipe: ProductRecipe;
    route: "baker" | "deco";
  } | null>(null);
  const [additionalIngredients, setAdditionalIngredients] = useState<AdditionalIngredient[]>([]);
  const [actualOutput, setActualOutput] = useState<number | "">("");
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
  const [newAddIngredient, setNewAddIngredient] = useState<{ name: string; qty: number; unit: string; reason: string }>({ name: "", qty: 0, unit: "", reason: "" });
  const [productAdditionalIngredients, setProductAdditionalIngredients] = useState<Record<string, AdditionalIngredient[]>>({});`;
if (content.includes(oldStateLine)) {
  content = content.replace(oldStateLine, newStateLines);
  console.log("✅ Change 4: Added state variables");
} else {
  console.log("❌ Change 4: Could not find state line");
}

// ──────────────────────────────────────────────────────────────
// Change 5: Update fetchDecoProductionPrep to restore additionalIngredients
// ──────────────────────────────────────────────────────────────

// Add addIngMap variable and restore logic
// Pattern 1: Add addIngMap declaration
const pat1 = "    db.fetchDecoProductionPrep().then(items => {";
const pat1New = "    db.fetchDecoProductionPrep().then(items => {\n      const addIngMap: Record<string, AdditionalIngredient[]> = {};";
if (content.includes(pat1)) {
  content = content.replace(pat1, pat1New);
  console.log("✅ Change 5a: Added addIngMap");
} else {
  console.log("❌ Change 5a: Could not find fetch effect start");
}

// Pattern 2: Add addIngMap[key] = ... inside forEach
const pat2 = "        qty[i.dosId] = i.productQty;";
const pat2New = "        qty[i.dosId] = i.productQty;\n        if (i.additionalIngredients?.length) addIngMap[key] = i.additionalIngredients;";
if (content.includes(pat2)) {
  content = content.replace(pat2, pat2New);
  console.log("✅ Change 5b: Added addIngMap[key] restore");
} else {
  console.log("❌ Change 5b: Could not find qty assignment");
}

// Pattern 3: Add setProductAdditionalIngredients after setProductQty
const pat3 = "      setProductQty(qty);";
const pat3New = `      setProductQty(qty);
      if (Object.keys(addIngMap).length > 0) setProductAdditionalIngredients(addIngMap);`;
if (content.includes(pat3)) {
  content = content.replace(pat3, pat3New);
  console.log("✅ Change 5c: Added setProductAdditionalIngredients restore");
} else {
  console.log("❌ Change 5c: Could not find setProductQty");
}

// ──────────────────────────────────────────────────────────────
// Change 6: Update save useEffect dependency array
// ──────────────────────────────────────────────────────────────
const oldDeps = "  }, [preMixPrepared, preMixDone, productQty]);";
const newDeps = "  }, [preMixPrepared, preMixDone, productQty, productAdditionalIngredients]);";
if (content.includes(oldDeps)) {
  content = content.replace(oldDeps, newDeps);
  console.log("✅ Change 6: Updated useEffect deps");
} else {
  console.log("❌ Change 6: Could not find deps");
}

// ──────────────────────────────────────────────────────────────
// Change 7: Replace the entire Dashboard section
// ──────────────────────────────────────────────────────────────

const dashStartMarker = "  /* ── Dashboard ── */";
const dashEndMarker = "  /* ── Production Plan Panel ── */";

const dashStartIdx = content.indexOf(dashStartMarker);
const dashEndIdx = content.indexOf(dashEndMarker);

if (dashStartIdx === -1 || dashEndIdx === -1) {
  console.log("❌ Change 7: Could not find dashboard markers");
  process.exit(1);
}

const dashSectionToReplace = content.substring(dashStartIdx, dashEndIdx).trimEnd();

// Build the replacement using array join to avoid template literal issues
const newDashSection = [
  '  /* ── Dashboard ── */',
  '  if (activeTab === "dashboard") {',
  '    // Group DOS items by route',
  '    const bakerTasks = dosForDeco.filter(d => productRoutes[d.product] === "baker" || !productRoutes[d.product]);',
  '    const decoTasks = dosForDeco.filter(d => productRoutes[d.product] === "deco");',
  '',
  '    const getRecipeForProduct = (product: string): ProductRecipe | undefined => {',
  '      const direct = recipes.find(r => r.productName === product);',
  '      if (direct) return direct;',
  '      return recipes.find(r => (r.linkedIngredients ?? []).includes(product));',
  '    };',
  '',
  '    // Task List View',
  '    if (!activePreparation) {',
  '      return (',
  '        <div className="max-w-5xl mx-auto space-y-6">',
  '          {/* Toast Notification */}',
  '          {toast && (',
  '            <div style={{ position: "fixed", top: 20, right: 20, zIndex: 100, display: "flex", alignItems: "center", gap: 12, borderRadius: 12, padding: "14px 20px", boxShadow: "0 8px 30px rgba(0,0,0,0.2)", background: toast.type === "success" ? "#059669" : "#dc2626", color: "#fff" }}>',
  '              <span style={{ fontSize: 18 }}>{toast.type === "success" ? "\\u2713" : "\\u2717"}</span>',
  '              <span style={{ fontSize: 13, fontWeight: 500 }}>{toast.message}</span>',
  '              <button onClick={() => setToast(null)} style={{ marginLeft: 8, color: "rgba(255,255,255,0.7)", background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>x</button>',
  '            </div>',
  '          )}',
  '',
  '          {/* Header */}',
  '          <div className="rounded-2xl bg-zinc-900 p-6 shadow-sm">',
  '            <h1 className="text-[28px] font-semibold tracking-tight text-white">Tasks to Prepare Today</h1>',
  '            <p className="mt-1 text-[13px] text-zinc-400">View and prepare DOS items assigned to your team.</p>',
  '          </div>',
  '',
  '          {dosForDeco.length === 0 ? (',
  '            <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-10 text-center">',
  '              <p className="text-[14px] text-zinc-400">No DOS items assigned for today.</p>',
  '            </div>',
  '          ) : (',
  '            <>',
  '              {/* Baker Section */}',
  '              {bakerTasks.length > 0 && (',
  '                <div>',
  '                  <h2 className="text-[16px] font-semibold text-white mb-3 flex items-center gap-2">',
  '                    <span>🍞</span> For Baker',
  '                  </h2>',
  '                  <div className="space-y-3">',
  '                    {bakerTasks.map(d => {',
  '                      const recipe = getRecipeForProduct(d.product);',
  '                      if (!recipe) return null;',
  '                      const yieldPerBatch = recipe.yield || 1;',
  '                      const estProdTotal = yieldPerBatch * d.qty;',
  '                      return (',
  '                        <div key={d.id} className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">',
  '                          <div className="flex items-start justify-between mb-3">',
  '                            <div>',
  '                              <h3 className="text-[17px] font-semibold text-white">{d.product}</h3>',
  '                              <div className="flex items-center gap-3 mt-1 text-[13px] text-zinc-400">',
  '                                <span>Demand: <span className="font-mono font-semibold text-zinc-200">{d.qty} pcs</span></span>',
  '                                <span>Yield/Batch: <span className="font-mono font-semibold text-zinc-200">{yieldPerBatch} pcs</span></span>',
  '                                <span>Expected: <span className="font-mono font-semibold text-emerald-300">{estProdTotal} pcs</span></span>',
  '                              </div>',
  '                            </div>',
  '                          </div>',
  '',
  '                          {/* Ingredients Needed */}',
  '                          <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 p-3 mb-3">',
  '                            <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium mb-2">Ingredients Needed</div>',
  '                            <div className="space-y-1.5">',
  '                              {recipe.ingredients.map((ing, i) => (',
  '                                <div key={i} className="flex items-center justify-between text-[13px]">',
  '                                  <span className="text-zinc-300">{ing.name}</span>',
  '                                  <span className="font-mono text-zinc-400">{ing.qtyPerBatch * d.qty}{ing.unit}</span>',
  '                                </div>',
  '                              ))}',
  '                              {recipe.ingredients.length === 0 && (',
  '                                <span className="text-[12px] text-zinc-500">No ingredients listed</span>',
  '                              )}',
  '                            </div>',
  '                          </div>',
  '',
  '                          {/* Actions */}',
  '                          <div className="flex gap-2">',
  '                            <button',
  '                              onClick={() => setViewingDOSRecipe({ recipe, totalQty: d.qty })}',
  '                              className="rounded-xl border border-zinc-600 px-3 py-2 text-[12px] font-medium text-zinc-300 hover:bg-zinc-800 transition-all"',
  '                            >',
  '                              View Recipe',
  '                            </button>',
  '                            <button',
  '                              onClick={() => {',
  '                                setActivePreparation({ dos: d, recipe, route: "baker" });',
  '                                setAdditionalIngredients([]);',
  '                                setActualOutput("");',
  '                              }}',
  '                              className="rounded-xl bg-amber-600 px-4 py-2 text-[12px] font-medium text-white hover:bg-amber-700 transition-all"',
  '                            >',
  '                              Start Pre-Mix',
  '                            </button>',
  '                          </div>',
  '                        </div>',
  '                      );',
  '                    })}',
  '                  </div>',
  '                </div>',
  '              )}',
  '',
  '              {/* Deco Section */}',
  '              {decoTasks.length > 0 && (',
  '                <div>',
  '                  <h2 className="text-[16px] font-semibold text-white mb-3 flex items-center gap-2">',
  '                    <span>🎂</span> For Decoration',
  '                  </h2>',
  '                  <div className="space-y-3">',
  '                    {decoTasks.map(d => {',
  '                      const recipe = getRecipeForProduct(d.product);',
  '                      if (!recipe) return null;',
  '                      const yieldPerBatch = recipe.yield || 1;',
  '                      const estProdTotal = yieldPerBatch * d.qty;',
  '                      return (',
  '                        <div key={d.id} className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">',
  '                          <div className="flex items-start justify-between mb-3">',
  '                            <div>',
  '                              <h3 className="text-[17px] font-semibold text-white">{d.product}</h3>',
  '                              <div className="flex items-center gap-3 mt-1 text-[13px] text-zinc-400">',
  '                                <span>Demand: <span className="font-mono font-semibold text-zinc-200">{d.qty} pcs</span></span>',
  '                                <span>Yield/Batch: <span className="font-mono font-semibold text-zinc-200">{yieldPerBatch} pcs</span></span>',
  '                                <span>Expected: <span className="font-mono font-semibold text-emerald-300">{estProdTotal} pcs</span></span>',
  '                              </div>',
  '                            </div>',
  '                          </div>',
  '',
  '                          {/* Ingredients Needed */}',
  '                          <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 p-3 mb-3">',
  '                            <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium mb-2">Ingredients Needed</div>',
  '                            <div className="space-y-1.5">',
  '                              {recipe.ingredients.map((ing, i) => (',
  '                                <div key={i} className="flex items-center justify-between text-[13px]">',
  '                                  <span className="text-zinc-300">{ing.name}</span>',
  '                                  <span className="font-mono text-zinc-400">{ing.qtyPerBatch * d.qty}{ing.unit}</span>',
  '                                </div>',
  '                              ))}',
  '                              {recipe.ingredients.length === 0 && (',
  '                                <span className="text-[12px] text-zinc-500">No ingredients listed</span>',
  '                              )}',
  '                            </div>',
  '                          </div>',
  '',
  '                          {/* Actions */}',
  '                          <div className="flex gap-2">',
  '                            <button',
  '                              onClick={() => setViewingDOSRecipe({ recipe, totalQty: d.qty })}',
  '                              className="rounded-xl border border-zinc-600 px-3 py-2 text-[12px] font-medium text-zinc-300 hover:bg-zinc-800 transition-all"',
  '                            >',
  '                              View Recipe',
  '                            </button>',
  '                            <button',
  '                              onClick={() => {',
  '                                setActivePreparation({ dos: d, recipe, route: "deco" });',
  '                                setAdditionalIngredients([]);',
  '                                setActualOutput("");',
  '                              }}',
  '                              className="rounded-xl bg-rose-600 px-4 py-2 text-[12px] font-medium text-white hover:bg-rose-700 transition-all"',
  '                            >',
  '                              Start Preparation',
  '                            </button>',
  '                          </div>',
  '                        </div>',
  '                      );',
  '                    })}',
  '                  </div>',
  '                </div>',
  '              )}',
  '            </>',
  '          )}',
  '',
  '          {/* Workflow Nav */}',
  '          <div className="flex items-center justify-between pt-4 border-t border-zinc-700">',
  '            <div className="text-[12px] text-zinc-500">Step 1 of 5</div>',
  '            <button',
  '              onClick={() => setActiveTab("production-plan")}',
  '              className="rounded-xl bg-zinc-800 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-700 transition-all"',
  '            >',
  '              Next: Production Plan →',
  '            </button>',
  '          </div>',
  '        </div>',
  '      );',
  '    }',
  '',
  '    // Preparation View',
  '    const { dos, recipe, route } = activePreparation;',
  '    const yieldPerBatch = recipe.yield || 1;',
  '    const expectedOutput = yieldPerBatch * dos.qty;',
  '    const routeLabel = route === "baker" ? "Baker" : "Decoration Inventory";',
  '    const prepKey = `${dos.id}-${dos.product.toLowerCase()}`;',
  '    const savedAddIngs = productAdditionalIngredients[prepKey] || [];',
  '',
  '    const handleComplete = () => {',
  '      const output = actualOutput === "" ? expectedOutput : Number(actualOutput);',
  '      const finalAddIngs = [...additionalIngredients];',
  '',
  '      // Save to productAdditionalIngredients state',
  '      setProductAdditionalIngredients(prev => ({',
  '        ...prev,',
  '        [prepKey]: finalAddIngs,',
  '      }));',
  '',
  '      // Deduct standard ingredients from inventory',
  '      const newInv = [...inventory];',
  '      const deductions: string[] = [];',
  '      const skipped: string[] = [];',
  '',
  '      const findInventoryMatch = (ingredient: { name: string; inventoryId?: string; sku?: string }): InventoryItem | undefined => {',
  '        if (ingredient.inventoryId) {',
  '          const direct = newInv.find(i => i.id === ingredient.inventoryId);',
  '          if (direct) return direct;',
  '        }',
  '        const ingLower = ingredient.name.toLowerCase().trim();',
  '        let match = newInv.find(i => i.name.toLowerCase().trim() === ingLower);',
  '        if (match) return match;',
  '        match = newInv.find(i => i.name.toLowerCase().includes(ingLower) || ingLower.includes(i.name.toLowerCase()));',
  '        if (match) return match;',
  '        if (ingredient.sku) match = newInv.find(i => i.sku === ingredient.sku);',
  '        return match;',
  '      };',
  '',
  '      // Deduct recipe ingredients',
  '      recipe.ingredients.forEach(ing => {',
  '        const match = findInventoryMatch(ing);',
  '        if (!match) {',
  '          skipped.push(ing.name);',
  '          return;',
  '        }',
  '        const idx = newInv.findIndex(i => i.id === match.id);',
  '        const needed = ing.qtyPerBatch * dos.qty;',
  '        const before = newInv[idx].onHand;',
  '        newInv[idx] = { ...newInv[idx], onHand: Math.max(0, before - needed) };',
  '        const actualDeducted = before - newInv[idx].onHand;',
  '        deductions.push(ing.name);',
  '      });',
  '',
  '      // Deduct additional ingredients',
  '      additionalIngredients.forEach(addIng => {',
  '        const match = findInventoryMatch({ name: addIng.name });',
  '        if (match) {',
  '          const idx = newInv.findIndex(i => i.id === match.id);',
  '          const before = newInv[idx].onHand;',
  '          newInv[idx] = { ...newInv[idx], onHand: Math.max(0, before - addIng.qty) };',
  '        }',
  '      });',
  '',
  '      // Save to inventory',
  '      onUpdateInventory(newInv);',
  '      const changedItems = newInv.filter((item, i) => {',
  '        const orig = inventory[i];',
  '        return orig && Math.abs(orig.onHand - item.onHand) > 0.0001;',
  '      });',
  '      if (changedItems.length > 0) db.upsertInventory(changedItems).catch(console.error);',
  '',
  '      // Route-specific actions',
  '      if (route === "baker") {',
  '        // Save to Freezer as Production Recipe',
  '        const freezerItem: FreezerItem = {',
  '          id: `FRZ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,',
  '          productName: dos.product,',
  '          batchRef: `DEC-${Date.now()}`,',
  '          qty: output,',
  '          unit: "pcs",',
  '          status: "stored",',
  '          producedBy: "deco",',
  '          dateProduced: new Date().toISOString(),',
  '          notes: "Production Recipe",',
  '        };',
  '        onUpdateFreezer?.(prev => [...prev, freezerItem]);',
  '        db.upsertFreezerItems([freezerItem]).catch(console.error);',
  '        onAddAuditLog?.("TASK_COMPLETED_Baker", `${dos.product} x${output} > Baker`);',
  '        const extraDetails = finalAddIngs.map(a => `${a.name} ${a.qty}${a.unit} (${a.reason})`).join(", ");',
  '        showToast(`${dos.product} sent to Baker. Ingredients deducted.${extraDetails ? " Extra: " + extraDetails : ""}`);',
  '      } else {',
  '        // Save to My Inventory as production-prep item',
  '        const existingItem = newInv.find(i => i.name === dos.product && i.accessRoles?.includes("deco") && i.source === "production-prep");',
  '        if (existingItem) {',
  '          const updated = { ...existingItem, onHand: existingItem.onHand + output };',
  '          const idx = newInv.findIndex(i => i.id === existingItem.id);',
  '          newInv[idx] = updated;',
  '          db.upsertInventory([updated]).catch(console.error);',
  '        } else {',
  '          const newItem: InventoryItem = {',
  '            id: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,',
  '            name: dos.product,',
  '            sku: `DECO-${dos.product.substring(0, 8).toUpperCase()}-${Date.now()}`,',
  '            unit: "pcs",',
  '            onHand: output,',
  '            threshold: 0,',
  '            cost: 0,',
  '            supplier: "",',
  '            lastIn: new Date().toISOString(),',
  '            category: "dry",',
  '            group: "ingredients",',
  '            accessRoles: ["deco"] as Role[],',
  '            source: "production-prep",',
  '          };',
  '          onUpdateInventory((prev: InventoryItem[]) => [...prev, newItem]);',
  '          db.upsertInventory([newItem]).catch(console.error);',
  '        }',
  '        onAddAuditLog?.("TASK_COMPLETED_Deco", `${dos.product} x${output} > Decoration Inventory`);',
  '        const extraDetails = finalAddIngs.map(a => `${a.name} ${a.qty}${a.unit} (${a.reason})`).join(", ");',
  '        showToast(`${dos.product} moved to Decoration Inventory. Ingredients deducted.${extraDetails ? " Extra: " + extraDetails : ""}`);',
  '      }',
  '',
  '      // Close preparation view',
  '      setActivePreparation(null);',
  '    };',
  '',
  '    return (',
  '      <div className="max-w-5xl mx-auto space-y-6">',
  '        {/* Toast Notification */}',
  '        {toast && (',
  '          <div style={{ position: "fixed", top: 20, right: 20, zIndex: 100, display: "flex", alignItems: "center", gap: 12, borderRadius: 12, padding: "14px 20px", boxShadow: "0 8px 30px rgba(0,0,0,0.2)", background: toast.type === "success" ? "#059669" : "#dc2626", color: "#fff" }}>',
  '            <span style={{ fontSize: 18 }}>{toast.type === "success" ? "\\u2713" : "\\u2717"}</span>',
  '            <span style={{ fontSize: 13, fontWeight: 500 }}>{toast.message}</span>',
  '            <button onClick={() => setToast(null)} style={{ marginLeft: 8, color: "rgba(255,255,255,0.7)", background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>x</button>',
  '          </div>',
  '        )}',
  '',
  '        {/* Back button */}',
  '        <button',
  '          onClick={() => setActivePreparation(null)}',
  '          className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-zinc-300 hover:bg-zinc-800 transition-all"',
  '        >',
  '          <span className="text-[14px]">←</span> Back to Tasks',
  '        </button>',
  '',
  '        {/* Product Header */}',
  '        <div>',
  '          <h1 className="text-[24px] font-semibold text-white">{dos.product}</h1>',
  '          <p className="text-[13px] text-zinc-400 mt-1">Route: {route === "baker" ? "Bakery" : "Decoration"}</p>',
  '        </div>',
  '',
  '        {/* Standard Ingredients */}',
  '        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">',
  '          <h3 className="text-[14px] font-bold text-zinc-200 mb-4 flex items-center gap-2">',
  '            <span className="w-2 h-2 rounded-full bg-zinc-400"></span>',
  '            Standard Ingredients',
  '          </h3>',
  '          <div className="space-y-2">',
  '            {recipe.ingredients.map((ing, i) => (',
  '              <div key={i} className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2">',
  '                <span className="text-[13px] text-zinc-300 font-medium">{ing.name}</span>',
  '                <span className="font-mono text-[13px] text-zinc-400">{ing.qtyPerBatch * dos.qty}{ing.unit}</span>',
  '              </div>',
  '            ))}',
  '            {recipe.ingredients.length === 0 && (',
  '              <p className="text-[13px] text-zinc-500">No standard ingredients in recipe.</p>',
  '            )}',
  '          </div>',
  '        </div>',
  '',
  '        {/* Additional Ingredients Used */}',
  '        <div className="rounded-2xl border border-amber-700 bg-amber-950/40 p-5">',
  '          <h3 className="text-[14px] font-bold text-amber-200 mb-4 flex items-center gap-2">',
  '            <span className="w-2 h-2 rounded-full bg-amber-400"></span>',
  '            Additional Ingredients Used',
  '          </h3>',
  '          {savedAddIngs.length > 0 && (',
  '            <div className="space-y-1.5 mb-3">',
  '              {savedAddIngs.map((a, i) => (',
  '                <div key={i} className="flex items-center justify-between rounded-lg bg-amber-900/20 border border-amber-800/30 px-3 py-2">',
  '                  <div className="flex items-center gap-2">',
  '                    <span className="text-[13px] font-medium text-zinc-200">{a.name}</span>',
  '                    <span className="text-[11px] text-amber-400/60">{a.reason}</span>',
  '                  </div>',
  '                  <span className="font-mono text-[13px] text-amber-200">{a.qty}{a.unit}</span>',
  '                </div>',
  '              ))}',
  '            </div>',
  '          )}',
  '          {additionalIngredients.length > 0 && (',
  '            <div className="space-y-1.5 mb-3">',
  '              {additionalIngredients.map((a, i) => (',
  '                <div key={i} className="flex items-center justify-between rounded-lg bg-amber-900/20 border border-amber-800/30 px-3 py-2">',
  '                  <div className="flex items-center gap-2">',
  '                    <span className="text-[13px] font-medium text-zinc-200">{a.name}</span>',
  '                    <span className="text-[11px] text-amber-400/60">{a.reason}</span>',
  '                  </div>',
  '                  <span className="font-mono text-[13px] text-amber-200">{a.qty}{a.unit}</span>',
  '                </div>',
  '              ))}',
  '            </div>',
  '          )}',
  '',
  '          {/* Add New Additional Ingredient */}',
  '          {showAddIngredientModal && (',
  '            <div className="rounded-lg bg-amber-900/30 border border-amber-700/50 p-3 mb-3 space-y-2">',
  '              <div className="grid grid-cols-2 gap-2">',
  '                <input',
  '                  value={newAddIngredient.name}',
  '                  onChange={e => setNewAddIngredient(prev => ({ ...prev, name: e.target.value }))}',
  '                  placeholder="Ingredient name"',
  '                  className="rounded-md bg-zinc-900 border border-zinc-700 px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-amber-500"',
  '                />',
  '                <div className="flex gap-1">',
  '                  <input',
  '                    type="number"',
  '                    min={0}',
  '                    value={newAddIngredient.qty || ""}',
  '                    onChange={e => setNewAddIngredient(prev => ({ ...prev, qty: Math.max(0, Number(e.target.value)) }))}',
  '                    placeholder="Qty"',
  '                    className="flex-1 rounded-md bg-zinc-900 border border-zinc-700 px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-amber-500"',
  '                  />',
  '                  <input',
  '                    value={newAddIngredient.unit}',
  '                    onChange={e => setNewAddIngredient(prev => ({ ...prev, unit: e.target.value }))}',
  '                    placeholder="Unit"',
  '                    className="w-16 rounded-md bg-zinc-900 border border-zinc-700 px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-amber-500"',
  '                  />',
  '                </div>',
  '              </div>',
  '              <input',
  '                value={newAddIngredient.reason}',
  '                onChange={e => setNewAddIngredient(prev => ({ ...prev, reason: e.target.value }))}',
  '                placeholder="Reason (e.g. Dropped while preparing dough)"',
  '                className="w-full rounded-md bg-zinc-900 border border-zinc-700 px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-amber-500"',
  '              />',
  '              <div className="flex gap-2">',
  '                <button',
  '                  onClick={() => {',
  '                    if (!newAddIngredient.name || newAddIngredient.qty <= 0) return;',
  '                    setAdditionalIngredients(prev => [...prev, { ...newAddIngredient }]);',
  '                    setNewAddIngredient({ name: "", qty: 0, unit: "", reason: "" });',
  '                    setShowAddIngredientModal(false);',
  '                  }}',
  '                  className="flex-1 rounded-md bg-amber-600 py-1.5 text-[11px] font-medium text-white hover:bg-amber-700 transition-all"',
  '                >',
  '                  Add',
  '                </button>',
  '                <button',
  '                  onClick={() => setShowAddIngredientModal(false)}',
  '                  className="rounded-md bg-zinc-800 px-3 py-1.5 text-[11px] font-medium text-zinc-400 hover:bg-zinc-700"',
  '                >',
  '                  Cancel',
  '                </button>',
  '              </div>',
  '            </div>',
  '          )}',
  '          {!showAddIngredientModal && (',
  '            <button',
  '              onClick={() => setShowAddIngredientModal(true)}',
  '              className="flex items-center gap-1.5 rounded-lg border border-dashed border-amber-700/50 px-3 py-2 text-[12px] font-medium text-amber-400 hover:bg-amber-900/20 transition-all w-full justify-center"',
  '            >',
  '              + Add Additional Ingredient',
  '            </button>',
  '          )}',
  '        </div>',
  '',
  '        {/* Production Result */}',
  '        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">',
  '          <h3 className="text-[14px] font-bold text-zinc-200 mb-4 flex items-center gap-2">',
  '            <span className="w-2 h-2 rounded-full bg-zinc-400"></span>',
  '            Production Result',
  '          </h3>',
  '          <div className="grid grid-cols-2 gap-4">',
  '            <div className="rounded-lg bg-zinc-800/50 p-3">',
  '              <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Expected Production</div>',
  '              <div className="text-[20px] font-bold text-emerald-300 mt-1">{expectedOutput}</div>',
  '            </div>',
  '            <div className="rounded-lg bg-zinc-800/50 p-3">',
  '              <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Actual Production</div>',
  '              <div className="mt-1">',
  '                <input',
  '                  type="number"',
  '                  min={0}',
  '                  value={actualOutput}',
  '                  onChange={e => setActualOutput(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}',
  '                  placeholder={String(expectedOutput)}',
  '                  className="w-full rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-[16px] font-bold font-mono text-white outline-none focus:border-emerald-500"',
  '                />',
  '              </div>',
  '            </div>',
  '          </div>',
  '        </div>',
  '',
  '        {/* Complete Task Button */}',
  '        <div className="flex items-center justify-between pt-4 border-t border-zinc-700">',
  '          <div className="text-[12px] text-zinc-500">Complete Task</div>',
  '          <button',
  '            onClick={handleComplete}',
  '            className="rounded-xl bg-emerald-600 px-6 py-2.5 text-[13px] font-medium text-white hover:bg-emerald-700 transition-all"',
  '          >',
  '            {route === "baker" ? "Save & Send to Baker" : "Move to Decoration Inventory"}',
  '          </button>',
  '        </div>',
  '      </div>',
  '    );',
  '  }'
].join("\n");

content = content.replace(dashSectionToReplace, newDashSection);
console.log("✅ Change 7: Replaced Dashboard tab with Tasks to Prepare Today view");

// Write file
fs.writeFileSync(filePath, content, "utf8");
console.log("\n✅ All changes applied successfully!");

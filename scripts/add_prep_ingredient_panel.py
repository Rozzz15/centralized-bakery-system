import re

path = r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# === 1. Add new state variables after freeMixDone ===
old_state = "  const [freeMixDone, setFreeMixDone] = useState<Set<string>>(new Set());"
new_state = """  const [freeMixDone, setFreeMixDone] = useState<Set<string>>(new Set());
  const [prepIngredientOpen, setPrepIngredientOpen] = useState<Set<string>>(new Set());
  const [prepIngredientQty, setPrepIngredientQty] = useState<Record<string, Record<string, number>>>({});"""

if old_state in content:
    content = content.replace(old_state, new_state)
    print("✓ Added prep ingredient state variables")
else:
    print("✗ Could not find freeMixDone state declaration")
    # Fallback: try with different whitespace
    import sys
    sys.exit(1)

# === 2. Add handleSavePrepToFreezer handler after handleCompleteMix ===
old_handler_end = "  const openMatForm = () => {"
new_handler = """  const handleSavePrepToFreezer = async (product: string, dos: DOSItem) => {
    const qtyMap = prepIngredientQty[product];
    if (!qtyMap || Object.keys(qtyMap).length === 0) return;

    const productRecipes = getRecipesForProduct(product);
    let newInv = [...inventory];
    const deductions: string[] = [];

    productRecipes.forEach(r => {
      r.ingredients.forEach(ing => {
        const key = ing.inventoryId || ing.name;
        const usedQty = qtyMap[key];
        if (usedQty && usedQty > 0) {
          const idx = newInv.findIndex(i => i.id === ing.inventoryId);
          if (idx >= 0) {
            newInv[idx] = { ...newInv[idx], onHand: Math.max(0, newInv[idx].onHand - usedQty) };
            if (!deductions.includes(ing.name)) deductions.push(`${ing.name}×${usedQty}${ing.unit}`);
          }
        }
      });
    });

    const freezerItem: FreezerItem = {
      id: `FRZ-${Date.now()}-${product.replace(/\\s+/g, '-')}`,
      productName: product,
      qty: dos.qty,
      unit: "pcs",
      batchRef: `PREP-${Date.now()}`,
      producedBy: "deco",
      dateProduced: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0],
      status: "stored" as const,
      notes: "",
    };

    onUpdateInventory(newInv);
    await db.upsertInventory(newInv).catch(console.error);
    onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, freezerItem]);
    db.upsertFreezerItems([freezerItem]).catch(console.error);
    onAddAuditLog?.("PREP_SAVED_TO_FREEZER", `${product}: ${deductions.join(", ")}`);

    setFreeMixDone(prev => new Set(prev).add(product));
    setPrepIngredientOpen(prev => { const n = new Set(prev); n.delete(product); return n; });
    setPrepIngredientQty(prev => { const n = { ...prev }; delete n[product]; return n; });
  };

  const openMatForm = () => {"""

if old_handler_end in content:
    content = content.replace(old_handler_end, new_handler)
    print("✓ Added handleSavePrepToFreezer handler")
else:
    print("✗ Could not find openMatForm handler")
    import sys
    sys.exit(1)

# === 3. Replace the Actions section to use ingredient panel flow ===
old_actions = """                  {/* Actions */}
                  <div className="flex justify-center mt-4 pt-4 border-t border-zinc-100">
                    <button
                      onClick={() => {
                        if (isPrepped) {
                          setFreeMixDone(prev => { const n = new Set(prev); n.delete(d.product); return n; });
                        } else {
                          setFreeMixDone(prev => new Set(prev).add(d.product));
                        }
                      }}
                      className={`rounded-xl px-6 py-3 text-[14px] font-bold transition-all ${
                        isPrepped
                          ? "border-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-2 border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 hover:shadow-sm"
                      }`}
                    >
                      {isPrepped ? "Mark as Not Ready" : "Mark as Prepared"}
                    </button>
                  </div>"""

new_actions = """                  {/* Ingredient Usage Panel */}
                  {prepIngredientOpen.has(d.product) && (() => {
                    const productRecipes = getRecipesForProduct(d.product);
                    const allIngredients = productRecipes.reduce<{ inventoryId: string; name: string; baseQty: number; unit: string }[]>((acc, r) => {
                      r.ingredients.forEach(ing => {
                        if (!acc.find(a => a.inventoryId === ing.inventoryId || a.name === ing.name)) {
                          acc.push({ inventoryId: ing.inventoryId, name: ing.name, baseQty: Math.ceil(ing.qtyPerBatch * (d.qty / 100)), unit: ing.unit });
                        }
                      });
                      return acc;
                    }, []);
                    const productQtyMap = prepIngredientQty[d.product] || {};
                    // Initialize defaults for any missing ingredients
                    allIngredients.forEach(ing => {
                      const key = ing.inventoryId || ing.name;
                      if (!(key in productQtyMap)) {
                        productQtyMap[key] = ing.baseQty;
                      }
                    });
                    // Sync to state on first render
                    if (Object.keys(productQtyMap).length > 0 && !prepIngredientQty[d.product]) {
                      setTimeout(() => {
                        setPrepIngredientQty(prev => ({ ...prev, [d.product]: { ...productQtyMap } }));
                      }, 0);
                    }
                    return (
                      <div className="mt-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/30 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[15px]">📋</span>
                          <h4 className="text-[14px] font-bold text-zinc-800">Ingredient Usage — {d.product}</h4>
                          <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            {allIngredients.length} ingredient{allIngredients.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {allIngredients.map(ing => {
                            const key = ing.inventoryId || ing.name;
                            const invItem = decoInventory.find(i => i.id === ing.inventoryId);
                            return (
                              <div key={key} className="flex items-center gap-3 rounded-lg bg-white border border-emerald-100 px-3.5 py-2.5 hover:border-emerald-200 transition-all">
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-medium text-zinc-800 truncate">{ing.name}</div>
                                  <div className="text-[10px] text-zinc-400 font-mono">Expected: {ing.baseQty}{ing.unit}</div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      const key = ing.inventoryId || ing.name;
                                      setPrepIngredientQty(prev => {
                                        const product = prev[d.product] ? { ...prev[d.product] } : {};
                                        product[key] = Math.max(0, (product[key] || ing.baseQty) - 1);
                                        return { ...prev, [d.product]: product };
                                      });
                                    }}
                                    className="grid h-7 w-7 place-items-center rounded-lg border border-zinc-200 bg-white text-[13px] text-zinc-500 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 transition-all"
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    value={productQtyMap[key] ?? ing.baseQty}
                                    onChange={e => {
                                      const key = ing.inventoryId || ing.name;
                                      const val = Math.max(0, Number(e.target.value) || 0);
                                      setPrepIngredientQty(prev => {
                                        const product = prev[d.product] ? { ...prev[d.product] } : {};
                                        product[key] = val;
                                        return { ...prev, [d.product]: product };
                                      });
                                    }}
                                    className="w-14 text-center rounded-lg border border-zinc-200 bg-white px-1.5 py-1 text-[13px] font-mono font-semibold text-zinc-800 outline-none focus:border-emerald-400"
                                  />
                                  <button
                                    onClick={() => {
                                      const key = ing.inventoryId || ing.name;
                                      setPrepIngredientQty(prev => {
                                        const product = prev[d.product] ? { ...prev[d.product] } : {};
                                        product[key] = (product[key] || ing.baseQty) + 1;
                                        return { ...prev, [d.product]: product };
                                      });
                                    }}
                                    className="grid h-7 w-7 place-items-center rounded-lg border border-zinc-200 bg-white text-[13px] text-zinc-500 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 transition-all"
                                  >
                                    +
                                  </button>
                                  <span className={`ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                    invItem && invItem.onHand >= (productQtyMap[key] ?? ing.baseQty)
                                      ? "bg-emerald-50 text-emerald-600"
                                      : "bg-red-50 text-red-500"
                                  }`}>
                                    {invItem ? `${invItem.onHand}` : "—"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => handleSavePrepToFreezer(d.product, d)}
                          disabled={isPrepped}
                          className={`mt-4 w-full rounded-xl py-3 text-[14px] font-bold transition-all flex items-center justify-center gap-2 ${
                            isPrepped
                              ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                              : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] shadow-sm"
                          }`}
                        >
                          <span>❄️</span>
                          Save Ingredients to Freezer
                        </button>
                      </div>
                    );
                  })()}

                  {/* Actions */}
                  <div className="flex justify-center mt-4 pt-4 border-t border-zinc-100">
                    <button
                      onClick={() => {
                        if (isPrepped) {
                          setFreeMixDone(prev => { const n = new Set(prev); n.delete(d.product); return n; });
                          setPrepIngredientOpen(prev => { const n = new Set(prev); n.delete(d.product); return n; });
                        } else {
                          setPrepIngredientOpen(prev => new Set(prev).add(d.product));
                        }
                      }}
                      className={`rounded-xl px-6 py-3 text-[14px] font-bold transition-all ${
                        isPrepped
                          ? "border-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-2 border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 hover:shadow-sm"
                      }`}
                    >
                      {isPrepped ? "Mark as Not Ready" : "Mark as Prepared"}
                    </button>
                  </div>"""

if old_actions in content:
    content = content.replace(old_actions, new_actions)
    print("✓ Replaced actions section with ingredient panel flow")
else:
    print("✗ Could not find the actions section")
    # Debug: find similar text
    idx = content.find("Mark as Prepared")
    if idx >= 0:
        print(f"  Found 'Mark as Prepared' at index {idx}")
        print(f"  Context: ...{content[idx-50:idx+50]}...")
    import sys
    sys.exit(1)

# === 4. Write back ===
with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("\n✓ All changes applied successfully!")

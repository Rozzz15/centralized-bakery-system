import re

with open("src/components/DecoDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add prepIngredientDone state after prepIngredientQty
old_state = "const [prepIngredientQty, setPrepIngredientQty] = useState<Record<string, Record<string, number>>>({});"
new_state = """const [prepIngredientQty, setPrepIngredientQty] = useState<Record<string, Record<string, number>>>({});
  const [prepIngredientDone, setPrepIngredientDone] = useState<Set<string>>(new Set());"""

count = content.count(old_state)
if count == 0:
    print("ERROR: Could not find state declaration")
    exit(1)
content = content.replace(old_state, new_state, 1)
print(f"1. Added prepIngredientDone state: {count} match(es)")

# 2. Replace "Save Ingredients to Freezer" button with "Done" button in the ingredient panel
old_save_btn = """                        <button
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
                        </button>"""

new_done_btn = """                        <button
                          onClick={() => {
                            setPrepIngredientDone(prev => new Set(prev).add(d.product));
                            setPrepIngredientOpen(prev => { const n = new Set(prev); n.delete(d.product); return n; });
                          }}
                          className="mt-4 w-full rounded-xl py-3 text-[14px] font-bold transition-all flex items-center justify-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] shadow-sm"
                        >
                          <span>✓</span>
                          Done
                        </button>"""

count = content.count(old_save_btn)
if count == 0:
    print("ERROR: Could not find Save to Freezer button")
    exit(1)
content = content.replace(old_save_btn, new_done_btn, 1)
print(f"2. Replaced Save to Freezer with Done button: {count} match(es)")

# 3. Replace the actions section
old_actions = """                  {/* Actions */}
                  <div className="flex justify-center mt-4 pt-4 border-t border-zinc-100">
                    <button
                      onClick={() => {
                        if (isPrepped) {
                          setFreeMixDone(prev => { const n = new Set(prev); n.delete(d.product); return n; });
                          setPrepIngredientOpen(prev => { const n = new Set(prev); n.delete(d.product); return n; });
                        } else {
                          // Check if the product has any ingredients across recipes
                          const productRecipesInit = getRecipesForProduct(d.product);
                          const hasIngredients = productRecipesInit.some(r => r.ingredients.length > 0);
                          if (hasIngredients) {
                            // Show ingredient usage panel
                            const initialQty: Record<string, number> = {};
                            productRecipesInit.forEach(r => {
                              r.ingredients.forEach(ing => {
                                const key = ing.inventoryId || ing.name;
                                if (!(key in initialQty)) {
                                  initialQty[key] = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
                                }
                              });
                            });
                            setPrepIngredientQty(prev => ({ ...prev, [d.product]: initialQty }));
                            setPrepIngredientOpen(prev => new Set(prev).add(d.product));
                          } else {
                            // No ingredients — mark as prepared directly (skips the panel)
                            setFreeMixDone(prev => new Set(prev).add(d.product));
                          }
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

new_actions = """                  {/* Actions — 3-state flow: Mark as Prepared -> Put on Freezer -> Mark as Not Ready */}
                  <div className="flex justify-center mt-4 pt-4 border-t border-zinc-100">
                    {(() => {
                      if (isPrepped) {
                        return (
                          <button
                            onClick={() => {
                              setFreeMixDone(prev => { const n = new Set(prev); n.delete(d.product); return n; });
                              setPrepIngredientDone(prev => { const n = new Set(prev); n.delete(d.product); return n; });
                            }}
                            className="rounded-xl px-6 py-3 text-[14px] font-bold transition-all border-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          >
                            Mark as Not Ready
                          </button>
                        );
                      } else if (prepIngredientDone.has(d.product)) {
                        return (
                          <button
                            onClick={() => handleSavePrepToFreezer(d.product, d)}
                            className="rounded-xl px-6 py-3 text-[14px] font-bold transition-all flex items-center justify-center gap-2 border-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-500 hover:shadow-sm"
                          >
                            <span>❄️</span>
                            Put on Freezer
                          </button>
                        );
                      } else if (!prepIngredientOpen.has(d.product)) {
                        return (
                          <button
                            onClick={() => {
                              const productRecipesInit = getRecipesForProduct(d.product);
                              const hasIngredients = productRecipesInit.some(r => r.ingredients.length > 0);
                              if (hasIngredients) {
                                const initialQty: Record<string, number> = {};
                                productRecipesInit.forEach(r => {
                                  r.ingredients.forEach(ing => {
                                    const key = ing.inventoryId || ing.name;
                                    if (!(key in initialQty)) {
                                      initialQty[key] = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
                                    }
                                  });
                                });
                                setPrepIngredientQty(prev => ({ ...prev, [d.product]: initialQty }));
                                setPrepIngredientOpen(prev => new Set(prev).add(d.product));
                              } else {
                                setFreeMixDone(prev => new Set(prev).add(d.product));
                                setPrepIngredientDone(prev => new Set(prev).add(d.product));
                              }
                            }}
                            className="rounded-xl px-6 py-3 text-[14px] font-bold transition-all border-2 border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 hover:shadow-sm"
                          >
                            Mark as Prepared
                          </button>
                        );
                      } else {
                        // Panel is open — show nothing (Done button is inside the panel)
                        return null;
                      }
                    })()}
                  </div>"""

count = content.count(old_actions)
if count == 0:
    print("ERROR: Could not find actions section")
    exit(1)
content = content.replace(old_actions, new_actions, 1)
print(f"3. Replaced actions section: {count} match(es)")

# 4. Update handleSavePrepToFreezer to also clear prepIngredientDone
old_handler = """    setFreeMixDone(prev => new Set(prev).add(product));
    setPrepIngredientOpen(prev => { const n = new Set(prev); n.delete(product); return n; });
    setPrepIngredientQty(prev => { const n = { ...prev }; delete n[product]; return n; });"""

new_handler = """    setFreeMixDone(prev => new Set(prev).add(product));
    setPrepIngredientOpen(prev => { const n = new Set(prev); n.delete(product); return n; });
    setPrepIngredientQty(prev => { const n = { ...prev }; delete n[product]; return n; });
    setPrepIngredientDone(prev => { const n = new Set(prev); n.delete(product); return n; });"""

count = content.count(old_handler)
if count == 0:
    print("ERROR: Could not find handler cleanup section")
    exit(1)
content = content.replace(old_handler, new_handler, 1)
print(f"4. Updated handleSavePrepToFreezer cleanup: {count} match(es)")

with open("src/components/DecoDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("\nAll changes applied successfully!")

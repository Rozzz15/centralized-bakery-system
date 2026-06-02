# Remove Recipe Formulas section from Deco Dashboard

import re

# --- App.tsx changes ---
with open("src/App.tsx", "r", encoding="utf-8") as f:
    app = f.read()

# 1. Remove "recipes" sidebar item from deco
old_sidebar = '''  deco: [
    { id: "dashboard", label: "Dashboard", icon: "◼" },
    { id: "recipes", label: "Recipe Formulas", icon: "◈" },
    { id: "adv-freemix", label: "Advanced Freemix", icon: "⬣" },'''
new_sidebar = '''  deco: [
    { id: "dashboard", label: "Dashboard", icon: "◼" },
    { id: "adv-freemix", label: "Advanced Freemix", icon: "⬣" },'''

if old_sidebar in app:
    app = app.replace(old_sidebar, new_sidebar)
    print("SUCCESS: Removed 'recipes' from deco sidebar")
else:
    print("WARN: Could not find deco sidebar items. Trying alternate...")
    # Try searching for the exact fragment
    idx = app.find('{ id: "recipes", label: "Recipe Formulas", icon: "◈" }')
    if idx >= 0:
        print(f"Found at index {idx}")
        # Show context
        print(repr(app[idx-60:idx+80]))

# 2. Remove "recipes" from deco tab whitelist
old_whitelist = '''{role === "deco" && ["dashboard", "recipes", "free-mix", "adv-freemix", "deco-queue", "custom-orders", "inventory", "freezer"].includes(activeTab) && ('''
new_whitelist = '''{role === "deco" && ["dashboard", "free-mix", "adv-freemix", "deco-queue", "custom-orders", "inventory", "freezer"].includes(activeTab) && ('''

if old_whitelist in app:
    app = app.replace(old_whitelist, new_whitelist)
    print("SUCCESS: Removed 'recipes' from deco tab whitelist")
else:
    print("WARN: Could not find deco tab whitelist")

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(app)

# --- DecoDashboard.tsx changes ---
with open("src/components/DecoDashboard.tsx", "r", encoding="utf-8") as f:
    deco = f.read()

# 3. Remove "recipes" from dashSubTab type union
old_dashsubtab = '''const [dashSubTab, setDashSubTab] = useState<"dos" | "recipes" | "prep" | "queue" | "orders">("dos");'''
new_dashsubtab = '''const [dashSubTab, setDashSubTab] = useState<"dos" | "prep" | "queue" | "orders">("dos");'''

if old_dashsubtab in deco:
    deco = deco.replace(old_dashsubtab, new_dashsubtab)
    print("SUCCESS: Removed 'recipes' from dashSubTab")
else:
    print("WARN: Could not find dashSubTab")

# 4. Remove "recipes" from workflowSteps
old_workflow = '''  const workflowSteps = [
    { id: "dashboard", label: "DOS Received" },
    { id: "recipes", label: "Recipe Formulas" },
    { id: "free-mix", label: "Production Prep" },'''
new_workflow = '''  const workflowSteps = [
    { id: "dashboard", label: "DOS Received" },
    { id: "free-mix", label: "Production Prep" },'''

if old_workflow in deco:
    deco = deco.replace(old_workflow, new_workflow)
    print("SUCCESS: Removed 'recipes' from workflowSteps")
else:
    print("WARN: Could not find workflowSteps")

# 5. Remove the entire 'if (activeTab === "recipes")' section
# We need to find the section from '/* ── Recipe Formulas ── */' to just before '/* ── Advanced Freemix ── */'
old_recipes_section = '''  /* ── Recipe Formulas ── */
  if (activeTab === "recipes") {
    const dosRecipeProducts = productCatalog.filter(product => {
      return dosForDeco.some(d => getRecipesForProduct(d.product).some(r => r.productName === product));
    });
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Recipe Formulas</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Product recipes needed for current DOS items. Direct and linked recipes are shown below.</p>
        </div>

        {editingRecipe && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={() => setEditingRecipe(null)}>
            <div className="w-full max-w-[520px] rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-[17px] font-semibold text-zinc-900">Recipe: {editingRecipe}</h3>
                  <p className="mt-0.5 text-[12px] text-zinc-500">Define ingredients and quantities per batch.</p>
                </div>
                <button onClick={() => setEditingRecipe(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700">✕</button>
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {recipeDraft.map((ing, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-zinc-100 p-2.5">
                    <div className="flex-1">
                      <input id={`recipe-ingredient-name-${i}`} name={`recipe-ingredient-name-${i}`} value={ing.name} onChange={e => updIngredient(i, "name", e.target.value)} placeholder="Ingredient name" list="ingredient-list" className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-zinc-400" />
                    </div>
                    <input id={`recipe-ingredient-qty-${i}`} name={`recipe-ingredient-qty-${i}`} type="number" min="0" step="0.01" value={ing.qtyPerBatch || ""} onChange={e => updIngredient(i, "qtyPerBatch", Number(e.target.value))} placeholder="Qty" className="w-16 rounded-lg border border-zinc-200 px-2 py-1.5 text-[13px] text-center outline-none focus:border-zinc-400 font-mono" />
                    <input id={`recipe-ingredient-unit-${i}`} name={`recipe-ingredient-unit-${i}`} value={ing.unit} onChange={e => updIngredient(i, "unit", e.target.value)} placeholder="Unit" className="w-16 rounded-lg border border-zinc-200 px-2 py-1.5 text-[13px] outline-none focus:border-zinc-400" />
                    <button onClick={() => delIngredient(i)} className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500">✕</button>
                  </div>
                ))}
              </div>
              <datalist id="ingredient-list">
                {allIngredients.map(i => <option key={i.id} value={i.name} />)}
              </datalist>
              <button onClick={addIngredient} className="mt-2 text-[12px] font-medium text-rose-600 hover:text-rose-700">+ Add Ingredient</button>
              <div className="mt-4 flex gap-2">
                <button onClick={() => setEditingRecipe(null)} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={handleSaveRecipe} className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800">Save Recipe</button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {dosRecipeProducts.map(product => {
            const recipe = recipes.find(r => r.productName === product);
            return (
              <div key={product} className="rounded-2xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[15px] font-bold text-zinc-900">{product}</h3>
                        </div>

                        {/* Composition tags */}
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {recipe && recipe.ingredients.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                              {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? "s" : ""}
                            </span>
                          )}
                          {recipe && recipe.packaging.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                              {recipe.packaging.length} pack
                            </span>
                          )}
                          {recipe && recipe.decoration.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                              {recipe.decoration.length} deco
                            </span>
                          )}
                          {recipe && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                              {recipe.ingredients.length + recipe.packaging.length + recipe.decoration.length} item{(recipe.ingredients.length + recipe.packaging.length + recipe.decoration.length) !== 1 ? "s" : ""}
                            </span>
                          )}
                          {!recipe && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">No Recipe</span>
                          )}
                        </div>

                        {recipe ? (
                          <div>
                            {/* Ingredient list inline */}
                            {recipe.ingredients.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-zinc-100">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Ingredients</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {recipe.ingredients.slice(0, 6).map((ing, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[10px]">
                                      <span className="text-zinc-700 font-medium">{ing.name}</span>
                                      <span className="text-rose-600 font-mono">{ing.qtyPerBatch}{ing.unit}</span>
                                    </span>
                                  ))}
                                  {recipe.ingredients.length > 6 && (
                                    <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">+{recipe.ingredients.length - 6} more</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Packaging inline */}
                            {recipe.packaging.length > 0 && (
                              <div className="mt-2">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Packaging</div>
                                <div className="flex flex-wrap gap-1">
                                  {recipe.packaging.map((mat, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-blue-200 px-1.5 py-0.5 text-[10px]">
                                      <span className="text-zinc-700 font-medium">{mat.name}</span>
                                      <span className="text-blue-600 font-mono">{mat.qtyPerBatch}{mat.unit}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Deco supplies inline */}
                            {recipe.decoration.length > 0 && (
                              <div className="mt-2">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Deco Supplies</div>
                                <div className="flex flex-wrap gap-1">
                                  {recipe.decoration.map((dec, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-purple-200 px-1.5 py-0.5 text-[10px]">
                                      <span className="text-zinc-700 font-medium">{dec.name}</span>
                                      <span className="text-purple-600 font-mono">{dec.qtyPerBatch}{dec.unit}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="mt-3 text-[12px] text-zinc-400 italic">Ingredient list and materials missing.</p>
                        )}
                        <button onClick={() => handleEditRecipe(product)} className="mt-3 w-full rounded-xl border border-zinc-200 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-all">
                          {recipe ? "Edit Formula" : "Set Formula"}
                        </button>
                      </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Advanced Freemix ── */'''

new_recipes_section = '''  /* ── Advanced Freemix ── */'''

if old_recipes_section in deco:
    deco = deco.replace(old_recipes_section, new_recipes_section)
    print("SUCCESS: Removed the entire Recipe Formulas section")
else:
    print("WARN: Could not find the Recipe Formulas section. Trying alternative approach...")
    # Find by markers
    start_marker = "  /* ── Recipe Formulas ── */"
    end_marker = "  /* ── Advanced Freemix ── */"
    start_idx = deco.find(start_marker)
    end_idx = deco.find(end_marker)
    if start_idx >= 0 and end_idx > start_idx:
        # Remove from start_marker to end_marker (exclusive of end_marker)
        deco = deco[:start_idx] + deco[end_idx:]
        print(f"SUCCESS: Removed Recipe Formulas section by markers (removed {end_idx - start_idx} chars)")
    else:
        print(f"WARN: Could not find markers. start={start_idx}, end={end_idx}")

with open("src/components/DecoDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(deco)

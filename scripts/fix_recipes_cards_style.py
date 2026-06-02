import re

with open("src/components/DecoDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the entire card rendering inside dosRecipeProducts.map
old_cards = '''              <div key={product} className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-bold text-zinc-900 truncate pr-2" title={product}>{product}</h3>
                  {recipe ? (
                    <span className="shrink-0 flex items-center gap-1 text-emerald-600 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Ready</span>
                  ) : (
                    <span className="shrink-0 flex items-center gap-1 text-rose-500 text-[10px] font-bold uppercase tracking-wider bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">No Recipe</span>
                  )}
                </div>
                {recipe ? (
                  <div className="space-y-3">
                    {recipe.ingredients.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {recipe.ingredients.map((ing, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 px-2 py-0.5 text-[11px]">
                            <span className="text-zinc-700 font-medium">{ing.name}</span>
                            <span className="text-rose-600 font-mono">{ing.qtyPerBatch}{ing.unit}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {recipe.packaging.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {recipe.packaging.map((mat, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px]">
                            <span className="text-zinc-700 font-medium">{mat.name}</span>
                            <span className="text-blue-600 font-mono">{mat.qtyPerBatch}{mat.unit}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {recipe.decoration.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {recipe.decoration.map((dec, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px]">
                            <span className="text-zinc-700 font-medium">{dec.name}</span>
                            <span className="text-purple-600 font-mono">{dec.qtyPerBatch}{dec.unit}</span>
                          </span>
                        ))}
                      </div>
                    )}

                  </div>
                ) : (
                  <p className="text-[12px] text-zinc-400 italic">Ingredient list and materials missing.</p>
                )}
                <button onClick={() => handleEditRecipe(product)} className="w-full rounded-xl border border-zinc-200 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-all">
                  {recipe ? "Edit Formula" : "Set Formula"}
                </button>
              </div>'''

new_cards = '''              <div key={product} className="rounded-2xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-sm">
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
                      </div>'''

if old_cards in content:
    content = content.replace(old_cards, new_cards)
    with open("src/components/DecoDashboard.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Replaced Recipe Formulas cards with Advanced Freemix style")
else:
    print("ERROR: Could not find the old_cards block. Trying fuzzy match...")
    # Find approximate location
    idx = content.find('dosRecipeProducts.map(product => {')
    if idx >= 0:
        print(f"Found 'dosRecipeProducts.map' at index {idx}")
        # Show the surrounding text
        start = max(0, idx - 50)
        portion = content[start:start + 50]
        print(f"Context: ...{portion}...")
    else:
        print("Could not find dosRecipeProducts.map either")

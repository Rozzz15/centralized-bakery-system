import re

with open("src/components/DecoDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the recipe formula cards section in Production Prep
# The old code renders primary recipe as a card with "Primary" badge
# The new code shows primary recipe content inline, linked recipes as cards

old = '''                  {/* Recipe formula cards */}
                  {productRecipes.length === 0 ? (
                    <div className=\"rounded-xl border border-dashed border-zinc-200 p-5 text-center\">
                      <p className=\"text-[13px] text-zinc-400 italic\">No recipe formulas set for this product.</p>
                      <p className=\"text-[11px] text-zinc-400 mt-1\">Ask Admin to set up recipes in Products tab.</p>
                    </div>
                  ) : (
                    <div className=\"grid grid-cols-1 sm:grid-cols-2 gap-3\">
                      {productRecipes.map(r => {
                        const totalItems = r.ingredients.length + r.packaging.length + r.decoration.length;
                        const isPrimary = r.productName === d.product;
                        return (
                          <div key={r.productName} className=\"rounded-2xl border-2 border-zinc-100 bg-white p-4\">
                            <div className=\"flex items-start justify-between gap-2\">
                              <h4 className=\"text-[15px] font-bold text-zinc-900\">{r.productName}</h4>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                isPrimary ? \"bg-rose-100 text-rose-700\" : \"bg-zinc-100 text-zinc-500\"
                              }`}>
                                {isPrimary ? \"Primary\" : \"Linked\"}
                              </span>
                            </div>

                            {/* Composition tags */}
                            <div className=\"flex flex-wrap gap-1.5 mt-3\">
                              {r.ingredients.length > 0 && (
                                <span className=\"inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700\">
                                  {r.ingredients.length} ingredient{r.ingredients.length !== 1 ? \"s\" : \"\"}
                                </span>
                              )}
                              {r.packaging.length > 0 && (
                                <span className=\"inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700\">
                                  {r.packaging.length} pack
                                </span>
                              )}
                              {r.decoration.length > 0 && (
                                <span className=\"inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700\">
                                  {r.decoration.length} deco
                                </span>
                              )}
                              <span className=\"inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600\">
                                {totalItems} item{totalItems !== 1 ? \"s\" : \"\"}
                              </span>
                            </div>

                            {/* Ingredients */}
                            {r.ingredients.length > 0 && (
                              <div className=\"mt-3 pt-3 border-t border-zinc-100\">
                                <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5\">Ingredients</div>
                                <div className=\"flex flex-wrap gap-1.5\">
                                  {r.ingredients.slice(0, 6).map((ing, i) => (
                                    <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[10px]\">
                                      <span className=\"text-zinc-700 font-medium\">{ing.name}</span>
                                      <span className=\"text-rose-600 font-mono\">{ing.qtyPerBatch}{ing.unit}</span>
                                    </span>
                                  ))}
                                  {r.ingredients.length > 6 && (
                                    <span className=\"inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500\">+{r.ingredients.length - 6} more</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Packaging */}
                            {r.packaging.length > 0 && (
                              <div className=\"mt-2\">
                                <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1\">Packaging</div>
                                <div className=\"flex flex-wrap gap-1\">
                                  {r.packaging.map((mat, i) => (
                                    <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-blue-200 px-1.5 py-0.5 text-[10px]\">
                                      <span className=\"text-zinc-700 font-medium\">{mat.name}</span>
                                      <span className=\"text-blue-600 font-mono\">{mat.qtyPerBatch}{mat.unit}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Deco supplies */}
                            {r.decoration.length > 0 && (
                              <div className=\"mt-2\">
                                <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1\">Deco Supplies</div>
                                <div className=\"flex flex-wrap gap-1\">
                                  {r.decoration.map((dec, i) => (
                                    <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-purple-200 px-1.5 py-0.5 text-[10px]\">
                                      <span className=\"text-zinc-700 font-medium\">{dec.name}</span>
                                      <span className=\"text-purple-600 font-mono\">{dec.qtyPerBatch}{dec.unit}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}'''

new = '''                  {/* Recipe formula cards */}
                  {productRecipes.length === 0 ? (
                    <div className=\"rounded-xl border border-dashed border-zinc-200 p-5 text-center\">
                      <p className=\"text-[13px] text-zinc-400 italic\">No recipe formulas set for this product.</p>
                      <p className=\"text-[11px] text-zinc-400 mt-1\">Ask Admin to set up recipes in Products tab.</p>
                    </div>
                  ) : (
                    <div className=\"space-y-3\">
                      {(() => {
                        const primary = productRecipes.find(r => r.productName === d.product);
                        const linked = productRecipes.filter(r => r.productName !== d.product);
                        return (
                          <>
                            {primary && (
                              <div className=\"rounded-xl border-2 border-rose-100 bg-rose-50/30 p-4\">
                                <div className=\"flex flex-wrap gap-1.5 mb-3\">
                                  {primary.ingredients.length > 0 && (
                                    <span className=\"inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700\">
                                      {primary.ingredients.length} ingredient{primary.ingredients.length !== 1 ? \"s\" : \"\"}
                                    </span>
                                  )}
                                  {primary.packaging.length > 0 && (
                                    <span className=\"inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700\">
                                      {primary.packaging.length} pack
                                    </span>
                                  )}
                                  {primary.decoration.length > 0 && (
                                    <span className=\"inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700\">
                                      {primary.decoration.length} deco
                                    </span>
                                  )}
                                  <span className=\"inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600\">
                                    {primary.ingredients.length + primary.packaging.length + primary.decoration.length} item{(primary.ingredients.length + primary.packaging.length + primary.decoration.length) !== 1 ? \"s\" : \"\"}
                                  </span>
                                </div>

                                {primary.ingredients.length > 0 && (
                                  <div className=\"mb-2\">
                                    <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5\">Ingredients</div>
                                    <div className=\"flex flex-wrap gap-1.5\">
                                      {primary.ingredients.slice(0, 6).map((ing, i) => (
                                        <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[10px]\">
                                          <span className=\"text-zinc-700 font-medium\">{ing.name}</span>
                                          <span className=\"text-rose-600 font-mono\">{ing.qtyPerBatch}{ing.unit}</span>
                                        </span>
                                      ))}
                                      {primary.ingredients.length > 6 && (
                                        <span className=\"inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500\">+{primary.ingredients.length - 6} more</span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {primary.packaging.length > 0 && (
                                  <div className=\"mb-2\">
                                    <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1\">Packaging</div>
                                    <div className=\"flex flex-wrap gap-1\">
                                      {primary.packaging.map((mat, i) => (
                                        <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-blue-200 px-1.5 py-0.5 text-[10px]\">
                                          <span className=\"text-zinc-700 font-medium\">{mat.name}</span>
                                          <span className=\"text-blue-600 font-mono\">{mat.qtyPerBatch}{mat.unit}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {primary.decoration.length > 0 && (
                                  <div>
                                    <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1\">Deco Supplies</div>
                                    <div className=\"flex flex-wrap gap-1\">
                                      {primary.decoration.map((dec, i) => (
                                        <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-purple-200 px-1.5 py-0.5 text-[10px]\">
                                          <span className=\"text-zinc-700 font-medium\">{dec.name}</span>
                                          <span className=\"text-purple-600 font-mono\">{dec.qtyPerBatch}{dec.unit}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {linked.length > 0 && (
                              <div className=\"grid grid-cols-1 sm:grid-cols-2 gap-3\">
                                {linked.map(r => {
                                  const totalItems = r.ingredients.length + r.packaging.length + r.decoration.length;
                                  return (
                                    <div key={r.productName} className=\"rounded-2xl border-2 border-zinc-100 bg-white p-4\">
                                      <div className=\"flex items-start justify-between gap-2\">
                                        <h4 className=\"text-[15px] font-bold text-zinc-900\">{r.productName}</h4>
                                        <span className=\"shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500\">
                                          Linked
                                        </span>
                                      </div>

                                      {/* Composition tags */}
                                      <div className=\"flex flex-wrap gap-1.5 mt-3\">
                                        {r.ingredients.length > 0 && (
                                          <span className=\"inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700\">
                                            {r.ingredients.length} ingredient{r.ingredients.length !== 1 ? \"s\" : \"\"}
                                          </span>
                                        )}
                                        {r.packaging.length > 0 && (
                                          <span className=\"inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700\">
                                            {r.packaging.length} pack
                                          </span>
                                        )}
                                        {r.decoration.length > 0 && (
                                          <span className=\"inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700\">
                                            {r.decoration.length} deco
                                          </span>
                                        )}
                                        <span className=\"inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600\">
                                          {totalItems} item{totalItems !== 1 ? \"s\" : \"\"}
                                        </span>
                                      </div>

                                      {/* Ingredients */}
                                      {r.ingredients.length > 0 && (
                                        <div className=\"mt-3 pt-3 border-t border-zinc-100\">
                                          <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5\">Ingredients</div>
                                          <div className=\"flex flex-wrap gap-1.5\">
                                            {r.ingredients.slice(0, 6).map((ing, i) => (
                                              <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[10px]\">
                                                <span className=\"text-zinc-700 font-medium\">{ing.name}</span>
                                                <span className=\"text-rose-600 font-mono\">{ing.qtyPerBatch}{ing.unit}</span>
                                              </span>
                                            ))}
                                            {r.ingredients.length > 6 && (
                                              <span className=\"inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500\">+{r.ingredients.length - 6} more</span>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Packaging */}
                                      {r.packaging.length > 0 && (
                                        <div className=\"mt-2\">
                                          <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1\">Packaging</div>
                                          <div className=\"flex flex-wrap gap-1\">
                                            {r.packaging.map((mat, i) => (
                                              <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-blue-200 px-1.5 py-0.5 text-[10px]\">
                                                <span className=\"text-zinc-700 font-medium\">{mat.name}</span>
                                                <span className=\"text-blue-600 font-mono\">{mat.qtyPerBatch}{mat.unit}</span>
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Deco supplies */}
                                      {r.decoration.length > 0 && (
                                        <div className=\"mt-2\">
                                          <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1\">Deco Supplies</div>
                                          <div className=\"flex flex-wrap gap-1\">
                                            {r.decoration.map((dec, i) => (
                                              <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-purple-200 px-1.5 py-0.5 text-[10px]\">
                                                <span className=\"text-zinc-700 font-medium\">{dec.name}</span>
                                                <span className=\"text-purple-600 font-mono\">{dec.qtyPerBatch}{dec.unit}</span>
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}'''

if old in content:
    content = content.replace(old, new, 1)
    with open("src/components/DecoDashboard.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Primary recipe content now shown inline, linked recipes as separate cards.")
else:
    print("ERROR: Could not find the old recipe cards section. Searching for partial match...")
    # Try to find a partial match to debug
    import re
    # Check if the comment marker exists
    if "Recipe formula cards" in content:
        print("  - Found 'Recipe formula cards' comment marker")
        # Show context around it
        idx = content.index("Recipe formula cards")
        print(content[idx:idx+300])
    else:
        print("  - Could not find 'Recipe formula cards' comment marker")

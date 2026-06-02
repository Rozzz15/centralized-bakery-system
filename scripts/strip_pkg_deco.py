import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

with open("src/components/DecoDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the expanded section to strip packaging/deco from the recipe cards
old = """                                    {/* Composition tags */}
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

                                    {/* Ingredient list inline */}
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

                                    {/* Packaging inline */}
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

                                    {/* Deco supplies inline */}
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
                                    )}"""

new = """                                    {/* Composition tags - recipe only */}
                                    <div className=\"flex flex-wrap gap-1.5 mt-3\">
                                      <span className=\"inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700\">
                                        {r.ingredients.length} ingredient{r.ingredients.length !== 1 ? \"s\" : \"\"}
                                      </span>
                                      {r.productName !== d.product && (
                                        <span className=\"inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600\">Linked Recipe</span>
                                      )}
                                    </div>

                                    {/* Ingredient list inline */}
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
                                    )}"""

if old in content:
    content = content.replace(old, new)
    print("OK - Stripped packaging/deco from expanded recipe cards")
else:
    print("FAIL - Could not find the exact expanded recipe card section")

with open("src/components/DecoDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("\nDone!")

import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = "C:/Users/Admin/Desktop/Businesses/CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM/src/components/DecoDashboard.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Old: the card wrapper with Primary/Linked badges, composition tags, and ingredient list
old = """                            {productRecipes.map(r => {
                                return (
                                  <div key={r.productName} className=\"rounded-2xl border-2 border-zinc-100 bg-white p-4 hover:border-zinc-300 hover:shadow-sm transition-all\">
                                    <div className=\"flex items-start justify-between gap-2\">
                                      <h3 className=\"text-[15px] font-bold text-zinc-900\">{r.productName}</h3>
                                      {r.productName === d.product ? (
                                        <span className=\"shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-700\">Primary</span>
                                      ) : (
                                        <span className=\"shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500\">Linked</span>
                                      )}
                                    </div>

                                    {/* Composition tags - recipe only */}
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
                                    )}
                                  </div>
                                );
                              })}"""

# New: just the ingredient pills grouped by recipe name, no cards/badges
new = """                            {productRecipes.map(r => (
                                <div key={r.productName}>
                                  <div className=\"text-[11px] font-medium text-zinc-500 mb-1\">{r.productName}</div>
                                  <div className=\"flex flex-wrap gap-1.5\">
                                    {r.ingredients.length > 0 ? (
                                      r.ingredients.slice(0, 8).map((ing, i) => (
                                        <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[10px]\">
                                          <span className=\"text-zinc-700 font-medium\">{ing.name}</span>
                                          <span className=\"text-rose-600 font-mono\">{ing.qtyPerBatch}{ing.unit}</span>
                                        </span>
                                      ))
                                    ) : (
                                      <span className=\"text-[11px] text-zinc-400 italic\">No ingredients set</span>
                                    )}
                                    {r.ingredients.length > 8 && (
                                      <span className=\"inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500\">+{r.ingredients.length - 8} more</span>
                                    )}
                                  </div>
                                </div>
                              ))}"""

if old in content:
    content = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Replaced expanded DOS cards with simple ingredient display")
else:
    print("❌ Could not find the old card structure")
    # Debug: show first 100 chars around "productRecipes.map" to understand format
    idx = content.find("productRecipes.map(r =>")
    if idx >= 0:
        print(f"  Found productRecipes.map at position {idx}")
        print(f"  Context: {content[idx:idx+300]}")
    else:
        print("  productRecipes.map not found")

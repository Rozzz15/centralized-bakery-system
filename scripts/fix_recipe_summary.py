# -*- coding: utf-8 -*-
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

path = r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# 1. Change totalNeeded to count recipe occurrences instead of ingredient lengths
old_total = """  const totalNeeded = dosForDeco.reduce((s, d) => {
    const productRecipes = getRecipesForProduct(d.product);
    return s + productRecipes.reduce((sum, r) => sum + r.ingredients.length, 0);
  }, 0);"""
new_total = """  const totalNeeded = dosForDeco.reduce((s, d) => {
    const productRecipes = getRecipesForProduct(d.product);
    return s + productRecipes.length;
  }, 0);
  // Group recipes by name with which products they're needed for
  const recipeSummary = dosForDeco.reduce((map, d) => {
    const productRecipes = getRecipesForProduct(d.product);
    productRecipes.forEach(r => {
      const entry = map.get(r.productName) || { count: 0, products: new Set<string>() };
      entry.count++;
      entry.products.add(d.product);
      map.set(r.productName, entry);
    });
    return map;
  }, new Map<string, { count: number; products: Set<string> }>());"""

if old_total in content:
    content = content.replace(old_total, new_total)
    changes += 1
    print("OK - Updated totalNeeded and added recipeSummary")
else:
    print("FAIL - Could not find old totalNeeded definition")

# 2. Replace the modal body to show grouped recipe summary for "ingredients" modal
# The current modal body shows recipe cards for all types. We need to:
# - Show grouped recipe summary when summaryModal === "ingredients"
# - Show recipe cards for all other types

old_modal_body = """              <div className=\"overflow-y-auto px-6 py-4 space-y-4\">
                {dosForDeco.map(d => {
                  const productRecipes = getRecipesForProduct(d.product);
                  const allEmpty = productRecipes.every(r => r.ingredients.length === 0 && r.packaging.length === 0 && r.decoration.length === 0);
                  if (allEmpty) return null;
                  return (
                    <div key={d.id} className=\"rounded-2xl border-2 border-zinc-100 bg-white p-4\">
                      <div className=\"flex items-start justify-between gap-2\">
                        <div className=\"flex items-center gap-2\">
                          <h3 className=\"text-[15px] font-bold text-zinc-900\">{d.product}</h3>
                          <span className=\"text-[12px] text-zinc-400 font-mono\">\u00d7{d.qty}</span>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${d.priority === \"HIGH\" ? \"bg-red-100 text-red-700\" : d.priority === \"MEDIUM\" ? \"bg-amber-100 text-amber-700\" : \"bg-zinc-100 text-zinc-600\"}`}>{d.priority}</span>
                      </div>
                      {productRecipes.map(r => {
                        const totalItems = r.ingredients.length + r.packaging.length + r.decoration.length;
                        if (totalItems === 0) return null;
                        return (
                          <div key={r.productName} className=\"mt-3 first:mt-2\">
                            <div className=\"flex items-center gap-2 mb-2\">
                              <span className=\"text-[11px] font-semibold text-zinc-500\">{r.productName}</span>
                              {r.productName === d.product ? (
                                <span className=\"rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-700\">Primary</span>
                              ) : (
                                <span className=\"rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500\">Linked</span>
                              )}
                            </div>
                            <div className=\"flex flex-wrap gap-1.5 mb-2\">
                              {r.ingredients.length > 0 && (
                                <span className=\"inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700\">{r.ingredients.length} ingredient{r.ingredients.length !== 1 ? \"s\" : \"\"}</span>
                              )}
                              {r.packaging.length > 0 && (
                                <span className=\"inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700\">{r.packaging.length} pack</span>
                              )}
                              {r.decoration.length > 0 && (
                                <span className=\"inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700\">{r.decoration.length} deco</span>
                              )}
                              <span className=\"inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600\">{totalItems} item{totalItems !== 1 ? \"s\" : \"\"}</span>
                            </div>
                            {r.ingredients.length > 0 && (
                              <div className=\"mt-2 pt-2 border-t border-zinc-100\">
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
                  );
                })}
              </div>"""

new_modal_body = """              <div className=\"overflow-y-auto px-6 py-4 space-y-4\">
                {summaryModal === \"ingredients\" ? (
                  /* Grouped recipe summary for Recipe Needed */
                  <div className=\"space-y-3\">
                    {Array.from(recipeSummary.entries()).map(([recipeName, entry]) => (
                      <div key={recipeName} className=\"rounded-2xl border-2 border-rose-100 bg-rose-50/30 p-4\">
                        <div className=\"flex items-center justify-between gap-2\">
                          <div className=\"flex items-center gap-3\">
                            <h3 className=\"text-[15px] font-bold text-zinc-900\">{recipeName}</h3>
                            <span className=\"inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[12px] font-bold text-rose-700 font-mono\">\u00d7{entry.count}</span>
                          </div>
                        </div>
                        <div className=\"mt-2 flex flex-wrap gap-1.5\">
                          {Array.from(entry.products).map(product => (
                            <span key={product} className=\"inline-flex items-center gap-1 rounded-full bg-white border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600\">
                              {product}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Recipe cards for all other summary types */
                  dosForDeco.map(d => {
                    const productRecipes = getRecipesForProduct(d.product);
                    const allEmpty = productRecipes.every(r => r.ingredients.length === 0 && r.packaging.length === 0 && r.decoration.length === 0);
                    if (allEmpty) return null;
                    return (
                      <div key={d.id} className=\"rounded-2xl border-2 border-zinc-100 bg-white p-4\">
                        <div className=\"flex items-start justify-between gap-2\">
                          <div className=\"flex items-center gap-2\">
                            <h3 className=\"text-[15px] font-bold text-zinc-900\">{d.product}</h3>
                            <span className=\"text-[12px] text-zinc-400 font-mono\">\u00d7{d.qty}</span>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${d.priority === \"HIGH\" ? \"bg-red-100 text-red-700\" : d.priority === \"MEDIUM\" ? \"bg-amber-100 text-amber-700\" : \"bg-zinc-100 text-zinc-600\"}`}>{d.priority}</span>
                        </div>
                        {productRecipes.map(r => {
                          const totalItems = r.ingredients.length + r.packaging.length + r.decoration.length;
                          if (totalItems === 0) return null;
                          return (
                            <div key={r.productName} className=\"mt-3 first:mt-2\">
                              <div className=\"flex items-center gap-2 mb-2\">
                                <span className=\"text-[11px] font-semibold text-zinc-500\">{r.productName}</span>
                                {r.productName === d.product ? (
                                  <span className=\"rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-700\">Primary</span>
                                ) : (
                                  <span className=\"rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500\">Linked</span>
                                )}
                              </div>
                              <div className=\"flex flex-wrap gap-1.5 mb-2\">
                                {r.ingredients.length > 0 && (
                                  <span className=\"inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700\">{r.ingredients.length} ingredient{r.ingredients.length !== 1 ? \"s\" : \"\"}</span>
                                )}
                                {r.packaging.length > 0 && (
                                  <span className=\"inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700\">{r.packaging.length} pack</span>
                                )}
                                {r.decoration.length > 0 && (
                                  <span className=\"inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700\">{r.decoration.length} deco</span>
                                )}
                                <span className=\"inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600\">{totalItems} item{totalItems !== 1 ? \"s\" : \"\"}</span>
                              </div>
                              {r.ingredients.length > 0 && (
                                <div className=\"mt-2 pt-2 border-t border-zinc-100\">
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
                    );
                  })
                )}
              </div>"""

if old_modal_body in content:
    content = content.replace(old_modal_body, new_modal_body)
    changes += 1
    print("OK - Updated modal body with grouped recipe summary for Recipe Needed")
else:
    print("FAIL - Could not find old modal body")

if changes == 2:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"\nOK - All {changes} changes applied and file saved")
else:
    print(f"\nWARNING - Only {changes}/2 changes applied, file NOT saved (to avoid corruption)")

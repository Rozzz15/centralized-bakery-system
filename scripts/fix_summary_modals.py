# -*- coding: utf-8 -*-
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

path = r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the entire summary modal body content
old_modal_body = """              <div className=\"overflow-y-auto px-6 py-4 space-y-2\">
                {summaryModal === \"products\" && dosForDeco.map(d => (
                  <div key={d.id} className=\"flex items-center justify-between rounded-xl border border-zinc-100 px-3.5 py-2.5\">
                    <div>
                      <span className=\"text-[13px] font-medium text-zinc-900\">{d.product}</span>
                      <span className=\"ml-2 text-[12px] text-zinc-400 font-mono\">\u00d7{d.qty}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${d.priority === \"HIGH\" ? \"bg-red-100 text-red-700\" : d.priority === \"MEDIUM\" ? \"bg-amber-100 text-amber-700\" : \"bg-zinc-100 text-zinc-600\"}`}>{d.priority}</span>
                  </div>
                ))}
                {summaryModal === \"ingredients\" && dosForDeco.flatMap(d => {
                  const productRecipes = getRecipesForProduct(d.product);
                  return productRecipes.flatMap(r => (r.ingredients ?? []).map(ing => {
                    const neededQty = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
                    return { product: d.product, name: ing.name, qty: neededQty, unit: ing.unit, key: `${d.id}-${r.productName}-${ing.name}` };
                  }));
                }).map(item => (
                  <div key={item.key} className=\"flex items-center justify-between rounded-xl border border-rose-100 px-3.5 py-2.5\">
                    <div>
                      <span className=\"text-[13px] font-medium text-zinc-900\">{item.name}</span>
                      <span className=\"ml-2 text-[11px] text-zinc-400\">for {item.product}</span>
                    </div>
                    <span className=\"text-[13px] font-mono font-medium text-rose-600\">{item.qty} {item.unit}</span>
                  </div>
                ))}
                {summaryModal === \"packaging\" && dosForDeco.flatMap(d => {
                  const productRecipes = getRecipesForProduct(d.product);
                  return productRecipes.flatMap(r => (r.packaging ?? []).map(mat => ({
                    product: d.product, name: mat.name, qty: mat.qtyPerBatch, unit: mat.unit, key: `${d.id}-${r.productName}-pkg-${mat.name}`
                  })));
                }).map(item => (
                  <div key={item.key} className=\"flex items-center justify-between rounded-xl border border-blue-100 px-3.5 py-2.5\">
                    <div>
                      <span className=\"text-[13px] font-medium text-zinc-900\">{item.name}</span>
                      <span className=\"ml-2 text-[11px] text-zinc-400\">for {item.product}</span>
                    </div>
                    <span className=\"text-[13px] font-mono font-medium text-blue-600\">{item.qty} {item.unit}</span>
                  </div>
                ))}
                {summaryModal === \"deco\" && dosForDeco.flatMap(d => {
                  const productRecipes = getRecipesForProduct(d.product);
                  return productRecipes.flatMap(r => (r.decoration ?? []).map(sup => ({
                    product: d.product, name: sup.name, qty: sup.qtyPerBatch, unit: sup.unit, key: `${d.id}-${r.productName}-deco-${sup.name}`
                  })));
                }).map(item => (
                  <div key={item.key} className=\"flex items-center justify-between rounded-xl border border-purple-100 px-3.5 py-2.5\">
                    <div>
                      <span className=\"text-[13px] font-medium text-zinc-900\">{item.name}</span>
                      <span className=\"ml-2 text-[11px] text-zinc-400\">for {item.product}</span>
                    </div>
                    <span className=\"text-[13px] font-mono font-medium text-purple-600\">{item.qty} {item.unit}</span>
                  </div>
                ))}

              </div>"""

new_modal_body = """              <div className=\"overflow-y-auto px-6 py-4 space-y-4\">
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

if old_modal_body in content:
    content = content.replace(old_modal_body, new_modal_body)
    print("OK - Summary modal body replaced with recipe cards")
else:
    print("FAIL - Could not find old summary modal body to replace")
    # Debug: find key elements
    for marker in ["overflow-y-auto px-6 py-4 space-y-2", "summaryModal === \\\"products\\\"", "dosForDeco.flatMap"]:
        idx = content.find(marker)
        if idx >= 0:
            print(f"Found '{marker}' at position {idx}")
            print(f"  Context: {content[idx:idx+200]}")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("\nOK - File saved successfully")

import re

with open('src/components/DecoDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ============================================================
# EDIT 1: Update dashboard block - replace totalPkg/totalDecoItems
#         to include linked recipes and add getRecipesForProduct
# ============================================================

old_dashboard_totals = """  /* ── Dashboard ── */
  if (activeTab === \"dashboard\") {
    const totalPkg = dosForDeco.reduce((s, d) => {
      const recipe = recipes.find(r => r.productName === d.product);
      return s + (recipe?.packaging.length ?? 0);
    }, 0);
    const totalDecoItems = dosForDeco.reduce((s, d) => {
      const recipe = recipes.find(r => r.productName === d.product);
      return s + (recipe?.decoration.length ?? 0);
    }, 0);"""

new_dashboard_totals = """  /* ── Dashboard ── */
  if (activeTab === \"dashboard\") {
    const totalPkg = dosForDeco.reduce((s, d) => {
      const productRecipes = getRecipesForProduct(d.product);
      return s + productRecipes.reduce((sum, r) => sum + r.packaging.length, 0);
    }, 0);
    const totalDecoItems = dosForDeco.reduce((s, d) => {
      const productRecipes = getRecipesForProduct(d.product);
      return s + productRecipes.reduce((sum, r) => sum + r.decoration.length, 0);
    }, 0);"""

if old_dashboard_totals in content:
    content = content.replace(old_dashboard_totals, new_dashboard_totals)
    print("EDIT 1: Dashboard totals updated with linked recipes")
else:
    print("EDIT 1: FAILED - could not find dashboard totals block")
    # Debug: find similar text
    idx = content.find("totalPkg = dosForDeco.reduce")
    if idx >= 0:
        print(f"  Found at position {idx}: {content[idx:idx+200]}")

# ============================================================
# EDIT 2: Update hasDetails check to include linked recipes
# ============================================================

old_has_details = """                  const recipe = recipes.find(r => r.productName === d.product);
                  const hasDetails = recipe && (recipe.ingredients.length > 0 || recipe.packaging.length > 0 || recipe.decoration.length > 0);"""

new_has_details = """                  const productRecipes = getRecipesForProduct(d.product);
                  const hasDetails = productRecipes.some(r => r.ingredients.length > 0 || r.packaging.length > 0 || r.decoration.length > 0);"""

if old_has_details in content:
    content = content.replace(old_has_details, new_has_details)
    print("EDIT 2: hasDetails updated with linked recipes")
else:
    print("EDIT 2: FAILED - could not find hasDetails block")
    idx = content.find("const recipe = recipes.find(r => r.productName === d.product);")
    if idx >= 0:
        print(f"  Found recipe.find at {idx}: {content[idx:idx+300]}")

# ============================================================
# EDIT 3: Replace expanded section with recipe cards styled like Adv Freemix
# ============================================================

# Find the expanded section - it starts after the status dot and goes until tfoot
old_expanded_start = """                      {isExpanded && hasDetails && (
                        <tr key={`${d.id}-details`}>
                          <td colSpan={7} className=\"px-3 pb-3 pt-1\">
                            <div className=\"ml-7 space-y-2\">
                              {recipe!.ingredients.length > 0 && (
                                <div className=\"rounded-lg border border-rose-200 bg-rose-50/50 overflow-hidden\">
                                  <div className=\"flex items-center gap-1.5 bg-rose-100/60 px-2.5 py-1 border-b border-rose-100\">
                                    <span className=\"text-[9px] font-semibold text-rose-500 uppercase tracking-wider\">Ingredients</span>
                                    <span className=\"ml-auto rounded-full bg-rose-100 px-1.5 py-0.5 text-[8px] font-mono text-rose-600\">{recipe!.ingredients.length}</span>
                                  </div>
                                  <div className=\"flex flex-wrap gap-1 px-2.5 py-1.5\">
                                    {recipe!.ingredients.map((ing, i) => {
                                      const neededQty = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
                                      return (
                                        <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[10px]\">
                                          <span className=\"text-zinc-700 font-medium\">{ing.name}</span>
                                          <span className=\"text-rose-600 font-mono\">×{neededQty}{ing.unit}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {recipe!.packaging.length > 0 && (
                                <div className=\"rounded-lg border border-blue-200 bg-blue-50/50 overflow-hidden\">
                                  <div className=\"flex items-center gap-1.5 bg-blue-100/60 px-2.5 py-1 border-b border-blue-100\">
                                    <span className=\"text-[9px] font-semibold text-blue-500 uppercase tracking-wider\">Packaging</span>
                                    <span className=\"ml-auto rounded-full bg-blue-100 px-1.5 py-0.5 text-[8px] font-mono text-blue-600\">{recipe!.packaging.length}</span>
                                  </div>
                                  <div className=\"flex flex-wrap gap-1 px-2.5 py-1.5\">
                                    {recipe!.packaging.map((mat, i) => (
                                      <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-blue-200 px-1.5 py-0.5 text-[10px]\">
                                        <span className=\"text-zinc-700 font-medium\">{mat.name}</span>
                                        <span className=\"text-blue-600 font-mono\">×{mat.qtyPerBatch}{mat.unit}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {recipe!.decoration.length > 0 && (
                                <div className=\"rounded-lg border border-purple-200 bg-purple-50/50 overflow-hidden\">
                                  <div className=\"flex items-center gap-1.5 bg-purple-100/60 px-2.5 py-1 border-b border-purple-100\">
                                    <span className=\"text-[9px] font-semibold text-purple-500 uppercase tracking-wider\">Deco Supplies</span>
                                    <span className=\"ml-auto rounded-full bg-purple-100 px-1.5 py-0.5 text-[8px] font-mono text-purple-600\">{recipe!.decoration.length}</span>
                                  </div>
                                  <div className=\"flex flex-wrap gap-1 px-2.5 py-1.5\">
                                    {recipe!.decoration.map((sup, i) => (
                                      <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-purple-200 px-1.5 py-0.5 text-[10px]\">
                                        <span className=\"text-zinc-700 font-medium\">{sup.name}</span>
                                        <span className=\"text-purple-600 font-mono\">×{sup.qtyPerBatch}{sup.unit}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                            </div>
                          </td>
                        </tr>
                      )}"""

new_expanded_section = """                      {isExpanded && hasDetails && (
                        <tr key={`${d.id}-details`}>
                          <td colSpan={7} className=\"px-3 pb-3 pt-1\">
                            <div className=\"ml-7 grid grid-cols-1 sm:grid-cols-2 gap-3\">
                              {productRecipes.map(r => {
                                const totalItems = r.ingredients.length + r.packaging.length + r.decoration.length;
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

                                    {/* Ingredient list inline */}
                                    {r.ingredients.length > 0 && (
                                      <div className=\"mt-3 pt-3 border-t border-zinc-100\">
                                        <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5\">Ingredients</div>
                                        <div className=\"flex flex-wrap gap-1.5\">
                                          {r.ingredients.map((ing, i) => {
                                            const neededQty = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
                                            return (
                                              <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[10px]\">
                                                <span className=\"text-zinc-700 font-medium\">{ing.name}</span>
                                                <span className=\"text-rose-600 font-mono\">{neededQty}{ing.unit}</span>
                                              </span>
                                            );
                                          })}
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
                                              <span className=\"text-blue-600 font-mono\">×{mat.qtyPerBatch}{mat.unit}</span>
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
                                              <span className=\"text-purple-600 font-mono\">×{dec.qtyPerBatch}{dec.unit}</span>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}"""

if old_expanded_start in content:
    content = content.replace(old_expanded_start, new_expanded_section)
    print("EDIT 3: Expanded section replaced with recipe cards")
else:
    print("EDIT 3: FAILED - could not find expanded section")
    # Try to find it with a simpler search
    idx = content.find("{isExpanded && hasDetails && (")
    if idx >= 0:
        print(f"  Found 'isExpanded && hasDetails' at {idx}")
        print(f"  Context: {content[idx:idx+200]}")

# ============================================================
# EDIT 4: Update summary modals to include linked recipes
# ============================================================

# 4a: Ingredients summary modal
old_ingredients_modal = """                {summaryModal === \"ingredients\" && dosForDeco.flatMap(d => {
                  const recipe = recipes.find(r => r.productName === d.product);
                  return (recipe?.ingredients ?? []).map(ing => {
                    const neededQty = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
                    return { product: d.product, name: ing.name, qty: neededQty, unit: ing.unit, key: `${d.id}-${ing.name}` };
                  });"""

new_ingredients_modal = """                {summaryModal === \"ingredients\" && dosForDeco.flatMap(d => {
                  const productRecipes = getRecipesForProduct(d.product);
                  return productRecipes.flatMap(r => (r.ingredients ?? []).map(ing => {
                    const neededQty = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
                    return { product: d.product, name: ing.name, qty: neededQty, unit: ing.unit, key: `${d.id}-${r.productName}-${ing.name}` };
                  }));"""

if old_ingredients_modal in content:
    content = content.replace(old_ingredients_modal, new_ingredients_modal)
    print("EDIT 4a: Ingredients summary modal updated with linked recipes")
else:
    print("EDIT 4a: FAILED - could not find ingredients modal block")
    idx = content.find('summaryModal === "ingredients"')
    if idx >= 0:
        print(f"  Found at {idx}")
        print(f"  Context: {content[idx:idx+250]}")

# 4b: Packaging summary modal
old_packaging_modal = """                {summaryModal === \"packaging\" && dosForDeco.flatMap(d => {
                  const recipe = recipes.find(r => r.productName === d.product);
                  return (recipe?.packaging ?? []).map(mat => ({
                    product: d.product, name: mat.name, qty: mat.qtyPerBatch, unit: mat.unit, key: `${d.id}-pkg-${mat.name}`
                  }));"""

new_packaging_modal = """                {summaryModal === \"packaging\" && dosForDeco.flatMap(d => {
                  const productRecipes = getRecipesForProduct(d.product);
                  return productRecipes.flatMap(r => (r.packaging ?? []).map(mat => ({
                    product: d.product, name: mat.name, qty: mat.qtyPerBatch, unit: mat.unit, key: `${d.id}-${r.productName}-pkg-${mat.name}`
                  })));"""

if old_packaging_modal in content:
    content = content.replace(old_packaging_modal, new_packaging_modal)
    print("EDIT 4b: Packaging summary modal updated with linked recipes")
else:
    print("EDIT 4b: FAILED - could not find packaging modal block")
    idx = content.find('summaryModal === "packaging"')
    if idx >= 0:
        print(f"  Found at {idx}")
        print(f"  Context: {content[idx:idx+250]}")

# 4c: Deco summary modal
old_deco_modal = """                {summaryModal === \"deco\" && dosForDeco.flatMap(d => {
                  const recipe = recipes.find(r => r.productName === d.product);
                  return (recipe?.decoration ?? []).map(sup => ({
                    product: d.product, name: sup.name, qty: sup.qtyPerBatch, unit: sup.unit, key: `${d.id}-deco-${sup.name}`
                  }));"""

new_deco_modal = """                {summaryModal === \"deco\" && dosForDeco.flatMap(d => {
                  const productRecipes = getRecipesForProduct(d.product);
                  return productRecipes.flatMap(r => (r.decoration ?? []).map(sup => ({
                    product: d.product, name: sup.name, qty: sup.qtyPerBatch, unit: sup.unit, key: `${d.id}-${r.productName}-deco-${sup.name}`
                  })));"""

if old_deco_modal in content:
    content = content.replace(old_deco_modal, new_deco_modal)
    print("EDIT 4c: Deco summary modal updated with linked recipes")
else:
    print("EDIT 4c: FAILED - could not find deco modal block")
    idx = content.find('summaryModal === "deco"')
    if idx >= 0:
        print(f"  Found at {idx}")
        print(f"  Context: {content[idx:idx+250]}")

# Write the result
with open('src/components/DecoDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nDone! File written.")

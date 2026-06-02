import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = "C:/Users/Admin/Desktop/Businesses/CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM/src/components/DecoDashboard.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the productRecipes.map to filter out empty recipes first
old = """                              {productRecipes.map(r => (
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

new = """                              {(() => {
                                const validRecipes = productRecipes.filter(r => r.ingredients.length > 0 || r.packaging.length > 0 || r.decoration.length > 0);
                                if (validRecipes.length === 0) return <div className=\"text-[12px] text-zinc-400 italic col-span-2\">No recipe formula set for this product</div>;
                                return validRecipes.map(r => (
                                  <div key={r.productName}>
                                    <div className=\"text-[11px] font-medium text-zinc-500 mb-1\">{r.productName}</div>
                                    <div className=\"flex flex-wrap gap-1.5\">
                                      {r.ingredients.slice(0, 8).map((ing, i) => (
                                        <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[10px]\">
                                          <span className=\"text-zinc-700 font-medium\">{ing.name}</span>
                                          <span className=\"text-rose-600 font-mono\">{ing.qtyPerBatch}{ing.unit}</span>
                                        </span>
                                      ))}
                                      {r.ingredients.length > 8 && (
                                        <span className=\"inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500\">+{r.ingredients.length - 8} more</span>
                                      )}
                                    </div>
                                  </div>
                                ));
                              })()}"""

if old in content:
    content = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Filtered expanded DOS recipes to show only recipes with content")
else:
    print("❌ Could not find the old map block")
    # Debug
    idx = content.find("productRecipes.map(r =>")
    if idx >= 0:
        print(f"  Found at pos {idx}, context: {content[idx:idx+400]}")
    else:
        print("  productRecipes.map not found")

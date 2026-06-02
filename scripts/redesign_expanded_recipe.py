import re

with open("src/components/DecoDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the entire expanded section IIFE
old = '''                              {(() => {
                                const validRecipes = productRecipes.filter(r => r.ingredients.length > 0 || r.packaging.length > 0 || r.decoration.length > 0);
                                if (validRecipes.length === 0) return <div className=\"text-[12px] text-zinc-400 italic col-span-2\">No recipe formula set for this product</div>;
                                return validRecipes.map(r => {
                                  const isPrimaryRecipe = r.productName === d.product;
                                  return (
                                  <div key={r.productName}>
                                    {!isPrimaryRecipe && <div className=\"text-[11px] font-medium text-zinc-500 mb-1\">{r.productName}</div>}
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
                                );
                              });'''

new = '''                              {(() => {
                                const validRecipes = productRecipes.filter(r => r.ingredients.length > 0 || r.packaging.length > 0 || r.decoration.length > 0);
                                if (validRecipes.length === 0) return <div className=\"text-[12px] text-zinc-400 italic col-span-2\">No recipe formula set for this product</div>;
                                return (
                                  <div className=\"flex flex-wrap gap-3\">
                                    {validRecipes.map(r => {
                                      const isPrimary = r.productName === d.product;
                                      return (
                                        <div key={r.productName} className=\"inline-flex items-center gap-2 rounded-xl bg-white border border-zinc-200 px-3.5 py-2 hover:border-zinc-400 hover:shadow-sm transition-all\">
                                          <span className=\"text-[13px] font-medium text-zinc-900\">{r.productName}</span>
                                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                            isPrimary ? \"bg-rose-100 text-rose-700\" : \"bg-zinc-100 text-zinc-500\"
                                          }`}>
                                            {isPrimary ? \"Primary\" : \"Linked\"}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              });'''

if old in content:
    content = content.replace(old, new, 1)
    with open("src/components/DecoDashboard.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Expanded DOS row now shows recipe names with Primary/Linked badges only.")
else:
    print("ERROR: Could not find the old expanded section. Let me debug...")
    # Check for some markers
    markers = [
        "validRecipes = productRecipes.filter",
        "isPrimaryRecipe = r.productName === d.product",
        "flex flex-wrap gap-1.5",
        "r.ingredients.slice(0, 8)",
    ]
    for m in markers:
        if m in content:
            print(f"  - Found marker: {m}")
        else:
            print(f"  - MISSING marker: {m}")

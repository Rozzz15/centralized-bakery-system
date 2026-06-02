import re

with open("src/components/DecoDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Find the "Mark as Prepared" onClick handler
old = """                      onClick={() => {
                        if (isPrepped) {
                          setFreeMixDone(prev => { const n = new Set(prev); n.delete(d.product); return n; });
                          setPrepIngredientOpen(prev => { const n = new Set(prev); n.delete(d.product); return n; });
                        } else {
                          // Initialize ingredient quantities for this product
                          const productRecipesInit = getRecipesForProduct(d.product);
                          const initialQty: Record<string, number> = {};
                          productRecipesInit.forEach(r => {
                            r.ingredients.forEach(ing => {
                              const key = ing.inventoryId || ing.name;
                              if (!(key in initialQty)) {
                                initialQty[key] = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
                              }
                            });
                          });
                          setPrepIngredientQty(prev => ({ ...prev, [d.product]: initialQty }));
                          setPrepIngredientOpen(prev => new Set(prev).add(d.product));
                        }
                      }}"""

new = """                      onClick={() => {
                        if (isPrepped) {
                          setFreeMixDone(prev => { const n = new Set(prev); n.delete(d.product); return n; });
                          setPrepIngredientOpen(prev => { const n = new Set(prev); n.delete(d.product); return n; });
                        } else {
                          // Check if the product has any ingredients across recipes
                          const productRecipesInit = getRecipesForProduct(d.product);
                          const hasIngredients = productRecipesInit.some(r => r.ingredients.length > 0);
                          if (hasIngredients) {
                            // Show ingredient usage panel
                            const initialQty: Record<string, number> = {};
                            productRecipesInit.forEach(r => {
                              r.ingredients.forEach(ing => {
                                const key = ing.inventoryId || ing.name;
                                if (!(key in initialQty)) {
                                  initialQty[key] = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
                                }
                              });
                            });
                            setPrepIngredientQty(prev => ({ ...prev, [d.product]: initialQty }));
                            setPrepIngredientOpen(prev => new Set(prev).add(d.product));
                          } else {
                            // No ingredients — mark as prepared directly (skips the panel)
                            setFreeMixDone(prev => new Set(prev).add(d.product));
                          }
                        }
                      }}"""

count = content.count(old)
if count == 0:
    print("ERROR: Could not find the exact old string to replace")
    # Try to find a partial match
    if "Initialize ingredient quantities for this product" in content:
        print("Found partial marker but exact match failed (indentation or whitespace issue)")
    exit(1)

content = content.replace(old, new, 1)
with open("src/components/DecoDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print(f"Applied {count} replacement(s)")

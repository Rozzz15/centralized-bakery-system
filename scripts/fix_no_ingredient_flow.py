import re

with open("src/components/DecoDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Fix no-ingredient flow: only set prepIngredientDone, not freeMixDone
old_no_ing = """                            } else {
                                setFreeMixDone(prev => new Set(prev).add(d.product));
                                setPrepIngredientDone(prev => new Set(prev).add(d.product));
                              }"""

new_no_ing = """                            } else {
                                setPrepIngredientDone(prev => new Set(prev).add(d.product));
                              }"""

count = content.count(old_no_ing)
if count == 0:
    print("ERROR: Could not find no-ingredient flow in Mark as Prepared")
    exit(1)
content = content.replace(old_no_ing, new_no_ing, 1)
print(f"1. Fixed no-ingredient flow: {count} match(es)")

# 2. Fix handleSavePrepToFreezer to proceed with empty qtyMap (just skip deductions, still create freezer item)
old_return = """    const qtyMap = prepIngredientQty[product];
    if (!qtyMap || Object.keys(qtyMap).length === 0) return;

    const productRecipes = getRecipesForProduct(product);"""

new_return = """    const qtyMap = prepIngredientQty[product] || {};

    const productRecipes = getRecipesForProduct(product);"""

count = content.count(old_return)
if count == 0:
    print("ERROR: Could not find early return in handleSavePrepToFreezer")
    exit(1)
content = content.replace(old_return, new_return, 1)
print(f"2. Fixed early return in handleSavePrepToFreezer: {count} match(es)")

with open("src/components/DecoDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("\nAll fixes applied successfully!")

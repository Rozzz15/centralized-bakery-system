import re

with open('src/components/DecoDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ============================================================
# Fix 1: Add getRecipesForProduct function definition before totalNeeded
# ============================================================

old_block = """  const totalNeeded = dosForDeco.reduce((s, d) => {
    const recipe = recipes.find(r => r.productName === d.product);
    return s + (recipe?.ingredients.length ?? 0);
  }, 0);"""

new_block = """  const getRecipesForProduct = (product: string) => {
    const direct = recipes.filter(r => r.productName === product);
    const linked = recipes.filter(r => (r.linkedProduct ?? []).includes(product) && r.productName !== product);
    return [...direct, ...linked];
  };

  const totalNeeded = dosForDeco.reduce((s, d) => {
    const productRecipes = getRecipesForProduct(d.product);
    return s + productRecipes.reduce((sum, r) => sum + r.ingredients.length, 0);
  }, 0);"""

if old_block in content:
    content = content.replace(old_block, new_block)
    print("Fix 1: getRecipesForProduct added, totalNeeded updated")
else:
    print("Fix 1: FAILED - could not find old_block")
    idx = content.find("const totalNeeded = dosForDeco.reduce")
    if idx >= 0:
        print(f"  Found at {idx}, context: {content[idx:idx+150]}")

# Write result
with open('src/components/DecoDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nDone!")

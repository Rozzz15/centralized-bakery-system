import re

path = r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# === 1. Replace the "else" branch of the Mark as Prepared button to initialize qty state ===
old_else = """                        } else {
                          setPrepIngredientOpen(prev => new Set(prev).add(d.product));
                        }"""

new_else = """                        } else {
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
                        }"""

if old_else in content:
    content = content.replace(old_else, new_else)
    print("✓ Replaced else branch to init ingredient quantities in onClick")
else:
    print("✗ Could not find the else branch")
    idx = content.find("setPrepIngredientOpen(prev => new Set")
    if idx >= 0:
        print(f"  Found at index {idx}")
        print(f"  Context: ...{content[idx-100:idx+100]}...")
    import sys
    sys.exit(1)

# === 2. Remove the setTimeout initialization from inside the ingredient panel IIFE ===
# The block to remove:
old_settimeout = """                    // Sync to state on first render
                    if (Object.keys(productQtyMap).length > 0 && !prepIngredientQty[d.product]) {
                      setTimeout(() => {
                        setPrepIngredientQty(prev => ({ ...prev, [d.product]: { ...productQtyMap } }));
                      }, 0);
                    }
                    return ("""

new_settimeout = """                    return ("""

if old_settimeout in content:
    content = content.replace(old_settimeout, new_settimeout)
    print("✓ Removed setTimeout initialization from panel body")
else:
    print("✗ Could not find the setTimeout block")
    idx = content.find("Sync to state on first render")
    if idx >= 0:
        print(f"  Found at index {idx}")
    import sys
    sys.exit(1)

# === 3. Also simplify the forEach loop - no need to mutate local object for defaults ===
# The old loop with mutation:
old_foreach = """                    const productQtyMap = prepIngredientQty[d.product] || {};
                    // Initialize defaults for any missing ingredients
                    allIngredients.forEach(ing => {
                      const key = ing.inventoryId || ing.name;
                      if (!(key in productQtyMap)) {
                        productQtyMap[key] = ing.baseQty;
                      }
                    });"""

new_foreach = """                    const productQtyMap = prepIngredientQty[d.product] || {};"""

if old_foreach in content:
    content = content.replace(old_foreach, new_foreach)
    print("✓ Simplified forEach initialization (no more local mutation)")
else:
    print("✗ Could not find the forEach block")
    idx = content.find("prepIngredientQty[d.product] || {}")
    if idx >= 0:
        print(f"  Found at index {idx}")
        print(f"  Context: ...{content[idx:idx+300]}...")
    import sys
    sys.exit(1)

# Write back
with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("\n✓ All initialization fixes applied!")

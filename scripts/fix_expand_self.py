import re

path = r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix 1: hasDetails - exclude product's own recipe
old1 = "const hasDetails = productRecipes.some(r => r.ingredients.length > 0 || r.packaging.length > 0 || r.decoration.length > 0);"
new1 = "const hasDetails = productRecipes.some(r => r.productName !== d.product && (r.ingredients.length > 0 || r.packaging.length > 0 || r.decoration.length > 0));"

# Fix 2: validRecipes filter - exclude product's own recipe  
old2 = "const validRecipes = productRecipes.filter(r => r.ingredients.length > 0 || r.packaging.length > 0 || r.decoration.length > 0);"
new2 = "const validRecipes = productRecipes.filter(r => r.productName !== d.product && (r.ingredients.length > 0 || r.packaging.length > 0 || r.decoration.length > 0));"

if old1 in content:
    content = content.replace(old1, new1, 1)
    print("Fix 1 applied: hasDetails")
else:
    print("Fix 1 NOT found")

if old2 in content:
    content = content.replace(old2, new2, 1)
    print("Fix 2 applied: validRecipes filter")
else:
    print("Fix 2 NOT found")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")

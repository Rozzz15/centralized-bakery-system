# -*- coding: utf-8 -*-
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

path = r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the IIFE approach with a variable before return
old = """  if (activeTab === \"recipes\") {
    return ("""
new = """  if (activeTab === \"recipes\") {
    const dosRecipeProducts = productCatalog.filter(product => {
      return dosForDeco.some(d => getRecipesForProduct(d.product).some(r => r.productName === product));
    });
    return ("""

if old in content:
    content = content.replace(old, new)
    print("OK - Added dosRecipeProducts variable before return")
else:
    print("FAIL - Could not find 'if (activeTab === \"recipes\")'")

# Replace the IIFE map with direct use of dosRecipeProducts
old2 = """          {(() => {
            const dosProductNames = new Set(dosForDeco.flatMap(d => getRecipesForProduct(d.product).map(r => r.productName)));
            return productCatalog.filter(product => dosProductNames.has(product)).map(product => {
            const recipe = recipes.find(r => r.productName === product);
            return ("""
new2 = """          {dosRecipeProducts.map(product => {
            const recipe = recipes.find(r => r.productName === product);
            return ("""

if old2 in content:
    content = content.replace(old2, new2)
    print("OK - Replaced IIFE with direct dosRecipeProducts.map")
else:
    print("FAIL - Could not find IIFE map")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("OK - File saved")

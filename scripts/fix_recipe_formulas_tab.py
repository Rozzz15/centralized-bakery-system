# -*- coding: utf-8 -*-
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# --- Change 1: Update DecoDashboard.tsx Recipe Formulas section ---
path1 = r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx"
with open(path1, "r", encoding="utf-8") as f:
    content1 = f.read()

changes = 0

# Update the sub-header text
old_header = '<p className=\"mt-1 text-[13px] text-zinc-500\">Create and manage product recipes, ingredient quantities, and formulations.</p>'
new_header = '<p className=\"mt-1 text-[13px] text-zinc-500\">Product recipes needed for current DOS items. Direct and linked recipes are shown below.</p>'

if old_header in content1:
    content1 = content1.replace(old_header, new_header)
    changes += 1
    print("OK - Updated header text")
else:
    print("FAIL - Could not find old header text")

# Add dosProductNames filter before the productCatalog.map
old_map = """        <div className=\"space-y-3\">
          {productCatalog.map(product => {
            const recipe = recipes.find(r => r.productName === product);
            return ("""
new_map = """        <div className=\"space-y-3\">
          {(() => {
            const dosProductNames = new Set(dosForDeco.flatMap(d => getRecipesForProduct(d.product).map(r => r.productName)));
            return productCatalog.filter(product => dosProductNames.has(product)).map(product => {
            const recipe = recipes.find(r => r.productName === product);
            return ("""
            
if old_map in content1:
    content1 = content1.replace(old_map, new_map)
    changes += 1
    print("OK - Updated productCatalog to filter by DOS products")
else:
    print("FAIL - Could not find old productCatalog.map line")

if changes > 0:
    with open(path1, "w", encoding="utf-8") as f:
        f.write(content1)
    print(f"OK - DecoDashboard.tsx saved with {changes} changes")
else:
    print("WARNING - No changes were applied to DecoDashboard.tsx")

# --- Change 2: Update App.tsx sidebar ---
path2 = r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\App.tsx"
with open(path2, "r", encoding="utf-8") as f:
    content2 = f.read()

# Check if "recipes" is already in the deco sidebar
if 'deco:' in content2:
    # Find the deco sidebar section and add "recipes" after "dashboard"
    old_sidebar = """  deco: [
    { id: "dashboard", label: "Dashboard", icon: "\u25fc" },
    { id: "adv-freemix", label: "Advanced Freemix", icon: "\u2b23" },
    { id: "deco-queue", label: "Decoration Queue", icon: "\u2b22" },
    { id: "inventory", label: "Inventory", icon: "\u2b21" },
    { id: "freezer", label: "Freezer", icon: "\u25c7" },
  ],"""
    
    new_sidebar = """  deco: [
    { id: "dashboard", label: "Dashboard", icon: "\u25fc" },
    { id: "recipes", label: "Recipe Formulas", icon: "\u25c8" },
    { id: "adv-freemix", label: "Advanced Freemix", icon: "\u2b23" },
    { id: "deco-queue", label: "Decoration Queue", icon: "\u2b22" },
    { id: "inventory", label: "Inventory", icon: "\u2b21" },
    { id: "freezer", label: "Freezer", icon: "\u25c7" },
  ],"""
    
    if old_sidebar in content2:
        content2 = content2.replace(old_sidebar, new_sidebar)
        with open(path2, "w", encoding="utf-8") as f:
            f.write(content2)
        print("OK - Added 'recipes' tab to deco sidebar in App.tsx")
    else:
        print("FAIL - Could not find exact deco sidebar section in App.tsx. Checking for partial match...")
        # Try different icon variations
        idx = content2.find('deco: [')
        if idx >= 0:
            print(f"Found 'deco: [' at position {idx}")
            print(f"Context (200 chars): {repr(content2[idx:idx+300])}")
else:
    print("INFO - 'deco:' not found in App.tsx")

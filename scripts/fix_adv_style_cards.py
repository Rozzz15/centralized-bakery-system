# -*- coding: utf-8 -*-
import io
import sys

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

path = r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace the ingredients map with truncation at 6 items and use qtyPerBatch instead of scaled neededQty
old_ingredients = """                                          {r.ingredients.map((ing, i) => {
                                            const neededQty = Math.ceil(ing.qtyPerBatch * (d.qty / 100));
                                            return (
                                              <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[10px]">
                                                <span className="text-zinc-700 font-medium">{ing.name}</span>
                                                <span className="text-rose-600 font-mono">{neededQty}{ing.unit}</span>
                                              </span>
                                            );
                                          })}"""

new_ingredients = """                                          {r.ingredients.slice(0, 6).map((ing, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[10px]">
                                              <span className="text-zinc-700 font-medium">{ing.name}</span>
                                              <span className="text-rose-600 font-mono">{ing.qtyPerBatch}{ing.unit}</span>
                                            </span>
                                          ))}
                                          {r.ingredients.length > 6 && (
                                            <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">+{r.ingredients.length - 6} more</span>
                                          )}"""

if old_ingredients in content:
    content = content.replace(old_ingredients, new_ingredients)
    print("OK - Ingredients section updated with truncation at 6 items")
else:
    print("FAIL - Could not find old ingredients section to replace")
    # Try to find what's actually there
    idx = content.find("r.ingredients.map((ing, i)")
    if idx >= 0:
        print(f"Found 'r.ingredients.map' at position {idx}")
        print("Context:", content[idx:idx+400])

# 2. Remove the x prefix from packaging qtyPerBatch in DOS expanded section (the times symbol)
old_pkg_x = """                                              <span className="text-blue-600 font-mono">\u00d7{mat.qtyPerBatch}{mat.unit}</span>"""
new_pkg_x = """                                              <span className="text-blue-600 font-mono">{mat.qtyPerBatch}{mat.unit}</span>"""
count_pkg = content.count(old_pkg_x)
if count_pkg > 0:
    content = content.replace(old_pkg_x, new_pkg_x)
    print(f"OK - Removed times prefix from {count_pkg} packaging qty occurrences")
else:
    print("INFO - No times prefix found in packaging (may already be removed)")

# 3. Remove the x prefix from deco qtyPerBatch in DOS expanded section
old_deco_x = """                                              <span className="text-purple-600 font-mono">\u00d7{dec.qtyPerBatch}{dec.unit}</span>"""
new_deco_x = """                                              <span className="text-purple-600 font-mono">{dec.qtyPerBatch}{dec.unit}</span>"""
count_deco = content.count(old_deco_x)
if count_deco > 0:
    content = content.replace(old_deco_x, new_deco_x)
    print(f"OK - Removed times prefix from {count_deco} deco qty occurrences")
else:
    print("INFO - No times prefix found in deco (may already be removed)")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("\nOK - File saved successfully")

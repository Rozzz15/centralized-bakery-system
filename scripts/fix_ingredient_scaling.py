"""Fix ingredient qty scaling: remove / 100 divisor from ingredient calculations."""

content = open("src/components/DecoDashboard.tsx", encoding="utf-8").read()

# 1. Line 214: neededQty calculation in handleSavePrepToFreezer
old1 = "Math.ceil(ing.qtyPerBatch * (dos.qty / 100))"
new1 = "Math.ceil(ing.qtyPerBatch * dos.qty)"
count1 = content.count(old1)
print(f"[1] '{old1}' found {count1} time(s)")

# 2. Line 920: allIngredients baseQty
old2 = "Math.ceil(ing.qtyPerBatch * (d.qty / 100))"
new2 = "Math.ceil(ing.qtyPerBatch * d.qty)"
count2 = content.count(old2)
print(f"[2] '{old2}' found {count2} time(s)")

# 3. Line 1050: initialQty initialization
old3 = "Math.ceil(ing.qtyPerBatch * (d.qty / 100))"
new3 = "Math.ceil(ing.qtyPerBatch * d.qty)"
count3 = content.count(old3)
print(f"[3] '{old3}' found {count3} time(s)")

# Apply all replacements
content = content.replace(old1, new1)
content = content.replace(old2, new2)
content = content.replace(old3, new3)

# Verify
final1 = content.count("Math.ceil(ing.qtyPerBatch * (")
print(f"\nRemaining '/ 100' formulas: {final1}")

open("src/components/DecoDashboard.tsx", "w", encoding="utf-8").write(content)
print("\nDone! File updated.")

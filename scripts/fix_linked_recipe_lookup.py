import sys
sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')

with open('src/components/DecoDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Change 1: Line ~1461 - handleForward completion logic
old1 = "        const recipe = recipes.find(r => r.productName === task.product);"
new1 = "        const recipe = recipes.find(r => r.productName === task.product) || recipes.find(r => r.linkedProduct?.includes(task.product));"

count1 = content.count(old1)
print(f"Change 1: found {count1} occurrence(s) of the pattern")

if count1 >= 1:
    content = content.replace(old1, new1, 1)  # replace first occurrence only
    print("  ✓ Applied change 1")
else:
    print("  ✗ Pattern not found for change 1")

# Change 2: Line ~1856 - card materials display section
old2 = "                            const recipe = recipes.find(r => r.productName === task.product);"
new2 = "                            const recipe = recipes.find(r => r.productName === task.product) || recipes.find(r => r.linkedProduct?.includes(task.product));"

count2 = content.count(old2)
print(f"Change 2: found {count2} occurrence(s) of the pattern")

if count2 >= 1:
    content = content.replace(old2, new2, 1)  # replace first occurrence only
    print("  ✓ Applied change 2")
else:
    print("  ✗ Pattern not found for change 2")

with open('src/components/DecoDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nDone. Both changes applied successfully.")

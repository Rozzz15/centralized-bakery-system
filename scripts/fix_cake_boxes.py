import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = "C:/Users/Admin/Desktop/Businesses/CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM/src/App.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old = """{ name: "Cake Boxes (8\\"")", qtyPerBatch: 50, unit: "pcs" },"""
new = """{ name: "Cake Boxes (8 in)", qtyPerBatch: 50, unit: "pcs" },"""

if old in content:
    content = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Fixed Cake Boxes string")
else:
    print("❌ Looking for alternatives...")
    # Try without escaped quote
    alt_old = """{ name: "Cake Boxes (8")", qtyPerBatch: 50, unit: "pcs" },"""
    if alt_old in content:
        content = content.replace(alt_old, new)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print("✅ Fixed Cake Boxes (alt version)")
    else:
        idx = content.find("Cake Boxes")
        if idx >= 0:
            print(f"  Found 'Cake Boxes' at {idx}")
            print(f"  Context: {content[idx:idx+80]}")
        else:
            print("  'Cake Boxes' not found")

import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = "C:/Users/Admin/Desktop/Businesses/CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM/src/components/DecoDashboard.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old = "                                const totalItems = r.ingredients.length + r.packaging.length + r.decoration.length;\n"
if old in content:
    content = content.replace(old, "")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Removed unused totalItems variable")
else:
    print("❌ Could not find totalItems variable to remove")
    # Debug: show what's around the area
    import re
    m = re.search(r'totalItems', content)
    if m:
        print(f"  Found totalItems at position {m.start()}, context: {content[max(0,m.start()-50):m.end()+50]}")
    else:
        print("  totalItems not found at all in file")

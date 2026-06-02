# -*- coding: utf-8 -*-
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

path = r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = '      entry.count++;\n      entry.products.add(d.product);'
new = '      entry.count += d.qty;\n      entry.products.add(d.product);'

if old in content:
    content = content.replace(old, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("OK - Changed entry.count++ to entry.count += d.qty")
else:
    print("FAIL - Could not find old text")
    # Try to find the exact text
    idx = content.find('entry.count++')
    if idx >= 0:
        print(f"Found 'entry.count++' at position {idx}")
        print(f"Context: {repr(content[idx:idx+80])}")

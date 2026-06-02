# -*- coding: utf-8 -*-
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

path = r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Try \n line endings
old_header = '<h3 className="text-[16px] font-semibold">\n                  {summaryModal === "products" && "All Products"}\n                  {summaryModal === "ingredients" && "Ingredients Needed"}\n                  {summaryModal === "packaging" && "Packaging Materials"}\n                  {summaryModal === "deco" && "Decoration Supplies"}\n                </h3>'
new_header = '<h3 className="text-[16px] font-semibold">Recipe Formula</h3>'

if old_header in content:
    content = content.replace(old_header, new_header)
    print("OK - Modal header updated to 'Recipe Formula' (with \\n)")
else:
    print("FAIL with \\n, trying \\r\\n...")
    old_header2 = '<h3 className="text-[16px] font-semibold">\r\n                  {summaryModal === "products" && "All Products"}\r\n                  {summaryModal === "ingredients" && "Ingredients Needed"}\r\n                  {summaryModal === "packaging" && "Packaging Materials"}\r\n                  {summaryModal === "deco" && "Decoration Supplies"}\r\n                </h3>'
    if old_header2 in content:
        content = content.replace(old_header2, new_header)
        print("OK - Modal header updated to 'Recipe Formula' (with \\r\\n)")
    else:
        print("FAIL - Could not find old header with either line ending")
        # Read the actual content around that area
        idx = content.find('summaryModal === "products"')
        if idx >= 0:
            segment = content[idx-150:idx+250]
            print(f"Context around match:\n{repr(segment)}")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("\nOK - File saved successfully")

import re

filepath = "src/App.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Fix the Cake Boxes quote issue - the file contains literal Cake Boxes (8")
# with no backslash before the quote
old = 'Cake Boxes (8") 1000pcs + Bread Bags 500pcs'
new = "Cake Boxes (8\") 1000pcs + Bread Bags 500pcs"

count = content.count(old)
print(f"Found {count} occurrences of the unescaped quote string")

if count > 0:
    content = content.replace(old, "Cake Boxes (8 inch) 1000pcs + Bread Bags 500pcs")

# Also check for the inventory item with Cake Boxes (8\") - properly escaped version
# The line 214 has: name: "Cake Boxes (8\")" which should be fine in TS
# But let's check if there's an unescaped version
unescaped_inv = 'name: "Cake Boxes (8")"'
if unescaped_inv in content:
    print(f"Found unescaped inventory item too!")
    content = content.replace(unescaped_inv, 'name: "Cake Boxes (8\\")"')

with open(filepath, "w", encoding="utf-8", newline="\n") as f:
    f.write(content)

print("Done")

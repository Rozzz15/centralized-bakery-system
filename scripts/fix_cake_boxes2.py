import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = "C:/Users/Admin/Desktop/Businesses/CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM/src/App.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all instances of "Cake Boxes (8")" with "Cake Boxes (8 in)"
count = content.count('Cake Boxes (8")')
print(f"Found {count} instances of 'Cake Boxes (8\"')")

content = content.replace('Cake Boxes (8")', "Cake Boxes (8 in)")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed all Cake Boxes references")

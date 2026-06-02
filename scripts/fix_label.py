# -*- coding: utf-8 -*-
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

path = r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Try with \r\n
count1 = content.count('Ingredients Needed')
print(f"Found '{'Ingredients Needed'}' {count1} time(s)")

content = content.replace('Ingredients Needed', 'Recipe Needed')
count2 = content.count('Recipe Needed')
print(f"Now '{'Recipe Needed'}' appears {count2} time(s)")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")

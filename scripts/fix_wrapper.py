import re

path = r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Find the problematic section - return ({validRecipes.map(r => (
# It should be return (<div ...>{validRecipes.map(...)}</div>)

# Find the broken pattern
old = """                                return (
                                    {validRecipes.map(r => ("""

new = """                                return (
                                  <div className=\"flex flex-wrap gap-3\">
                                    {validRecipes.map(r => ("""

if old in content:
    content = content.replace(old, new, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed: restored wrapper div")
else:
    print("Pattern not found, trying alternative...")
    # Check the current state
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'validRecipes.map(r => (' in line and i > 0 and 'return (' in lines[i-1]:
            print(f"Found at line {i+1}: {line[:80]}")
            # Add the wrapper div
            lines[i-1] = lines[i-1] + "\n                                  <div className=\"flex flex-wrap gap-3\">"
            new_content = '\n'.join(lines)
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_content)
            print("Fixed: restored wrapper div (alt method)")
            break

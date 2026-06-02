import re

path = r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Find the exact block by looking for the marker lines
lines = content.splitlines(keepends=True)

# Find the start marker line index
start_marker = "                                      const isPrimary = r.productName === d.product;"
start_idx = None
for i, line in enumerate(lines):
    if start_marker in line:
        start_idx = i
        break

if start_idx is None:
    print("ERROR: marker not found")
    exit(1)

# The block to replace starts at the line with "{validRecipes.map(r => {" (2 lines before)
block_start = start_idx - 2  # {validRecipes.map(r => {

# The block ends after the badge spans and closing
# Find `);` line after the </div> for the chip
end_idx = None
for i in range(start_idx, len(lines)):
    stripped = lines[i].strip()
    if stripped == ");" and i > start_idx + 5:
        # Check if this is the ) closing the return inside .map()
        # The next line should have }) or )}
        if i + 1 < len(lines) and ('})' in lines[i+1] or ')}' in lines[i+1]):
            end_idx = i + 1  # include the }) line
            break

if end_idx is None:
    print("ERROR: could not find end of .map() block")
    exit(1)

# Extract the old block
old_block_lines = lines[block_start:end_idx+1]
old_block = "".join(old_block_lines)

print(f"Found block from line {block_start+1} to {end_idx+1}")
print(f"Old block:\n{old_block}")

# Build new block - simplified map without badge span
new_block = [
    "                                    {validRecipes.map(r => (\n",
    '                                      <div key={r.productName} className="inline-flex items-center rounded-xl bg-white border border-zinc-200 px-3.5 py-2 hover:border-zinc-400 hover:shadow-sm transition-all">\n',
    '                                        <span className="text-[13px] font-medium text-zinc-900">{r.productName}</span>\n',
    "                                      </div>\n",
    "                                    ))}\n",
]

new_block_str = "".join(new_block)

print(f"New block:\n{new_block_str}")

# Replace in content
new_content = content.replace(old_block, new_block_str, 1)

if new_content == content:
    print("ERROR: no replacement made")
    exit(1)

with open(path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("SUCCESS: badges removed!")

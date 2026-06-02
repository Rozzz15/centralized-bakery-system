import re
import os

filepath = "src/App.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Fix the syntax error: "Cake Boxes (8\")" -> "Cake Boxes (8 inch)"
content = content.replace(
    'Cake Boxes (8\\") 1000pcs',
    "Cake Boxes (8 inch) 1000pcs"
)

# Remove the unused demoSupabaseId variable
content = content.replace(
    "    const demoSupabaseId = crypto.randomUUID();\n",
    "    // "
)

# Now move the finance seed code from after the inventory early return to after the recipe seeding
# The current structure is:
#   // Seed recipes independently...
#   const existing = await db.fetchAllInventory();
#   if (existing.length > 0) return;
#   ... inventory/DOS seed ...
#   // Product catalog ...
#   // Finance seed data HERE (currently unreachable)
# }

# We need to move the finance seed to be RIGHT AFTER recipe seeding, BEFORE the inventory check

# Find the finance seed block in the code
finance_start_marker = "  // Finance seed data"
finance_end_marker = "  }"

# Find the finance block
finance_start = content.find(finance_start_marker)
if finance_start == -1:
    # Try with different indentation
    finance_start = content.find("  // Finance seed data")

# Find where the block ends - after the await Promise.all([...]) block
finance_block_end = -1
if finance_start >= 0:
    # Find the closing } of the if block that wraps finance seeding
    # We need to find:
    #   const existingPurchases = await db.fetchPurchases();
    #   if (existingPurchases.length === 0) {
    #     ... data ...
    #     await Promise.all([...]);
    #   }
    #   }
    # The first } closes the if, the second } would be seedIfEmpty's closing brace
    
    # Let's find the "if (existingPurchases.length === 0) {" and match braces
    if_pos = content.find("if (existingPurchases.length === 0)", finance_start)
    if if_pos >= 0:
        # Find the opening brace after if (...)
        brace_start = content.find("{", if_pos)
        if brace_start >= 0:
            # Match braces to find the closing }
            depth = 1
            pos = brace_start + 1
            while depth > 0 and pos < len(content):
                if content[pos] == '{':
                    depth += 1
                elif content[pos] == '}':
                    depth -= 1
                pos += 1
            # pos is now after the closing } of the if block
            # The finance block ends at pos
            finance_block_end = pos
            
            # Extract the finance block (including comments)
            finance_block = content[finance_start:finance_block_end]
            print(f"Found finance block at {finance_start}..{finance_block_end}")
            print(f"Block length: {len(finance_block)}")
            print(f"First line: {finance_block.split(chr(10))[0]}")
            print(f"Last line: {finance_block.split(chr(10))[-1]}")
            
            # Find the position to insert: after the recipe seeding but before inventory check
            # Look for: "const existing = await db.fetchAllInventory();"
            inv_check_pos = content.find("const existing = await db.fetchAllInventory();")
            if inv_check_pos >= 0:
                # Insert before this line but after the blank line
                # Find the beginning of the line
                line_start = content.rfind("\n", 0, inv_check_pos) + 1
                
                # Remove the finance block from its current position
                content_no_finance = content[:finance_start] + content[finance_block_end:]
                
                # Insert at the target position
                new_content = content_no_finance[:line_start] + "\n" + finance_block + "\n" + content_no_finance[line_start:]
                
                with open(filepath, "w", encoding="utf-8", newline="\n") as f:
                    f.write(new_content)
                
                print("SUCCESS: Moved finance seed code before inventory check")
            else:
                print("ERROR: Could not find inventory check")
    else:
        print("ERROR: Could not find 'if (existingPurchases.length === 0)'")
else:
    print("ERROR: Could not find finance seed block")

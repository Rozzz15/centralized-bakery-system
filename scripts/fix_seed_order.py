#!/usr/bin/env python3
"""Fix seed logic - demo data must be defined before being referenced."""

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Current broken section:
old_block = (
    '  if (existingPurchases.length === 0) {\n'
    '    const [existingBills, existingRevenue, existingWaste] = await Promise.all([db.fetchBillsAndDues(), db.fetchRevenue(), db.fetchWasteLog()]);\n'
    '    const seedPromises: Promise<void>[] = [];\n'
    '    if (existingPurchases.length === 0) seedPromises.push(db.upsertPurchases(demoPurchases));\n'
    '    if (existingBills.length === 0) seedPromises.push(db.upsertBillsAndDues(demoBills));\n'
    '    if (existingRevenue.length === 0) seedPromises.push(db.upsertRevenue(demoRevenue));\n'
    '    if (existingWaste.length === 0) seedPromises.push(db.upsertWasteLog(demoWaste));\n'
    '    if (seedPromises.length > 0) await Promise.all(seedPromises);\n'
    '    //     const now = new Date().toISOString();'
)

# Fixed section - hoist demo data before the upsert logic
new_block = (
    '  if (existingPurchases.length === 0) {\n'
    '    const [existingBills, existingRevenue, existingWaste] = await Promise.all([db.fetchBillsAndDues(), db.fetchRevenue(), db.fetchWasteLog()]);\n'
    '    //     const now = new Date().toISOString();'
)

# Also need to restructure the rest - let's replace the entire section from the seed check to the Promise.all

if old_block in content:
    content = content.replace(old_block, new_block, 1)
    print("OK - Fixed seed section start")
else:
    print("WARN - Could not find old block")
    # Print what's there
    idx = content.find('existingPurchases.length === 0')
    if idx >= 0:
        print(content[idx:idx+500])

# Now move the demo data definitions and seed logic. The current position of `const demoPurchases` 
# is right after the broken `// const now...` comment. We need to move the upsert logic 
# from BEFORE the demo data definitions to AFTER them.

# The current structure (after our fix):
#   if (existingPurchases.length === 0) {
#     const [existingBills, ...] = await Promise.all([...]);
#     //     const now = ...
#     const demoPurchases = [...];  // <-- definitions start here
#     const demoBills = [...];
#     const demoRevenue = [...];
#     const demoWaste = [...];
#     await Promise.all([...upserts...]);  // <-- old original upsert
#   }
#
# We need to add the independent seed logic AFTER the definitions but BEFORE the old Promise.all

# Find the old Promise.all upsert and replace it with the independent version
old_upsert = (
    '    await Promise.all([\n'
    '      db.upsertPurchases(demoPurchases),\n'
    '      db.upsertBillsAndDues(demoBills),\n'
    '      db.upsertRevenue(demoRevenue),\n'
    '      db.upsertWasteLog(demoWaste),\n'
    '    ]);'
)

new_upsert = (
    '    const seedPromises: Promise<void>[] = [];\n'
    '    if (existingPurchases.length === 0) seedPromises.push(db.upsertPurchases(demoPurchases));\n'
    '    if (existingBills.length === 0) seedPromises.push(db.upsertBillsAndDues(demoBills));\n'
    '    if (existingRevenue.length === 0) seedPromises.push(db.upsertRevenue(demoRevenue));\n'
    '    if (existingWaste.length === 0) seedPromises.push(db.upsertWasteLog(demoWaste));\n'
    '    if (seedPromises.length > 0) await Promise.all(seedPromises);'
)

if old_upsert in content:
    content = content.replace(old_upsert, new_upsert, 1)
    print("OK - Replaced old upsert with independent seed logic")
else:
    print("WARN - Could not find old upsert")
    idx = content.find('upsertPurchases(demoPurchases)')
    if idx >= 0:
        print(f"  Found at {idx}: {repr(content[idx-50:idx+100])}")

# Also need to fix a leftover double-space issue from the old replacement
content = content.replace('//     const now', '// const now')

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Done! File size: {len(content)} chars")

import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = "C:/Users/Admin/Desktop/Businesses/CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM/src/App.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the structure:
# async function seedIfEmpty() {
#   const existing = await db.fetchAllInventory();
#   if (existing.length > 0) return;
#   ...
#   // Demo recipes
#   const demoRecipes: ProductRecipe[] = [...];
#   await Promise.all(demoRecipes.map(r => db.upsertRecipe(r)));
# }

# We need to:
# 1. Find and REMOVE the demo recipes block from its current location
# 2. INSERT a recipe check right after the function opening brace, before inventory check

# Step 1: Remove demo recipes block
start_marker = "  // Demo recipes\n  const demoRecipes: ProductRecipe[] = [\n"
end_marker = "  await Promise.all(demoRecipes.map(r => db.upsertRecipe(r)));\n"

start_idx = content.find(start_marker)
if start_idx >= 0:
    end_idx = content.find(end_marker, start_idx)
    if end_idx >= 0:
        block_len = end_idx + len(end_marker) - start_idx
        # Remove the demo recipes block
        content = content[:start_idx] + content[start_idx + block_len:]
        print(f"✅ Removed demo recipes block ({block_len} chars)")
    else:
        print("❌ Could not find end marker")
else:
    print("❌ Could not find start marker")
    # Debug
    idx = content.find("// Demo recipes")
    if idx >= 0:
        print(f"  Found '// Demo recipes' at {idx}")
        print(f"  Context: {content[idx:idx+200]}")

# Step 2: Insert recipe check after the function opening and before the inventory check
insert_before = "  const existing = await db.fetchAllInventory();\n  if (existing.length > 0) return;\n"

recipe_check = """  // Seed recipes independently (even if inventory already exists)
  const existingRecipes = await db.fetchRecipes();
  if (existingRecipes.length === 0) {
    const demoRecipes: ProductRecipe[] = [
      {
        productId: "Pandesal",
        productName: "Pandesal",
        ingredients: [
          { name: "Bread Flour", qtyPerBatch: 10, unit: "kg" },
          { name: "Granulated Sugar", qtyPerBatch: 1.5, unit: "kg" },
          { name: "Eggs (Grade A)", qtyPerBatch: 2, unit: "trays" },
          { name: "Unsalted Butter", qtyPerBatch: 1, unit: "kg" },
          { name: "Fresh Milk", qtyPerBatch: 3, unit: "L" },
          { name: "Vanilla Extract", qtyPerBatch: 100, unit: "ml" },
        ],
        packaging: [{ name: "Bread Bags (Small)", qtyPerBatch: 500, unit: "pcs" }],
        decoration: [],
        linkedProduct: [],
        notes: "Standard pandesal recipe - yields ~500 pcs per batch",
      },
      {
        productId: "Loaf Bread",
        productName: "Loaf Bread",
        ingredients: [
          { name: "Bread Flour", qtyPerBatch: 15, unit: "kg" },
          { name: "Granulated Sugar", qtyPerBatch: 2, unit: "kg" },
          { name: "Unsalted Butter", qtyPerBatch: 1.5, unit: "kg" },
          { name: "Eggs (Grade A)", qtyPerBatch: 3, unit: "trays" },
          { name: "Fresh Milk", qtyPerBatch: 5, unit: "L" },
        ],
        packaging: [{ name: "Bread Bags (Large)", qtyPerBatch: 200, unit: "pcs" }],
        decoration: [],
        linkedProduct: [],
        notes: "Classic loaf bread - yields ~200 loaves per batch",
      },
      {
        productId: "Choco Moist Cake",
        productName: "Choco Moist Cake",
        ingredients: [
          { name: "Bread Flour", qtyPerBatch: 5, unit: "kg" },
          { name: "Cocoa Powder", qtyPerBatch: 1.5, unit: "kg" },
          { name: "Granulated Sugar", qtyPerBatch: 4, unit: "kg" },
          { name: "Unsalted Butter", qtyPerBatch: 2, unit: "kg" },
          { name: "Eggs (Grade A)", qtyPerBatch: 4, unit: "trays" },
          { name: "Fresh Milk", qtyPerBatch: 3, unit: "L" },
          { name: "Vanilla Extract", qtyPerBatch: 50, unit: "ml" },
        ],
        packaging: [{ name: "Cake Boxes (8 in)", qtyPerBatch: 50, unit: "pcs" }],
        decoration: [{ name: "Whipping Cream", qtyPerBatch: 2, unit: "L" }],
        linkedProduct: [],
        notes: "Rich chocolate cake - yields ~50 cakes per batch",
      },
      {
        productId: "Sponge Fudge",
        productName: "Sponge Fudge",
        ingredients: [
          { name: "Bread Flour", qtyPerBatch: 4, unit: "kg" },
          { name: "Cocoa Powder", qtyPerBatch: 2, unit: "kg" },
          { name: "Granulated Sugar", qtyPerBatch: 5, unit: "kg" },
          { name: "Unsalted Butter", qtyPerBatch: 3, unit: "kg" },
          { name: "Eggs (Grade A)", qtyPerBatch: 5, unit: "trays" },
          { name: "Fresh Milk", qtyPerBatch: 2, unit: "L" },
        ],
        packaging: [{ name: "Cake Boxes (8 in)", qtyPerBatch: 40, unit: "pcs" }],
        decoration: [{ name: "Whipping Cream", qtyPerBatch: 3, unit: "L" }],
        linkedProduct: [],
        notes: "Dense fudge sponge - yields ~40 cakes per batch",
      },
      {
        productId: "Ensaymada",
        productName: "Ensaymada",
        ingredients: [
          { name: "Bread Flour", qtyPerBatch: 8, unit: "kg" },
          { name: "Granulated Sugar", qtyPerBatch: 2.5, unit: "kg" },
          { name: "Unsalted Butter", qtyPerBatch: 3, unit: "kg" },
          { name: "Eggs (Grade A)", qtyPerBatch: 6, unit: "trays" },
          { name: "Fresh Milk", qtyPerBatch: 2, unit: "L" },
        ],
        packaging: [{ name: "Pastry Boxes", qtyPerBatch: 120, unit: "pcs" }],
        decoration: [{ name: "Whipping Cream", qtyPerBatch: 1, unit: "L" }],
        linkedProduct: [],
        notes: "Classic ensaymada - yields ~120 pcs per batch",
      },
    ];
    await Promise.all(demoRecipes.map(r => db.upsertRecipe(r)));
  }

"""

if insert_before in content:
    content = content.replace(insert_before, recipe_check + insert_before)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Inserted independent recipe seeding before inventory check")
else:
    print("❌ Could not find insert marker")
    # Debug
    idx = content.find("const existing = await db.fetchAllInventory")
    if idx >= 0:
        print(f"  Found at {idx}")
        print(f"  Context: {content[idx:idx+100]}")
    else:
        print("  Marker not found")

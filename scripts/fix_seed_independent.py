import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = "C:/Users/Admin/Desktop/Businesses/CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM/src/App.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the demo recipes block and wrap it so it runs independently of the inventory check
# The current code structure is:
# async function seedIfEmpty() {
#   const existing = await db.fetchAllInventory();
#   if (existing.length > 0) return;   <-- This skips ALL seeding including recipes
#   ... demo inventory, DOS, production ...
#   // Demo recipes
#   const demoRecipes = [...];
#   await Promise.all(demoRecipes.map(r => db.upsertRecipe(r)));
# }

# We need to move the recipe seeding OUTSIDE the inventory check
# Let me find the marker

old = """  // Demo recipes
  const demoRecipes: ProductRecipe[] = [
    {
      productId: "Pandesal",
      productName: "Pandesal","""

# Find where demo recipes start
idx = content.find("  // Demo recipes")
if idx >= 0:
    # Find the closing of the recipe seeding
    # It ends with:   await Promise.all(demoRecipes.map(r => db.upsertRecipe(r)));
    closing = content.find("  await Promise.all(demoRecipes.map(r => db.upsertRecipe(r)));")
    if closing >= 0:
        # Extract the full demo recipes block
        end_of_block = closing + len("  await Promise.all(demoRecipes.map(r => db.upsertRecipe(r)));")
        demo_recipes_block = content[idx:end_of_block]
        
        # Remove it from its current location
        content = content[:idx] + content[end_of_block:]
        
        # Find the end of seedIfEmpty function (the closing })
        # It's right after: if (catErr && !catErr.message.includes("duplicate")) console.error("seed catalog error:", catErr);\n}
        seed_end_marker = """  if (catErr && !catErr.message.includes("duplicate")) console.error("seed catalog error:", catErr);\n}"""
        seed_end_idx = content.find(seed_end_marker)
        if seed_end_idx >= 0:
            # Insert the recipe seeding AFTER seedIfEmpty, as a separate function
            # Insert before the closing } of seedIfEmpty to run independently
            insert_pos = seed_end_idx + len(seed_end_marker) - 1  # before the last }
            
            recipe_seed_code = """
  // Demo recipes (seed independently from inventory)
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
        packaging: [
          { name: "Bread Bags (Small)", qtyPerBatch: 500, unit: "pcs" },
        ],
        decoration: [],
        linkedProduct: [],
        notes: "Standard pandesal recipe — yields ~500 pcs per batch",
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
        packaging: [
          { name: "Bread Bags (Large)", qtyPerBatch: 200, unit: "pcs" },
        ],
        decoration: [],
        linkedProduct: [],
        notes: "Classic loaf bread — yields ~200 loaves per batch",
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
        packaging: [
          { name: "Cake Boxes (8 in)", qtyPerBatch: 50, unit: "pcs" },
        ],
        decoration: [
          { name: "Whipping Cream", qtyPerBatch: 2, unit: "L" },
        ],
        linkedProduct: [],
        notes: "Rich chocolate cake — yields ~50 cakes per batch",
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
        packaging: [
          { name: "Cake Boxes (8 in)", qtyPerBatch: 40, unit: "pcs" },
        ],
        decoration: [
          { name: "Whipping Cream", qtyPerBatch: 3, unit: "L" },
        ],
        linkedProduct: [],
        notes: "Dense fudge sponge — yields ~40 cakes per batch",
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
        packaging: [
          { name: "Pastry Boxes", qtyPerBatch: 120, unit: "pcs" },
        ],
        decoration: [
          { name: "Whipping Cream", qtyPerBatch: 1, unit: "L" },
        ],
        linkedProduct: [],
        notes: "Classic ensaymada — yields ~120 pcs per batch",
      },
    ];
    await Promise.all(demoRecipes.map(r => db.upsertRecipe(r)));
  }"""
            
            content = content[:insert_pos] + recipe_seed_code + content[insert_pos:]
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print("✅ Moved recipe seeding to be independent from inventory check")
        else:
            print("❌ Could not find seedIfEmpty closing")
    else:
        print("❌ Could not find recipe closing")
else:
    print("❌ Could not find demo recipes block")

import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = "C:/Users/Admin/Desktop/Businesses/CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM/src/App.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# The marker to insert after - the product catalog seeding block ends
# We'll insert demo recipes right after the product catalog seeding
insert_marker = """  // Product catalog
  const products = ["Pandesal", "Loaf Bread", "Choco Moist Cake", "Sponge Fudge", "Ensaymada"];
  const { error: catErr } = await supabase.from("product_catalog").insert(products.map(n => ({ name: n })));
  if (catErr && !catErr.message.includes("duplicate")) console.error("seed catalog error:", catErr);"""

recipe_block = """  // Demo recipes
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
        { name: "Cake Boxes (8\")", qtyPerBatch: 50, unit: "pcs" },
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
        { name: "Cake Boxes (8\")", qtyPerBatch: 40, unit: "pcs" },
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
  await Promise.all(demoRecipes.map(r => db.upsertRecipe(r)));"""

new_marker = insert_marker + "\n" + recipe_block

if insert_marker in content:
    content = content.replace(insert_marker, new_marker)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Added demo recipes to seedIfEmpty()")
else:
    print("❌ Could not find the insert marker")
    # Debug
    idx = content.find("const products =")
    if idx >= 0:
        print(f"  Found 'const products =' at {idx}")
        print(f"  Context: {content[idx:idx+400]}")
    else:
        print("  'const products =' not found")

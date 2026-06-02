// Run with: node scripts/cleanup_duplicate_recipes.mjs
// Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to be set in environment

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanup() {
  // Step 1: Fetch all recipes
  const { data: recipes, error } = await supabase.from("recipes").select("*").order("created_at", { ascending: false });
  if (error) { console.error("Failed to fetch recipes:", error); process.exit(1); }

  console.log(`Total recipes: ${recipes.length}`);

  // Step 2: Group by name, find duplicates
  const grouped = new Map();
  for (const r of recipes) {
    if (!grouped.has(r.name)) grouped.set(r.name, []);
    grouped.get(r.name).push(r);
  }

  let totalDeleted = 0;
  for (const [name, rows] of grouped) {
    if (rows.length <= 1) continue;
    console.log(`\n"${name}" — ${rows.length} duplicates`);

    // Keep the most recent one
    const [keeper, ...duplicates] = rows;

    // Update product_recipe_links to point to the keeper
    const dupIds = duplicates.map(d => d.id);
    const { error: linkErr } = await supabase
      .from("product_recipe_links")
      .update({ recipe_id: keeper.id })
      .in("recipe_id", dupIds);

    if (linkErr) console.error(`  Failed to update links for "${name}":`, linkErr);
    else console.log(`  Updated ${dupIds.length} product_recipe_links to point to keeper`);

    // Delete duplicates
    const { error: delErr } = await supabase
      .from("recipes")
      .delete()
      .in("id", dupIds);

    if (delErr) console.error(`  Failed to delete duplicates for "${name}":`, delErr);
    else {
      console.log(`  Deleted ${dupIds.length} duplicate rows`);
      totalDeleted += dupIds.length;
    }
  }

  console.log(`\n=== Cleanup complete! ===`);
  console.log(`Deleted ${totalDeleted} duplicate recipe rows.`);

  // Step 3: Add unique constraint on name (if possible via JS API)
  // The Supabase JS client can't run DDL, but we'll note it in the migration file
  console.log(`\nNote: To prevent future duplicates, run the SQL migration:`);
  console.log(`  supabase/migrations/00027_cleanup_duplicate_recipes.sql`);
  console.log(`Or manually add: ALTER TABLE recipes ADD CONSTRAINT recipes_name_unique UNIQUE (name);`);
}

cleanup().catch(console.error);

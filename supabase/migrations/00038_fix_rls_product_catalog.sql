-- Fix RLS for product_catalog and product_categories tables

-- Enable RLS on product_categories (created after initial RLS setup)
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Ensure product_catalog RLS is enabled
ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DO $$
BEGIN
  -- product_categories policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_categories' AND policyname = 'authenticated_all_product_categories'
  ) THEN
    CREATE POLICY "authenticated_all_product_categories" ON product_categories
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  -- product_catalog policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_catalog' AND policyname = 'authenticated_all_product_catalog'
  ) THEN
    CREATE POLICY "authenticated_all_product_catalog" ON product_catalog
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  -- recipes policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'recipes' AND policyname = 'authenticated_all_recipes'
  ) THEN
    CREATE POLICY "authenticated_all_recipes" ON recipes
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  -- product_recipe_links policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_recipe_links' AND policyname = 'authenticated_all_product_recipe_links'
  ) THEN
    CREATE POLICY "authenticated_all_product_recipe_links" ON product_recipe_links
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

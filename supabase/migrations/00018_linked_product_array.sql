-- Convert linked_product from text to jsonb array so a recipe can be linked to multiple products
ALTER TABLE product_recipes
  ALTER COLUMN linked_product DROP DEFAULT;

ALTER TABLE product_recipes
  ALTER COLUMN linked_product TYPE jsonb
  USING CASE
    WHEN linked_product = '' THEN '[]'::jsonb
    ELSE jsonb_build_array(linked_product)
  END;

ALTER TABLE product_recipes
  ALTER COLUMN linked_product SET DEFAULT '[]'::jsonb;
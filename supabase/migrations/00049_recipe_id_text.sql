-- Change recipes.id from uuid to text to support custom human-readable IDs like "RCP-XXXX"
-- Existing UUID values are preserved as text.

-- 1. Drop the FK constraint that references recipes(id)
alter table if exists product_recipe_links
  drop constraint if exists product_recipe_links_recipe_id_fkey;

-- 2. Drop PK constraint on recipes.id (needed before altering the column type)
alter table if exists recipes
  drop constraint if exists recipes_pkey;

-- 3. Change the column type on the child table first
alter table if exists product_recipe_links
  alter column recipe_id type text;

-- 4. Change recipes.id from uuid to text, drop the uuid default
alter table if exists recipes
  alter column id type text,
  alter column id drop default;

-- 5. Restore PK constraint on recipes.id
alter table if exists recipes
  add primary key (id);

-- 6. Restore FK constraint on product_recipe_links
alter table if exists product_recipe_links
  add foreign key (recipe_id) references recipes(id) on delete cascade;

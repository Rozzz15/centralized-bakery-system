-- Clean up duplicate recipe rows caused by missing id in upsert operations
-- Keeps only the most recent row per unique recipe name

-- Step 1: For each duplicate recipe name, update product_recipe_links to point
-- to the row with the latest created_at (the "keeper")
do $$
declare
  r record;
  keeper_id uuid;
begin
  -- Find all names that have duplicates
  for r in
    select name
    from recipes
    group by name
    having count(*) > 1
  loop
    -- Get the id of the most recently created row for this name
    select id into keeper_id
    from recipes
    where name = r.name
    order by created_at desc
    limit 1;

    -- Update any product_recipe_links pointing to duplicate rows to point to the keeper
    update product_recipe_links
    set recipe_id = keeper_id
    where recipe_id in (
      select id from recipes
      where name = r.name and id != keeper_id
    );
  end loop;
end $$;

-- Step 2: Delete duplicate rows (keep the most recent one for each name)
delete from recipes r1
using recipes r2
where r1.name = r2.name
  and r1.created_at < r2.created_at;

-- Step 3: Add a unique constraint on name to prevent future duplicates
-- (remove duplicates first if any remain)
delete from recipes a
using recipes b
where a.name = b.name
  and a.id != b.id
  and a.created_at <= b.created_at;

-- Now safe to add the unique constraint
alter table recipes add constraint recipes_name_unique unique (name);

-- Step 4: Also add a unique constraint on product_catalog name if not already present
alter table product_catalog add constraint product_catalog_name_unique unique (name);

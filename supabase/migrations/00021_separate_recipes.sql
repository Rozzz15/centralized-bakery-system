-- Separate recipes from product_catalog: give recipes their own identity
-- so products and recipes are independent entities linked via a join table.

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ingredients jsonb not null default '[]',
  packaging_materials jsonb not null default '[]',
  decoration_supplies jsonb not null default '[]',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists product_recipe_links (
  product_name text not null,
  recipe_id uuid not null references recipes(id) on delete cascade,
  primary key (product_name, recipe_id)
);

-- Drop FK on product_name if it was created by a previous migration attempt
do $$
declare
  fk record;
begin
  for fk in
    select con.conname
    from pg_catalog.pg_constraint con
    join pg_catalog.pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'product_recipe_links'
      and con.contype = 'f'
      and con.confrelid = (select oid from pg_catalog.pg_class where relname = 'product_catalog')
  loop
    execute 'alter table product_recipe_links drop constraint ' || fk.conname;
  end loop;
end $$;

-- Clear any partially-migrated data from a previous failed run
truncate table product_recipe_links;
truncate table recipes cascade;

do $$
declare
  r record;
  new_id uuid;
begin
  for r in select * from product_recipes loop
    new_id := gen_random_uuid();
    insert into recipes (id, name, ingredients, packaging_materials, decoration_supplies, notes)
    values (new_id, r.product_name, r.ingredients, r.packaging_materials, r.decoration_supplies, coalesce(r.notes, ''));

    -- link recipe to its own product (only if product exists in catalog)
    insert into product_recipe_links (product_name, recipe_id)
    select r.product_name, new_id
    where exists (select 1 from product_catalog where name = r.product_name)
    on conflict do nothing;

    -- link to linked products (only if those products exist in catalog)
    if r.linked_product is not null and jsonb_array_length(r.linked_product) > 0 then
      insert into product_recipe_links (product_name, recipe_id)
      select value::text, new_id
      from jsonb_array_elements_text(r.linked_product)
      where exists (select 1 from product_catalog pc where pc.name = value::text)
      on conflict do nothing;
    end if;
  end loop;
end $$;
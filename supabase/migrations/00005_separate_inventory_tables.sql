-- BakeFlow ERP — Separate Inventory Tables
-- Creates dedicated tables for each inventory group, preserving the original
-- inventory_items table for backward compatibility.

-- 0. Add group column to legacy inventory_items table if it doesn't exist
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'inventory_items' and column_name = 'group') then
    alter table inventory_items add column "group" text not null default 'ingredients';
  end if;
end $$;

-- 0b. Also add expiry_date if missing (migration 00003 should have added it, but be safe)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'inventory_items' and column_name = 'expiry_date') then
    alter table inventory_items add column expiry_date text default null;
  end if;
end $$;

-- 1. Ingredients
create table if not exists ingredients (
  id text primary key,
  name text not null,
  sku text not null default '',
  unit text not null default '',
  on_hand integer not null default 0,
  threshold integer not null default 0,
  cost numeric not null default 0,
  supplier text not null default '',
  last_in text not null default '',
  category text not null default 'dry' check (category in ('dry', 'dairy', 'produce', 'packaging')),
  expiry_date text default null,
  updated_at timestamptz default now()
);

-- 2. Packaging Materials
create table if not exists packaging_materials (
  id text primary key,
  name text not null,
  sku text not null default '',
  unit text not null default '',
  on_hand integer not null default 0,
  threshold integer not null default 0,
  cost numeric not null default 0,
  supplier text not null default '',
  last_in text not null default '',
  category text not null default 'packaging' check (category in ('dry', 'dairy', 'produce', 'packaging')),
  expiry_date text default null,
  updated_at timestamptz default now()
);

-- 3. Decoration Supplies
create table if not exists decoration_supplies (
  id text primary key,
  name text not null,
  sku text not null default '',
  unit text not null default '',
  on_hand integer not null default 0,
  threshold integer not null default 0,
  cost numeric not null default 0,
  supplier text not null default '',
  last_in text not null default '',
  category text not null default 'dry' check (category in ('dry', 'dairy', 'produce', 'packaging')),
  expiry_date text default null,
  updated_at timestamptz default now()
);

-- 4. Operational Supplies
create table if not exists operational_supplies (
  id text primary key,
  name text not null,
  sku text not null default '',
  unit text not null default '',
  on_hand integer not null default 0,
  threshold integer not null default 0,
  cost numeric not null default 0,
  supplier text not null default '',
  last_in text not null default '',
  category text not null default 'dry' check (category in ('dry', 'dairy', 'produce', 'packaging')),
  expiry_date text default null,
  updated_at timestamptz default now()
);

-- Migrate data from inventory_items (if any) into the new tables
insert into ingredients (id, name, sku, unit, on_hand, threshold, cost, supplier, last_in, category, expiry_date, updated_at)
select id, name, sku, unit, on_hand, threshold, cost, supplier, last_in, category, expiry_date, updated_at
from inventory_items
where coalesce(inventory_items.group, 'ingredients') = 'ingredients'
on conflict (id) do nothing;

insert into packaging_materials (id, name, sku, unit, on_hand, threshold, cost, supplier, last_in, category, expiry_date, updated_at)
select id, name, sku, unit, on_hand, threshold, cost, supplier, last_in, category, expiry_date, updated_at
from inventory_items
where coalesce(inventory_items.group, '') = 'packaging-materials'
on conflict (id) do nothing;

insert into decoration_supplies (id, name, sku, unit, on_hand, threshold, cost, supplier, last_in, category, expiry_date, updated_at)
select id, name, sku, unit, on_hand, threshold, cost, supplier, last_in, category, expiry_date, updated_at
from inventory_items
where coalesce(inventory_items.group, '') = 'decoration-supplies'
on conflict (id) do nothing;

insert into operational_supplies (id, name, sku, unit, on_hand, threshold, cost, supplier, last_in, category, expiry_date, updated_at)
select id, name, sku, unit, on_hand, threshold, cost, supplier, last_in, category, expiry_date, updated_at
from inventory_items
where coalesce(inventory_items.group, '') = 'operational-supplies'
on conflict (id) do nothing;

-- Enable RLS on all new tables
alter table ingredients enable row level security;
alter table packaging_materials enable row level security;
alter table decoration_supplies enable row level security;
alter table operational_supplies enable row level security;

-- RLS policies: authenticated users can read/write all
do $$
declare
  tbl text;
begin
  for tbl in select unnest(array['ingredients','packaging_materials','decoration_supplies','operational_supplies']) loop
    execute format('create policy "authenticated_all_%I" on %I for all to authenticated using (true) with check (true);', tbl, tbl);
  end loop;
end $$;
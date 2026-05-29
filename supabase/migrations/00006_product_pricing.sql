-- Product Pricing table
create table if not exists product_pricing (
  id text primary key,
  product_name text not null,
  category text not null default '',
  estimated_cost numeric not null default 0,
  selling_price numeric not null default 0,
  wholesale_price numeric not null default 0,
  profit_margin numeric not null default 0,
  status text not null default 'draft' check (status in ('active', 'draft', 'archived')),
  variants jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table product_pricing enable row level security;

-- Allow all operations for authenticated users
create policy "Allow all for authenticated" on product_pricing for all using (auth.role() = 'authenticated');
create policy "Allow all for anon" on product_pricing for all using (true);

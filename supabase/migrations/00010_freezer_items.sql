-- Freezer / Finished Product Inventory
create table if not exists freezer_items (
  id text primary key,
  product_name text not null,
  qty integer not null default 0,
  unit text not null default 'pcs',
  batch_ref text not null default '',
  produced_by text not null default '',
  date_produced text not null default '',
  status text not null default 'stored' check (status in ('stored', 'dispatched', 'expired')),
  notes text default '',
  created_at timestamptz default now()
);

-- Enable RLS
alter table freezer_items enable row level security;

create policy "Allow all for authenticated" on freezer_items for all using (auth.role() = 'authenticated');
create policy "Allow all for anon" on freezer_items for all using (true);

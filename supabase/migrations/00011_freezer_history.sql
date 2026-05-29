-- Freezer History
create table if not exists freezer_history (
  id text primary key,
  product_name text not null,
  produced_by text not null default '',
  qty_changed integer not null default 0,
  action text not null default '',
  reference text not null default '',
  timestamp text not null default ''
);

alter table freezer_history enable row level security;
create policy "Allow all for authenticated" on freezer_history for all using (auth.role() = 'authenticated');
create policy "Allow all for anon" on freezer_history for all using (true);

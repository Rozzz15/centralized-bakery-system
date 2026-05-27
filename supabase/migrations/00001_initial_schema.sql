-- BakeFlow ERP — Supabase Schema
-- Run this in the Supabase SQL Editor to set up all tables and RLS policies.

-- 0. Extensions
create extension if not exists "pgcrypto";

-- 1. Profiles (linked to auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  role text not null check (role in ('admin', 'baker', 'deco', 'kitchen', 'branch')),
  created_at timestamptz default now()
);

-- 2. Inventory Items
create table if not exists inventory_items (
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
  updated_at timestamptz default now()
);

-- 3. DOS Items
create table if not exists dos_items (
  id text primary key,
  product text not null,
  qty integer not null default 0,
  branch1 integer not null default 0,
  branch2 integer not null default 0,
  priority text not null default 'MEDIUM' check (priority in ('HIGH', 'MEDIUM', 'LOW')),
  status text not null default 'pending' check (status in ('pending', 'in-progress', 'completed')),
  updated_at timestamptz default now()
);

-- 4. Production Tasks
create table if not exists production_tasks (
  id text primary key,
  product text not null,
  target integer not null default 0,
  completed integer not null default 0,
  assigned_to text not null check (assigned_to in ('baker', 'deco', 'kitchen')),
  status text not null default 'pending' check (status in ('pending', 'in-progress', 'completed')),
  updated_at timestamptz default now()
);

-- 5. Deliveries
create table if not exists deliveries (
  id text primary key,
  branch text not null,
  items jsonb not null default '[]',
  status text not null default 'preparing' check (status in ('preparing', 'in-transit', 'delivered')),
  eta text not null default '',
  updated_at timestamptz default now()
);

-- 6. Audit Logs
create table if not exists audit_logs (
  id text primary key,
  timestamp text not null,
  "user" text not null default '',
  role text not null default '',
  action text not null default '',
  details text not null default ''
);

-- 7. Product Catalog
create table if not exists product_catalog (
  id serial primary key,
  name text not null unique
);

-- 8. Product Recipes
create table if not exists product_recipes (
  product_id text primary key,
  product_name text not null,
  ingredients jsonb not null default '[]'
);

-- 9. Material Requests (Baker)
create table if not exists baker_ingredient_requests (
  id text primary key,
  items jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'pending-approval', 'approved', 'released')),
  created_at text not null default ''
);

-- 10. Material Requests (Deco)
create table if not exists material_requests (
  id text primary key,
  items jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'pending-approval', 'approved', 'released')),
  created_at text not null default ''
);

-- 11. Stock Transactions
create table if not exists stock_transactions (
  id text primary key,
  type text not null check (type in ('in', 'out')),
  item_name text not null default '',
  item_id text not null default '',
  qty integer not null default 0,
  unit text not null default '',
  reference text not null default '',
  timestamp text not null default '',
  target text default null
);

-- 12. Delivery Validations
create table if not exists delivery_validations (
  id text primary key,
  report_id text not null default '',
  branch text not null default '',
  items jsonb not null default '[]',
  status text not null default 'validated' check (status in ('validated', 'posted')),
  timestamp text not null default ''
);

-- 13. Verification Results
create table if not exists verification_results (
  id text primary key default gen_random_uuid()::text,
  task_id text not null,
  product text not null default '',
  source text not null default '',
  qty_received integer not null default 0,
  qty_passed integer not null default 0,
  qty_rejected integer not null default 0,
  quality_ok boolean default true,
  consistency_ok boolean default true,
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected'))
);

-- 14. Branch Batches
create table if not exists branch_batches (
  id text primary key,
  branch text not null,
  items jsonb not null default '[]',
  status text not null default 'consolidating' check (status in ('consolidating', 'packaged', 'dispatched'))
);

-- 15. Delivery Reports
create table if not exists delivery_reports (
  id text primary key,
  batch_id text not null default '',
  branch text not null default '',
  items jsonb not null default '[]',
  created_at text not null default '',
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved')),
  total_output integer not null default 0,
  batch_ref text not null default ''
);

-- 16. Kitchen Feedback
create table if not exists kitchen_feedback (
  id text primary key,
  product text not null default '',
  issue text not null default '',
  severity text not null default 'minor' check (severity in ('minor', 'major', 'critical')),
  reported_at text not null default '',
  resolved boolean default false
);

-- 17. Deco Sub Tasks
create table if not exists deco_sub_tasks (
  id text primary key,
  product text not null default '',
  batch_count integer not null default 0,
  assigned_to text not null default '',
  status text not null default 'pending' check (status in ('pending', 'in-progress', 'completed')),
  dos_ref text not null default ''
);

-- 18. Deco QC Results
create table if not exists deco_qc_results (
  batch_id text primary key,
  product text not null default '',
  batch_count_ok boolean default true,
  ingredient_usage_ok boolean default true,
  decoration_consistent boolean default true,
  notes text not null default '',
  status text not null default 'passed' check (status in ('passed', 'failed'))
);

-- =====================
-- RLS (Row Level Security)
-- =====================

-- Helper: enable RLS on all tables
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'profiles','inventory_items','dos_items','production_tasks','deliveries',
      'audit_logs','product_catalog','product_recipes','baker_ingredient_requests',
      'material_requests','stock_transactions','delivery_validations',
      'verification_results','branch_batches','delivery_reports',
      'kitchen_feedback','deco_sub_tasks','deco_qc_results'
    ])
  loop
    execute format('alter table %I enable row level security;', tbl);
  end loop;
end $$;

-- Policy: authenticated users can read/write all tables
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'inventory_items','dos_items','production_tasks','deliveries',
      'audit_logs','product_catalog','product_recipes','baker_ingredient_requests',
      'material_requests','stock_transactions','delivery_validations',
      'verification_results','branch_batches','delivery_reports',
      'kitchen_feedback','deco_sub_tasks','deco_qc_results'
    ])
  loop
    execute format('
      create policy "authenticated_all_%I" on %I
        for all
        to authenticated
        using (true)
        with check (true);
    ', tbl, tbl);
  end loop;
end $$;

-- Profiles: users can read all profiles, but only update their own
create policy "profiles_read_all" on profiles for select to authenticated using (true);
create policy "profiles_insert_own" on profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on profiles for update to authenticated using (id = auth.uid());

-- Auto-create profile on signup via trigger
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, '', 'branch');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================
-- Default Accounts
-- =====================
-- Creates one account per role (admin has 2) so non-techy users can just click and sign in.

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  t.email,
  crypt(t.password, gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('display_name', t.display_name, 'role', t.role),
  now(),
  now(),
  '',
  '',
  '',
  ''
from (values
  ('admin1@bakeflow.com',   'Admin@123',  'Admin 1',  'admin'),
  ('admin2@bakeflow.com',   'Admin@123',  'Admin 2',  'admin'),
  ('baker@bakeflow.com',    'Baker@123',  'Baker',    'baker'),
  ('deco@bakeflow.com',     'Deco@123',   'Deco',     'deco'),
  ('kitchen@bakeflow.com',  'Kitchen@123','Kitchen',  'kitchen'),
  ('branch@bakeflow.com',   'Branch@123', 'Branch',   'branch')
) as t(email, password, display_name, role)
where not exists (select 1 from auth.users where auth.users.email = t.email);

-- Create identities so the users can sign in with email provider
insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  now(),
  now(),
  now()
from auth.users u
where u.email in ('admin1@bakeflow.com','admin2@bakeflow.com','baker@bakeflow.com','deco@bakeflow.com','kitchen@bakeflow.com','branch@bakeflow.com')
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

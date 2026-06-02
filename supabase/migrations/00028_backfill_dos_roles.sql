-- Backfill roles for existing DOS items that have empty roles
-- This ensures old items show proper Assigned To in the Scheduled DOS table

-- First, add the column if it somehow doesn't exist (safe, uses if not exists)
alter table dos_items add column if not exists roles text[] default '{}';

-- Backfill: for scheduled items with empty roles, default to all three production teams
update dos_items
set roles = array['baker', 'pastry', 'deco']
where (roles is null or roles = '{}')
  and status = 'scheduled';

-- For pending/in-progress items with empty roles, also backfill
update dos_items
set roles = array['baker', 'pastry', 'deco']
where (roles is null or roles = '{}')
  and status in ('pending', 'in-progress');

-- For completed items with empty roles, defaults
update dos_items
set roles = array['baker', 'pastry', 'deco']
where (roles is null or roles = '{}');

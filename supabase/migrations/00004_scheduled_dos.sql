-- Add 'scheduled' status and scheduled_date to dos_items
-- First find and drop any existing status check constraint
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'dos_items'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%status%'
  loop
    execute 'alter table dos_items drop constraint ' || constraint_name;
  end loop;
end $$;

-- Recreate with scheduled included
alter table dos_items add constraint dos_items_status_check
  check (status in ('pending', 'in-progress', 'completed', 'scheduled'));

-- Add scheduled_date column
alter table dos_items add column if not exists scheduled_date text;

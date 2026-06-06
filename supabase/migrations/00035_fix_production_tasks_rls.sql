-- Fix RLS policy for production_tasks table
-- The baker role needs INSERT/UPDATE permission to save production task completions

-- Ensure RLS is enabled on the table
alter table production_tasks enable row level security;

-- Drop any existing policy to avoid conflicts
drop policy if exists "authenticated_all_production_tasks" on production_tasks;

-- Create a policy that allows all authenticated users to read/write
create policy "authenticated_all_production_tasks" on production_tasks
  for all
  to authenticated
  using (true)
  with check (true);

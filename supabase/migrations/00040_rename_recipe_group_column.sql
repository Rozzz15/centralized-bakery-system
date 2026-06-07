-- Drop the old restrictive check constraint on the group column and ensure recipe_group exists
DO $$
BEGIN
  -- Drop check constraint if it exists (from old "group" column migration)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'recipes_group_check'
  ) THEN
    ALTER TABLE recipes DROP CONSTRAINT recipes_group_check;
  END IF;
END $$;

-- Ensure recipe_group column exists
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS recipe_group TEXT NOT NULL DEFAULT '';

-- Add group column to recipes table (used for "filling" recipes)
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS "group" TEXT NOT NULL DEFAULT '';

-- Add yield column to recipes table
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS yield INTEGER;

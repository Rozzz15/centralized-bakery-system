-- Add size column to ingredients table
-- Used by Baker-sent items to Deco Inventory to track product size

ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS size text DEFAULT NULL;

-- Add source column to all inventory tables
-- Tracks where the inventory item came from (e.g., 'production-prep' for items
-- created from the Deco Production Prep -> Put in My Inventory flow).

ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS source text DEFAULT NULL;
ALTER TABLE packaging_materials ADD COLUMN IF NOT EXISTS source text DEFAULT NULL;
ALTER TABLE decoration_supplies ADD COLUMN IF NOT EXISTS source text DEFAULT NULL;
ALTER TABLE operational_supplies ADD COLUMN IF NOT EXISTS source text DEFAULT NULL;

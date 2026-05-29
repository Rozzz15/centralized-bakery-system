-- Add access_roles column to all inventory tables
-- This controls which roles can see/use each inventory item

ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS access_roles text[] DEFAULT '{}';
ALTER TABLE packaging_materials ADD COLUMN IF NOT EXISTS access_roles text[] DEFAULT '{}';
ALTER TABLE decoration_supplies ADD COLUMN IF NOT EXISTS access_roles text[] DEFAULT '{}';
ALTER TABLE operational_supplies ADD COLUMN IF NOT EXISTS access_roles text[] DEFAULT '{}';

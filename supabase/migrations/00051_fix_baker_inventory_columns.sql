-- Fix: ensure all columns needed by "From Baker" inventory exist
-- Run this in Supabase SQL Editor if items aren't saving

-- access_roles column
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS access_roles text[] DEFAULT '{}';
ALTER TABLE decoration_supplies ADD COLUMN IF NOT EXISTS access_roles text[] DEFAULT '{}';
ALTER TABLE packaging_materials ADD COLUMN IF NOT EXISTS access_roles text[] DEFAULT '{}';
ALTER TABLE operational_supplies ADD COLUMN IF NOT EXISTS access_roles text[] DEFAULT '{}';

-- source column
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS source text DEFAULT NULL;
ALTER TABLE decoration_supplies ADD COLUMN IF NOT EXISTS source text DEFAULT NULL;
ALTER TABLE packaging_materials ADD COLUMN IF NOT EXISTS source text DEFAULT NULL;
ALTER TABLE operational_supplies ADD COLUMN IF NOT EXISTS source text DEFAULT NULL;

-- size column
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS size text DEFAULT NULL;
ALTER TABLE decoration_supplies ADD COLUMN IF NOT EXISTS size text DEFAULT NULL;
ALTER TABLE packaging_materials ADD COLUMN IF NOT EXISTS size text DEFAULT NULL;
ALTER TABLE operational_supplies ADD COLUMN IF NOT EXISTS size text DEFAULT NULL;

-- Update category CHECK constraints to allow product categories
ALTER TABLE ingredients DROP CONSTRAINT IF EXISTS ingredients_category_check;
ALTER TABLE ingredients ADD CONSTRAINT ingredients_category_check CHECK (category IN ('dry', 'dairy', 'produce', 'packaging', 'Cakes', 'Breads', 'Pastries', 'Fillings', 'Frostings', 'Toppings', 'Decorations', 'Packaging'));

ALTER TABLE decoration_supplies DROP CONSTRAINT IF EXISTS decoration_supplies_category_check;
ALTER TABLE decoration_supplies ADD CONSTRAINT decoration_supplies_category_check CHECK (category IN ('dry', 'dairy', 'produce', 'packaging', 'Cakes', 'Breads', 'Pastries', 'Fillings', 'Frostings', 'Toppings', 'Decorations', 'Packaging'));

ALTER TABLE packaging_materials DROP CONSTRAINT IF EXISTS packaging_materials_category_check;
ALTER TABLE packaging_materials ADD CONSTRAINT packaging_materials_category_check CHECK (category IN ('dry', 'dairy', 'produce', 'packaging', 'Cakes', 'Breads', 'Pastries', 'Fillings', 'Frostings', 'Toppings', 'Decorations', 'Packaging'));

ALTER TABLE operational_supplies DROP CONSTRAINT IF EXISTS operational_supplies_category_check;
ALTER TABLE operational_supplies ADD CONSTRAINT operational_supplies_category_check CHECK (category IN ('dry', 'dairy', 'produce', 'packaging', 'Cakes', 'Breads', 'Pastries', 'Fillings', 'Frostings', 'Toppings', 'Decorations', 'Packaging'));

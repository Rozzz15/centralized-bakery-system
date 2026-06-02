ALTER TABLE product_recipes ADD COLUMN IF NOT EXISTS packaging_materials jsonb NOT NULL DEFAULT '[]';
ALTER TABLE product_recipes ADD COLUMN IF NOT EXISTS decoration_supplies jsonb NOT NULL DEFAULT '[]';

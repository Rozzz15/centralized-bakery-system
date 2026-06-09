-- Add default_role column to product_catalog for product routing
-- This determines which team (baker/deco/pastry) a product is primarily routed to

ALTER TABLE product_catalog
  ADD COLUMN IF NOT EXISTS default_role text
  CHECK (default_role IN ('baker', 'deco', 'pastry'))
  DEFAULT NULL;

COMMENT ON COLUMN product_catalog.default_role IS 'Default production team assignment: baker, deco, or pastry. Used to auto-select role in DOS Builder.';

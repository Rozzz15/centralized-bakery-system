ALTER TABLE product_recipes ADD COLUMN IF NOT EXISTS linked_product text NOT NULL DEFAULT '';

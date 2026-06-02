CREATE TABLE product_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

ALTER TABLE product_catalog ADD COLUMN category TEXT REFERENCES product_categories(name);
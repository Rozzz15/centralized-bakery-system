-- Production Calculation Engine: buffer_stock table
CREATE TABLE IF NOT EXISTS buffer_stock (
  id TEXT PRIMARY KEY,
  recipe_name TEXT NOT NULL,
  product_name TEXT,
  qty NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  source TEXT NOT NULL DEFAULT 'production-plan',
  batch_ref TEXT,
  date_created DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  used_in TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE buffer_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to buffer_stock"
  ON buffer_stock FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_buffer_stock_recipe ON buffer_stock (recipe_name);
CREATE INDEX IF NOT EXISTS idx_buffer_stock_status ON buffer_stock (status);
CREATE INDEX IF NOT EXISTS idx_buffer_stock_date ON buffer_stock (date_created);

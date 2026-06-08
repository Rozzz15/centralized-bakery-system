-- Production Calculation Engine: production_plans table
CREATE TABLE IF NOT EXISTS production_plans (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  dos_items JSONB NOT NULL DEFAULT '[]',
  recipe_demands JSONB NOT NULL DEFAULT '[]',
  batch_calculations JSONB NOT NULL DEFAULT '[]',
  output_allocations JSONB NOT NULL DEFAULT '[]',
  buffer_stock_created JSONB NOT NULL DEFAULT '[]',
  buffer_stock_used JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

-- RLS policies
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to production_plans"
  ON production_plans FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_production_plans_date ON production_plans (date);
CREATE INDEX IF NOT EXISTS idx_production_plans_status ON production_plans (status);

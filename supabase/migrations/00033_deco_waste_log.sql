-- Deco Waste/Adjustment Log
CREATE TABLE IF NOT EXISTS deco_waste_log (
  id TEXT PRIMARY KEY,
  product_name TEXT NOT NULL DEFAULT '',
  qty NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT '',
  source_id TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE deco_waste_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deco_waste_log' AND policyname='Allow all for authenticated') THEN
    CREATE POLICY "Allow all for authenticated" ON deco_waste_log FOR ALL USING (auth.role()='authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deco_waste_log' AND policyname='Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON deco_waste_log FOR ALL USING (true);
  END IF;
END $$;

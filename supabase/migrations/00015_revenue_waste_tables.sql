-- Revenue table (branch sales + delivery income)
CREATE TABLE IF NOT EXISTS revenue (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'manual',
  particular TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  date TEXT NOT NULL DEFAULT '',
  mode_of_payment TEXT NOT NULL DEFAULT 'cash',
  reference_id TEXT NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Waste log table (kitchen rejections = lost cost)
CREATE TABLE IF NOT EXISTS waste_log (
  id TEXT PRIMARY KEY,
  product TEXT NOT NULL DEFAULT '',
  qty_rejected INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  reference_id TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_log ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='revenue' AND policyname='Allow all for authenticated') THEN
    CREATE POLICY "Allow all for authenticated" ON revenue FOR ALL USING (auth.role()='authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='revenue' AND policyname='Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON revenue FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waste_log' AND policyname='Allow all for authenticated') THEN
    CREATE POLICY "Allow all for authenticated" ON waste_log FOR ALL USING (auth.role()='authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waste_log' AND policyname='Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON waste_log FOR ALL USING (true);
  END IF;
END $$;

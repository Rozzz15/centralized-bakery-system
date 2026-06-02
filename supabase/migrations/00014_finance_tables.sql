-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  supplier_name TEXT NOT NULL DEFAULT '',
  mode_of_payment TEXT NOT NULL DEFAULT 'cash',
  date_delivered TEXT NOT NULL DEFAULT '',
  particular TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL DEFAULT '',
  released_date TEXT NOT NULL DEFAULT '',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  remarks TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bills & Dues table
CREATE TABLE IF NOT EXISTS bills_and_dues (
  id TEXT PRIMARY KEY,
  due_date TEXT NOT NULL DEFAULT '',
  particular TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  mode_of_payment TEXT NOT NULL DEFAULT 'cash',
  remarks TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  category TEXT NOT NULL DEFAULT 'miscellaneous',
  branch TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills_and_dues ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchases' AND policyname = 'Allow all for authenticated') THEN
    CREATE POLICY "Allow all for authenticated" ON purchases FOR ALL USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchases' AND policyname = 'Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON purchases FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bills_and_dues' AND policyname = 'Allow all for authenticated') THEN
    CREATE POLICY "Allow all for authenticated" ON bills_and_dues FOR ALL USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bills_and_dues' AND policyname = 'Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON bills_and_dues FOR ALL USING (true);
  END IF;
END $$;

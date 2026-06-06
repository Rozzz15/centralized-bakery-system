-- Create promos_packages table
CREATE TABLE IF NOT EXISTS promos_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'promo' CHECK (type IN ('promo', 'package')),
  items JSONB NOT NULL DEFAULT '[]',
  original_price NUMERIC(10,2) DEFAULT 0,
  promo_price NUMERIC(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  start_date TEXT,
  end_date TEXT,
  created_at TEXT DEFAULT (now() AT TIME ZONE 'Asia/Manila')::TEXT
);

-- Enable RLS
ALTER TABLE promos_packages ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Allow read access" ON promos_packages FOR SELECT USING (true);

-- Allow admin to manage
CREATE POLICY "Allow admin insert" ON promos_packages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin update" ON promos_packages FOR UPDATE USING (true);
CREATE POLICY "Allow admin delete" ON promos_packages FOR DELETE USING (true);

-- Create consumables table for tracking consumable supplies
CREATE TABLE IF NOT EXISTS consumables (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  on_hand INTEGER NOT NULL DEFAULT 0,
  threshold INTEGER NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT NOT NULL DEFAULT '',
  last_in TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'dry' CHECK (category IN ('dry', 'dairy', 'produce', 'packaging')),
  expiry_date TEXT DEFAULT NULL,
  access_roles TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE consumables ENABLE ROW LEVEL SECURITY;

-- RLS policy: authenticated users can read/write all
CREATE POLICY "authenticated_all_consumables" ON consumables FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE consumables;

-- Create equipment table for tracking bakery equipment with purchase details
CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date_purchased TEXT NOT NULL DEFAULT '',
  cost_price NUMERIC NOT NULL DEFAULT 0,
  sku TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read equipment
CREATE POLICY "Anyone can read equipment"
  ON equipment FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to insert equipment
CREATE POLICY "Anyone can insert equipment"
  ON equipment FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow all authenticated users to update equipment
CREATE POLICY "Anyone can update equipment"
  ON equipment FOR UPDATE
  TO authenticated
  USING (true);

-- Allow all authenticated users to delete equipment
CREATE POLICY "Anyone can delete equipment"
  ON equipment FOR DELETE
  TO authenticated
  USING (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE equipment;

-- Create batch_inventory table for tracking pans of baked goods with piece counts
CREATE TABLE IF NOT EXISTS batch_inventory (
  id TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  total_pieces INTEGER NOT NULL DEFAULT 0,
  remaining_pieces INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  pieces_per_pan INTEGER NOT NULL DEFAULT 20,
  date_produced TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'stored' CHECK (status IN ('stored', 'used', 'expired')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE batch_inventory ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read batch inventory
CREATE POLICY "Anyone can read batch_inventory"
  ON batch_inventory FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to insert batch inventory
CREATE POLICY "Anyone can insert batch_inventory"
  ON batch_inventory FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow all authenticated users to update batch inventory
CREATE POLICY "Anyone can update batch_inventory"
  ON batch_inventory FOR UPDATE
  TO authenticated
  USING (true);

-- Allow all authenticated users to delete batch inventory
CREATE POLICY "Anyone can delete batch_inventory"
  ON batch_inventory FOR DELETE
  TO authenticated
  USING (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE batch_inventory;

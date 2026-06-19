-- Create repair_history table for tracking multiple repair dates per equipment
CREATE TABLE IF NOT EXISTS repair_history (
  id TEXT PRIMARY KEY,
  equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  repair_date TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE repair_history ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read repair records
CREATE POLICY "Anyone can read repair_history"
  ON repair_history FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to insert repair records
CREATE POLICY "Anyone can insert repair_history"
  ON repair_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow all authenticated users to delete repair records
CREATE POLICY "Anyone can delete repair_history"
  ON repair_history FOR DELETE
  TO authenticated
  USING (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE repair_history;

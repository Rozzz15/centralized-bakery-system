-- Create bakery_tools table for tracking bakery tools with purchase details
CREATE TABLE IF NOT EXISTS bakery_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date_purchased TEXT NOT NULL DEFAULT '',
  date_repaired TEXT NOT NULL DEFAULT '',
  cost_price NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  notes TEXT NOT NULL DEFAULT '',
  on_hand INTEGER NOT NULL DEFAULT 0,
  threshold INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE bakery_tools ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read bakery tools
CREATE POLICY "Anyone can read bakery_tools"
  ON bakery_tools FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to insert bakery tools
CREATE POLICY "Anyone can insert bakery_tools"
  ON bakery_tools FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow all authenticated users to update bakery tools
CREATE POLICY "Anyone can update bakery_tools"
  ON bakery_tools FOR UPDATE
  TO authenticated
  USING (true);

-- Allow all authenticated users to delete bakery tools
CREATE POLICY "Anyone can delete bakery_tools"
  ON bakery_tools FOR DELETE
  TO authenticated
  USING (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE bakery_tools;

-- Create tool_repair_history table for tracking multiple repair dates per tool
CREATE TABLE IF NOT EXISTS tool_repair_history (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL REFERENCES bakery_tools(id) ON DELETE CASCADE,
  repair_date TEXT NOT NULL,
  repair_cost NUMERIC NOT NULL DEFAULT 0,
  remarks TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE tool_repair_history ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read tool repair records
CREATE POLICY "Anyone can read tool_repair_history"
  ON tool_repair_history FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to insert tool repair records
CREATE POLICY "Anyone can insert tool_repair_history"
  ON tool_repair_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow all authenticated users to delete tool repair records
CREATE POLICY "Anyone can delete tool_repair_history"
  ON tool_repair_history FOR DELETE
  TO authenticated
  USING (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE tool_repair_history;

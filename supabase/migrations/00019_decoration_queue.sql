-- Decoration Queue table (persistent tasks for the deco kanban board)
CREATE TABLE IF NOT EXISTS decoration_queue (
  id TEXT PRIMARY KEY,
  product TEXT NOT NULL,
  order_ref TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'Standard',
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT NOT NULL DEFAULT '',
  freezer_item_id TEXT,
  source_qty INTEGER DEFAULT 1,
  source_batch_ref TEXT DEFAULT '',
  source_produced_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE decoration_queue ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='decoration_queue' AND policyname='Allow all for authenticated') THEN
    CREATE POLICY "Allow all for authenticated" ON decoration_queue FOR ALL USING (auth.role()='authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='decoration_queue' AND policyname='Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON decoration_queue FOR ALL USING (true);
  END IF;
END $$;

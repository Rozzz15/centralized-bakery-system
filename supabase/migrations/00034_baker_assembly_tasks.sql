-- Baker Assembly Tasks — tracks Advanced Premix assembly to DOS products
CREATE TABLE IF NOT EXISTS baker_assembly_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  dos_id TEXT REFERENCES dos_items(id),
  dos_qty NUMERIC NOT NULL DEFAULT 0,
  premix_item_id TEXT NOT NULL REFERENCES freezer_items(id),
  premix_qty_used NUMERIC NOT NULL DEFAULT 0,
  qty_assembled NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  assembled_by TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE baker_assembly_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='baker_assembly_tasks' AND policyname='Allow all for authenticated') THEN
    CREATE POLICY "Allow all for authenticated" ON baker_assembly_tasks FOR ALL USING (auth.role()='authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='baker_assembly_tasks' AND policyname='Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON baker_assembly_tasks FOR ALL USING (true);
  END IF;
END $$;

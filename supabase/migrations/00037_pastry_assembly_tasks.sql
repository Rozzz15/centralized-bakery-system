-- Pastry Assembly Tasks — tracks promo/package assembly and normal product packaging
CREATE TABLE IF NOT EXISTS pastry_assembly_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dos_id TEXT,
  promo_id TEXT,
  product_name TEXT NOT NULL,
  promo_type TEXT NOT NULL DEFAULT 'package'
    CHECK (promo_type IN ('promo', 'package', 'normal')),
  components JSONB NOT NULL DEFAULT '[]',
  target_qty INTEGER NOT NULL DEFAULT 0,
  assembled_qty INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
  assembled_by TEXT NOT NULL DEFAULT '',
  qc_checklist JSONB DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pastry_assembly_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pastry_assembly_tasks' AND policyname='Allow all for authenticated') THEN
    CREATE POLICY "Allow all for authenticated" ON pastry_assembly_tasks FOR ALL USING (auth.role()='authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pastry_assembly_tasks' AND policyname='Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON pastry_assembly_tasks FOR ALL USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read app_state"
  ON app_state FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can upsert app_state"
  ON app_state FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated can update app_state"
  ON app_state FOR UPDATE TO authenticated USING (true);

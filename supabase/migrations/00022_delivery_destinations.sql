CREATE TABLE IF NOT EXISTS delivery_destinations (
  name TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE delivery_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read delivery_destinations"
  ON delivery_destinations FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert delivery_destinations"
  ON delivery_destinations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated can delete delivery_destinations"
  ON delivery_destinations FOR DELETE TO authenticated USING (true);

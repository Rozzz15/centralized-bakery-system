ALTER TABLE decoration_queue
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB;

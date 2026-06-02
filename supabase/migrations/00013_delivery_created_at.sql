-- Add created_at to deliveries for analytics date filtering
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

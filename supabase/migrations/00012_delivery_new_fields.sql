-- Add new fields to deliveries table
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS contact_number text NOT NULL DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS assigned_rider text NOT NULL DEFAULT '';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'cod'));
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';

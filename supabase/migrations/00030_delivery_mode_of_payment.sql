-- Add mode_of_payment column to deliveries table
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS mode_of_payment TEXT NOT NULL DEFAULT 'cash';

-- Update existing rows to have a value
UPDATE deliveries SET mode_of_payment = 'cash' WHERE mode_of_payment IS NULL;

-- Add group column to stock_transactions
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS group_name text NOT NULL DEFAULT '';

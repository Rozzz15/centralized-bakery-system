-- Add role column to stock_transactions to track who initiated the transaction
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS role text DEFAULT '';

-- Add index for role-based queries
CREATE INDEX IF NOT EXISTS idx_stock_transactions_role ON stock_transactions(role);

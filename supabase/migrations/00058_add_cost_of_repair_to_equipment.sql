-- Add repair_cost and remarks columns to repair_history table
ALTER TABLE repair_history ADD COLUMN repair_cost NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE repair_history ADD COLUMN remarks TEXT NOT NULL DEFAULT '';

-- Add ingredients JSONB column to freezer_items for storing recipe ingredient details
ALTER TABLE freezer_items ADD COLUMN IF NOT EXISTS ingredients jsonb DEFAULT NULL;

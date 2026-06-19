-- Add date_repaired column to equipment table
ALTER TABLE equipment ADD COLUMN date_repaired TEXT NOT NULL DEFAULT '';

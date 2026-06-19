-- Relax category CHECK constraints on all inventory tables
-- The UI manages valid categories per group; DB constraint was too restrictive

DO $$
DECLARE
  tbl TEXT;
  constraint_name TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['ingredients','packaging_materials','decoration_supplies','operational_supplies','consumables']) LOOP
    -- Find the auto-generated check constraint name for the category column
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = tbl
      AND con.contype = 'c'
      AND pg_get_expr(con.conbin, con.conrelid) LIKE '%category%';

    IF constraint_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', tbl, constraint_name);
    END IF;
  END LOOP;
END $$;

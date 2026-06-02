-- Add roles array column to dos_items to persist production team selections
alter table dos_items add column if not exists roles text[] default '{}';

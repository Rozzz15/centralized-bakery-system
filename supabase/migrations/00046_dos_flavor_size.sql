-- Add flavor and size columns to dos_items table
alter table dos_items add column if not exists flavor text;
alter table dos_items add column if not exists size text;

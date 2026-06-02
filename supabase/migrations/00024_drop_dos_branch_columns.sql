-- Remove branch1/branch2 columns from dos_items (replaced by single qty)
alter table dos_items drop column if exists branch1;
alter table dos_items drop column if exists branch2;

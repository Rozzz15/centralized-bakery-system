-- Add customer details columns to dos_items table
-- For Customer Name, Pickup/Delivery Time, Contact Number, Date of Event, Layers

ALTER TABLE dos_items ADD COLUMN IF NOT EXISTS customer_name text DEFAULT NULL;
ALTER TABLE dos_items ADD COLUMN IF NOT EXISTS pickup_delivery_time text DEFAULT NULL;
ALTER TABLE dos_items ADD COLUMN IF NOT EXISTS contact_number text DEFAULT NULL;
ALTER TABLE dos_items ADD COLUMN IF NOT EXISTS date_of_event text DEFAULT NULL;
ALTER TABLE dos_items ADD COLUMN IF NOT EXISTS layers text DEFAULT NULL;

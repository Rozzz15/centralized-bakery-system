-- Add customization fields to dos_items for cake design details
ALTER TABLE dos_items
  ADD COLUMN IF NOT EXISTS theme_occasion text,
  ADD COLUMN IF NOT EXISTS color_scheme text,
  ADD COLUMN IF NOT EXISTS cake_design_notes text,
  ADD COLUMN IF NOT EXISTS topper text,
  ADD COLUMN IF NOT EXISTS reference_image text,
  ADD COLUMN IF NOT EXISTS message_caption text;

-- Create storage bucket for reference images
INSERT INTO storage.buckets (id, name, public) VALUES ('reference-images', 'reference-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public to view images
CREATE POLICY "reference_images_select" ON storage.objects FOR SELECT USING (bucket_id = 'reference-images');
-- Allow any user to upload images
CREATE POLICY "reference_images_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reference-images');
-- Allow any user to delete their uploads
CREATE POLICY "reference_images_delete" ON storage.objects FOR DELETE USING (bucket_id = 'reference-images');

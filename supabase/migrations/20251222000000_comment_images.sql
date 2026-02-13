-- 1. Add image_url column to comments table
ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Create Storage Bucket 'comment-images'
INSERT INTO storage.buckets (id, name, public)
VALUES ('comment-images', 'comment-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies
DROP POLICY IF EXISTS "Public can view comment images" ON storage.objects;
CREATE POLICY "Public can view comment images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'comment-images' );

DROP POLICY IF EXISTS "Authenticated users can upload comment images" ON storage.objects;
CREATE POLICY "Authenticated users can upload comment images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'comment-images' 
  AND auth.role() = 'authenticated'
);

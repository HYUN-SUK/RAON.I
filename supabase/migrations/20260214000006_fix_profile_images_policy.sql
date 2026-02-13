-- 1. Ensure Bucket Exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile_images', 'profile_images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop potential conflicting policies for profile_images
DROP POLICY IF EXISTS "Public Access Profile Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Profile Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Profile Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Profile Images" ON storage.objects;

-- 3. Re-create Policies precisely
-- Public Read
CREATE POLICY "Public Access Profile Images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'profile_images' );

-- Authenticated Upload (Must match folder structure if needed, or allow all for 'hero/')
CREATE POLICY "Authenticated Upload Profile Images"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'profile_images' AND auth.role() = 'authenticated' );

-- Authenticated Update
CREATE POLICY "Authenticated Update Profile Images"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'profile_images' AND auth.role() = 'authenticated' );

-- Authenticated Delete
CREATE POLICY "Authenticated Delete Profile Images"
ON storage.objects FOR DELETE
USING ( bucket_id = 'profile_images' AND auth.role() = 'authenticated' );

-- 4. Verify Profiles Table Policy (Just in case)
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile."
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

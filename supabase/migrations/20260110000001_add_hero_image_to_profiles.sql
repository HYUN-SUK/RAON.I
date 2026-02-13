-- Add hero_image_url column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS hero_image_url TEXT;

-- Comment for documentation
COMMENT ON COLUMN public.profiles.hero_image_url IS 'URL of the user customized hero background image';

-- Ensure it's updatable by the user (Policies usually cover "all" updates for owner, but good to double check if you have column-level security, which is rare for this setup)
-- Assuming existing RLS policy "Users can update their own profile" covers this new column.

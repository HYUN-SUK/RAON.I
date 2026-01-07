-- Add personalization columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS family_type text, -- 'solo', 'couple', 'family', 'with_pet'
ADD COLUMN IF NOT EXISTS interests text[]; -- ['cooking', 'activity', 'relax']

-- Comment on columns
COMMENT ON COLUMN public.profiles.family_type IS 'User camping style: solo, couple, family, with_pet';
COMMENT ON COLUMN public.profiles.interests IS 'User interests tags for personalization';

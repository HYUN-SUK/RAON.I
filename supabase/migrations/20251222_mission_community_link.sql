-- Add community_post_id to missions table to link to the weekly mission post
ALTER TABLE public.missions 
ADD COLUMN IF NOT EXISTS community_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;

-- Policy update NOT needed as missions are already readable by everyone, 
-- and the post itself is governed by posts policies (public/admin).

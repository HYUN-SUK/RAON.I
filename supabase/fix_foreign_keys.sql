-- FIX: Enforce CASCADE DELETE on Foreign Keys
-- The deletion failure is likely due to 'comments' or 'likes' tables referencing 'posts' 
-- WITHOUT the 'ON DELETE CASCADE' option in the live database.

-- 1. Comments Table
ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_post_id_fkey, -- Standard name
  DROP CONSTRAINT IF EXISTS comments_post_id_fkey1; -- Potential auto-generated name

-- Re-add with CASCADE
ALTER TABLE public.comments
  ADD CONSTRAINT comments_post_id_fkey
  FOREIGN KEY (post_id)
  REFERENCES public.posts(id)
  ON DELETE CASCADE;

-- 2. Likes Table
ALTER TABLE public.likes
  DROP CONSTRAINT IF EXISTS likes_post_id_fkey;

-- Re-add with CASCADE
ALTER TABLE public.likes
  ADD CONSTRAINT likes_post_id_fkey
  FOREIGN KEY (post_id)
  REFERENCES public.posts(id)
  ON DELETE CASCADE;

-- 3. Verify Constraints (Optional)
-- SELECT constraint_name, delete_rule 
-- FROM information_schema.referential_constraints 
-- WHERE constraint_name IN ('comments_post_id_fkey', 'likes_post_id_fkey');

-- EMERGENCY DEBUG: Simplify Delete Policy to identify the blocker
-- This policy allows ANY authenticated user to delete ANY post.
-- USE ONLY FOR DEBUGGING. We will revert this to a secure policy once verified.

-- 1. Ensure RLS is active
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 2. Drop potential conflicting policies
DROP POLICY IF EXISTS "Delete Access Policy" ON public.posts;
DROP POLICY IF EXISTS "Delete Policy" ON public.posts;
DROP POLICY IF EXISTS "Delete Access Policy Combined" ON public.posts;

-- 3. Create a "Permissive" Delete Policy for Authenticated Users
CREATE POLICY "Debug Delete All" ON public.posts 
FOR DELETE 
TO authenticated 
USING (true);

-- 4. Reload schema cache (optional but good practice)
NOTIFY pgrst, 'reload schema';

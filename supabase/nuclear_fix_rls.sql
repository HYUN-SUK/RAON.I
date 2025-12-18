-- NUCLEAR OPTION: FORCE ENABLE ALL ACCESS
-- Use this ONLY to debug "0 rows" or "Permission Denied" issues.
-- This removes ALL logic and allows ANYONE (even anonymous/not logged in) to do ANYTHING.

BEGIN;

-- 1. Reset RLS on posts
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON public.posts;
DROP POLICY IF EXISTS "Emergency Delete" ON public.posts;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.posts;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.posts;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.posts;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON public.posts;
DROP POLICY IF EXISTS "Debug Delete All" ON public.posts; /* Added cleanup for previous debug policy */

-- 2. Create the "Open" Policy
CREATE POLICY "Nuclear Allow All"
ON public.posts
FOR ALL
USING (true)
WITH CHECK (true);

-- 3. Grant Permissions to roles
GRANT ALL ON TABLE public.posts TO anon;
GRANT ALL ON TABLE public.posts TO authenticated;
GRANT ALL ON TABLE public.posts TO service_role;

COMMIT;

-- Verification
SELECT * FROM public.posts LIMIT 1;

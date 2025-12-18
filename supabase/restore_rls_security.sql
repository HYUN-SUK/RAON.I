-- RESTORE SECURITY: Re-apply Strict RLS and Cleanup Debug Policies
-- Run this AFTER you have verified that deletion works.

-- 1. Drop the Emergency "Allow All" Debug Policy
DROP POLICY IF EXISTS "Debug Delete All" ON public.posts;
DROP POLICY IF EXISTS "Nuclear Allow All" ON public.posts;

-- 2. Ensure Strict Delete Policy is Active (from fix_delete_policy.sql)
DROP POLICY IF EXISTS "Delete Access Policy" ON public.posts;

CREATE POLICY "Delete Access Policy" ON public.posts FOR DELETE USING (
  -- 1. Author can delete
  auth.uid() = author_id
  
  -- 2. Admin via App Metadata
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  
  -- 3. Admin via User Metadata
  OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  
  -- 4. Admin via Email (Fallback)
  OR ((auth.jwt() ->> 'email') = 'admin@raon.ai')
);

-- 3. Notify Schema Reload
NOTIFY pgrst, 'reload schema';

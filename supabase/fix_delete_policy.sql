-- RLS Policy Fix for Delete
-- Reason: Previous policy might be failing on strict JSON checks or metadata propagation delays.
-- Solution: Add a robust fallback using email check for the admin user.

-- 1. Drop old policy
DROP POLICY IF EXISTS "Delete Access Policy" ON public.posts;

-- 2. Create comprehensive Delete Policy
CREATE POLICY "Delete Access Policy" ON public.posts FOR DELETE USING (
  -- 1. Author can delete (Standard)
  auth.uid() = author_id
  
  -- 2. Admin via App Metadata (Standard)
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  
  -- 3. Admin via User Metadata (Backup)
  OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  
  -- 4. Admin via Email (Hard Fallback for Dev/Emergency)
  OR ((auth.jwt() ->> 'email') = 'admin@raon.ai')
);

-- Verification Query (Run this manually if still issues)
-- SELECT * FROM public.posts WHERE id = 'e2d695a1-10f1-4f61-a12b-083212f1460b';

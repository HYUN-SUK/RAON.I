-- RLS Policy Fix for Comment Delete
-- Apply same robust logic as posts table

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
DROP POLICY IF EXISTS "Admins can delete any comment" ON public.comments;
DROP POLICY IF EXISTS "Delete Access Policy" ON public.comments;

CREATE POLICY "Delete Access Policy" ON public.comments FOR DELETE USING (
  -- 1. Author can delete (Standard)
  auth.uid() = user_id
  
  -- 2. Admin via App Metadata (Standard)
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  
  -- 3. Admin via User Metadata (Backup)
  OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  
  -- 4. Admin via Email (Hard Fallback)
  OR ((auth.jwt() ->> 'email') = 'admin@raon.ai')
);

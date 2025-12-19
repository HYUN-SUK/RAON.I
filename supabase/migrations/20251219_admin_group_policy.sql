-- 20251219_admin_group_policy.sql

-- Enable Admin to Delete ANY Group
CREATE POLICY "Admin Delete Groups" ON public.groups FOR DELETE USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
  (auth.jwt() ->> 'email') = 'admin@raon.ai'
);

-- Verify:
-- SELECT * FROM pg_policies WHERE tablename = 'groups';

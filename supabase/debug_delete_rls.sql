-- Check if the current RLS policies are actually active and correct
SELECT * FROM pg_policies WHERE tablename = 'posts';

-- Check current user's metadata to see if 'role' is 'admin'
-- (This is just a query helper, you'd run this while logged in as that user, 
-- or we can inspect the auth.users table if we have permissions)

SELECT id, email, raw_app_meta_data FROM auth.users WHERE email = 'admin@raon.ai';

-- Let's TRIPLE CHECK the Delete Policy
-- Original:
-- create policy "Delete Access Policy" on public.posts for delete using (
--   auth.uid() = author_id
--   OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
-- );

-- Force a change to be absolutely sure admin can delete
DROP POLICY IF EXISTS "Delete Access Policy" ON public.posts;

CREATE POLICY "Delete Access Policy" ON public.posts FOR DELETE USING (
  -- Author
  auth.uid() = author_id
  -- Admin (checking both app_metadata AND user_metadata just in case)
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
);

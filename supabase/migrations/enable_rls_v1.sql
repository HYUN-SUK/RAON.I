-- Enable RLS on posts table (ensure it's enabled)
alter table public.posts enable row level security;

-- Drop existing loose policies (renamed or old)
drop policy if exists "Public posts are viewable by everyone" on public.posts;
drop policy if exists "Users can insert their own posts" on public.posts;

-- Drop policies we are about to create to ensure idempotency (Fixes ERROR: 42710)
drop policy if exists "Read Access Policy" on public.posts;
drop policy if exists "Insert Access Policy" on public.posts;
drop policy if exists "Update Access Policy" on public.posts;
drop policy if exists "Delete Access Policy" on public.posts;

-- 1. READ POLICY
-- Logic: Visible if Public, or Notice, or Author is viewer, or Viewer is Admin.
create policy "Read Access Policy" on public.posts for select using (
  -- Public content
  (meta_data->>'visibility' = 'PUBLIC' OR meta_data->>'visibility' IS NULL)
  -- Notices are always public
  OR (type = 'NOTICE')
  -- Author sees their own content
  OR (auth.uid() = author_id)
  -- Admin sees everything (assuming 'role' in app_metadata)
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
);

-- 2. INSERT POLICY
-- Logic: Authenticated users can insert, author_id must match auth.uid.
create policy "Insert Access Policy" on public.posts for insert with check (
  auth.role() = 'authenticated'
  AND auth.uid() = author_id
  -- Only Admin can insert NOTICE types
  AND (
    (type != 'NOTICE') 
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  )
);

-- 3. UPDATE POLICY
-- Logic: Author or Admin
create policy "Update Access Policy" on public.posts for update using (
  auth.uid() = author_id
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
);

-- 4. DELETE POLICY
-- Logic: Author or Admin
create policy "Delete Access Policy" on public.posts for delete using (
  auth.uid() = author_id
  OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
);

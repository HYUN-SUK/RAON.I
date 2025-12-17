-- Setup Supabase Storage for Community Images
-- This script creates a public bucket and sets up RLS policies.

-- 1. Create Bucket
insert into storage.buckets (id, name, public)
values ('community-images', 'community-images', true)
on conflict (id) do nothing;

-- 2. Enable RLS on Objects
alter table storage.objects enable row level security;

-- 3. Policy: Public Read
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'community-images' );

-- 4. Policy: Authenticated Upload (using ANON for dev simplicity if needed, or authenticated)
-- For this "Anonymous" dev phase, we allow anon uploads.
create policy "Anon Upload"
on storage.objects for insert
with check ( bucket_id = 'community-images' );

-- 5. Policy: Anon Update/Delete (for simplicity in dev)
create policy "Anon Update"
on storage.objects for update
using ( bucket_id = 'community-images' );

create policy "Anon Delete"
on storage.objects for delete
using ( bucket_id = 'community-images' );

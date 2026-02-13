-- Create profile_images bucket
insert into storage.buckets (id, name, public)
values ('profile_images', 'profile_images', true)
on conflict (id) do nothing;

-- Enable RLS (Often already enabled, and failing due to permissions)
DO $$
BEGIN
    alter table storage.objects enable row level security;
EXCEPTION
    WHEN insufficient_privilege THEN null;
END $$;

-- Policy: Public Read
DROP POLICY IF EXISTS "Public Access Profile Images" ON storage.objects;

-- Policy: Authenticated Upload (Allowing All for Dev Simplicity, or restrict to Auth)
DROP POLICY IF EXISTS "Authenticated Upload Profile Images" ON storage.objects;
create policy "Authenticated Upload Profile Images"
on storage.objects for insert
with check ( bucket_id = 'profile_images' AND auth.role() = 'authenticated' );

-- Policy: Owner Update/Delete (Optional, for now allowing Authenticated for simplicity or verify owner)
-- Simple Dev Policy: Authenticated users can update/delete any (Refine for production later)
DROP POLICY IF EXISTS "Authenticated Update Profile Images" ON storage.objects;
create policy "Authenticated Update Profile Images"
on storage.objects for update
using ( bucket_id = 'profile_images' AND auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Authenticated Delete Profile Images" ON storage.objects;
create policy "Authenticated Delete Profile Images"
on storage.objects for delete
using ( bucket_id = 'profile_images' AND auth.role() = 'authenticated' );

-- Create profile_images bucket
insert into storage.buckets (id, name, public)
values ('profile_images', 'profile_images', true)
on conflict (id) do nothing;

-- Enable RLS
alter table storage.objects enable row level security;

-- Policy: Public Read
create policy "Public Access Profile Images"
on storage.objects for select
using ( bucket_id = 'profile_images' );

-- Policy: Authenticated Upload (Allowing All for Dev Simplicity, or restrict to Auth)
create policy "Authenticated Upload Profile Images"
on storage.objects for insert
with check ( bucket_id = 'profile_images' AND auth.role() = 'authenticated' );

-- Policy: Owner Update/Delete (Optional, for now allowing Authenticated for simplicity or verify owner)
-- Simple Dev Policy: Authenticated users can update/delete any (Refine for production later)
create policy "Authenticated Update Profile Images"
on storage.objects for update
using ( bucket_id = 'profile_images' AND auth.role() = 'authenticated' );

create policy "Authenticated Delete Profile Images"
on storage.objects for delete
using ( bucket_id = 'profile_images' AND auth.role() = 'authenticated' );

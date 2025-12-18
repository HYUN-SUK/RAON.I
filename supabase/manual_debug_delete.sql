-- Debug Deletion manually for specific ID
-- Check if the record exists and if the current user (admin@raon.ai) can see it for deletion.

-- 1. Check if record exists (Bypass RLS)
SELECT id, title, author_id, type 
FROM public.posts 
WHERE id = 'e2d695a1-10f1-4f61-a12b-083212f1460b';

-- 2. Simulate User Request (mimic RLS)
-- NOTE: Cannot fully simulate JWT auth here easily without setting local config, 
-- but we can check the policy definition logic against the record.

-- 3. Check Policy Logic manually for this record
SELECT 
    p.id,
    p.author_id,
    (auth.uid() = p.author_id) as is_author,
    ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'admin') as is_admin_app,
    ((current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role') = 'admin') as is_admin_user,
    ((current_setting('request.jwt.claims', true)::jsonb ->> 'email') = 'admin@raon.ai') as is_admin_email
FROM public.posts p
WHERE p.id = 'e2d695a1-10f1-4f61-a12b-083212f1460b';

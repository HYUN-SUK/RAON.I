-- Fix Comments Table Schema & Cache
-- The 'schema cache' error usually means the API is unaware of the new column.

-- 1. Ensure user_id column exists
alter table public.comments 
add column if not exists user_id uuid not null default '00000000-0000-0000-0000-000000000000';

-- 2. Force Schema Cache Reload (PostgREST)
NOTIFY pgrst, 'reload schema';

-- 3. Double check Permissions (just in case)
grant all on public.comments to anon, authenticated, service_role;

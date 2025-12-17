-- Final Read Count Fix
-- Rerun this script to ensure the 'increment_read_count' function is safely created
-- NOW that the 'read_count' column definitely exists.

-- 1. Ensure Column Exists (Idempotent)
alter table public.posts 
add column if not exists read_count integer default 0;

-- 2. Clean up old function definitions to avoid conflicts
drop function if exists increment_read_count(uuid);

-- 3. Re-create the RPC Function with Security Definer (Bypass RLS)
create or replace function increment_read_count(row_id uuid)
returns void
security definer
as $$
begin
  update public.posts
  set read_count = coalesce(read_count, 0) + 1
  where id = row_id;
end;
$$ language plpgsql;

-- 4. Grant Permissions
grant execute on function increment_read_count to anon, authenticated, service_role;

-- 5. Set existing NULLs to 0
update public.posts
set read_count = 0
where read_count is null;

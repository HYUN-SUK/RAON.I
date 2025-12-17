-- Fix RPCs and Permissions (Final "Silver Bullet")
-- using SECURITY DEFINER allows these functions to bypass RLS on the 'posts' table.

-- 1. Read Count
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

-- 2. Comment Count
create or replace function increment_comment_count(row_id uuid)
returns void
security definer
as $$
begin
  update public.posts
  set comment_count = comment_count + 1
  where id = row_id;
end;
$$ language plpgsql;

create or replace function decrement_comment_count(row_id uuid)
returns void
security definer
as $$
begin
  update public.posts
  set comment_count = greatest(0, comment_count - 1)
  where id = row_id;
end;
$$ language plpgsql;

-- 3. Like Count
create or replace function increment_like_count(row_id uuid)
returns void
security definer
as $$
begin
  update public.posts
  set like_count = like_count + 1
  where id = row_id;
end;
$$ language plpgsql;

create or replace function decrement_like_count(row_id uuid)
returns void
security definer
as $$
begin
  update public.posts
  set like_count = greatest(0, like_count - 1)
  where id = row_id;
end;
$$ language plpgsql;

-- 4. Grant Permissions matches
grant execute on function increment_read_count to anon, authenticated, service_role;
grant execute on function increment_comment_count to anon, authenticated, service_role;
grant execute on function decrement_comment_count to anon, authenticated, service_role;
grant execute on function increment_like_count to anon, authenticated, service_role;
grant execute on function decrement_like_count to anon, authenticated, service_role;

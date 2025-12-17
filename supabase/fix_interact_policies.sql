-- Interactions RLS Fix (Drop and Re-create)

-- 1. Reset Policies for Likes
drop policy if exists "Public can read likes" on public.likes;
drop policy if exists "Public can insert likes" on public.likes;
drop policy if exists "Public can delete likes" on public.likes;

create policy "Public can read likes" on public.likes for select using (true);
create policy "Public can insert likes" on public.likes for insert with check (true);
create policy "Public can delete likes" on public.likes for delete using (true);

-- 2. Reset Policies for Comments
drop policy if exists "Public can read comments" on public.comments;
drop policy if exists "Public can insert comments" on public.comments;
drop policy if exists "Public can delete comments" on public.comments;

create policy "Public can read comments" on public.comments for select using (true);
create policy "Public can insert comments" on public.comments for insert with check (true);
create policy "Public can delete comments" on public.comments for delete using (true);

-- 3. Ensure RPC functions exist (Idempotent)
create or replace function increment_like_count(row_id uuid)
returns void as $$
begin
  update public.posts
  set like_count = like_count + 1
  where id = row_id;
end;
$$ language plpgsql;

create or replace function decrement_like_count(row_id uuid)
returns void as $$
begin
  update public.posts
  set like_count = greatest(0, like_count - 1)
  where id = row_id;
end;
$$ language plpgsql;

create or replace function increment_comment_count(row_id uuid)
returns void as $$
begin
  update public.posts
  set comment_count = comment_count + 1
  where id = row_id;
end;
$$ language plpgsql;

create or replace function decrement_comment_count(row_id uuid)
returns void as $$
begin
  update public.posts
  set comment_count = greatest(0, comment_count - 1)
  where id = row_id;
end;
$$ language plpgsql;

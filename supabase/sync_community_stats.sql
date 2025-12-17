-- Fix Missing Columns & Sync Stats
-- Solves "column read_count does not exist" error.

-- 1. Ensure 'read_count' column exists (Missing Schema Change)
alter table public.posts 
add column if not exists read_count integer default 0;

-- 2. Sync Comment Counts
update public.posts p
set comment_count = (
  select count(*)
  from public.comments c
  where c.post_id = p.id
);

-- 3. Sync Like Counts
update public.posts p
set like_count = (
  select count(*)
  from public.likes l
  where l.post_id = p.id
);

-- 4. Initialize NULL Read Counts (Safe cleanup)
update public.posts
set read_count = 0
where read_count is null;

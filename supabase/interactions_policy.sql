-- Interactions RLS Policy (Likes & Comments)

-- 1. Create Tables if they don't exist
create table if not exists public.likes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid not null, -- In real app, references auth.users
  unique(post_id, user_id)
);

create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid not null, -- or 'anon' for now
  author_name text not null,
  content text not null
);

-- 2. Enable RLS
alter table public.likes enable row level security;
alter table public.comments enable row level security;

-- 3. Allow Public Access (For Development/Testing Only)
-- This matches the 'allow_testing.sql' philosophy for Phase 4
create policy "Public can read likes" on public.likes for select using (true);
create policy "Public can insert likes" on public.likes for insert with check (true);
create policy "Public can delete likes" on public.likes for delete using (true);

create policy "Public can read comments" on public.comments for select using (true);
create policy "Public can insert comments" on public.comments for insert with check (true);
create policy "Public can delete comments" on public.comments for delete using (true);

-- 4. RPC Functions for Counters (Optional but good for performance)
-- You might need to create these if your service uses rpc('increment_...')
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

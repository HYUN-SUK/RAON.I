-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. POSTS TABLE
create table public.posts (
  id uuid default uuid_generate_v4() primary key,
  type text not null check (type in ('NOTICE', 'REVIEW', 'STORY', 'QNA', 'GROUP', 'CONTENT')),
  title text not null,
  content text not null,
  author_id uuid references auth.users(id), 
  author_name text, 
  images text[],
  like_count int default 0,
  comment_count int default 0,
  view_count int default 0,
  is_hot boolean default false,
  meta_data jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. COMMENTS TABLE
create table public.comments (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  author_id uuid references auth.users(id),
  author_name text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. LIKES TABLE (Unique constraint)
create table public.likes (
  user_id uuid references auth.users(id) not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, post_id)
);

-- 4. RLS POLICIES
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;

create policy "Public posts are viewable by everyone" on public.posts for select using (true);
create policy "Public comments are viewable by everyone" on public.comments for select using (true);
create policy "Users can insert their own posts" on public.posts for insert with check (auth.uid() = author_id);

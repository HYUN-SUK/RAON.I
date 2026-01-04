-- Create push_tokens table
create table if not exists public.push_tokens (
    token text primary key,
    user_id uuid references public.profiles(id) on delete cascade,
    device_type text default 'web',
    is_active boolean default true,
    created_at timestamp with time zone default now(),
    last_updated_at timestamp with time zone default now()
);

-- Active RLS for push_tokens
alter table public.push_tokens enable row level security;

-- Policies for push_tokens: Users can view and manage their own
create policy "Users can view their own tokens"
on public.push_tokens for select
using (auth.uid() = user_id);

create policy "Users can insert/update their own tokens"
on public.push_tokens for all
using (auth.uid() = user_id);

-- Create notifications table (Log & Queue)
create table if not exists public.notifications (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade,
    category text not null, -- reservation, community, mission, market, system
    title text not null,
    body text not null,
    link text, -- Deep link URL
    status text default 'queued', -- queued, sent, failed, read
    error_message text,
    created_at timestamp with time zone default now(),
    read_at timestamp with time zone
);

-- Enable RLS for notifications
alter table public.notifications enable row level security;

-- Policies for notifications:
-- Users can view their own
create policy "Users can view their own notifications"
on public.notifications for select
using (auth.uid() = user_id);

-- Admins can view all (assuming is_admin exists on profiles, otherwise adjust policy)
create policy "Admins can view all notifications"
on public.notifications for select
using ( exists ( select 1 from public.profiles where id = auth.uid() and is_admin = true ) );

-- Admins can insert (send) notifications
create policy "Admins can insert notifications"
on public.notifications for insert
with check ( exists ( select 1 from public.profiles where id = auth.uid() and is_admin = true ) );

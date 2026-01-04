-- Create blocked_dates table for Admin Calendar Management
create table if not exists public.blocked_dates (
  id uuid default gen_random_uuid() primary key,
  site_id text not null, -- 'site-1', 'site-2' or 'ALL'
  start_date date not null,
  end_date date not null, -- inclusive or exclusive? Let's make it standard: [start, end) or just date range. 
                          -- For simplicity in blocking logic: CheckIn Date to Checkout Date logic is consistent with reservations.
                          -- So a 1-night block is start=2024-01-01, end=2024-01-02.
  memo text,
  is_paid boolean default false, -- For 'Manual Reservation' vs 'Blocked' distinction
  guest_name text,
  contact text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.blocked_dates enable row level security;

-- Policies (Admin only for now, or public read if needed for availability check)
create policy "Public can view blocked dates" 
on public.blocked_dates for select using (true);

create policy "Admins can manage blocked dates" 
on public.blocked_dates for all using (auth.role() = 'authenticated');

-- Verify existing site_config if needed (optional)
-- alter table public.site_config add column if not exists ... (already done)

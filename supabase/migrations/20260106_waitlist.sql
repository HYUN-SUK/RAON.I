-- ============================================
-- 빈자리 알림 시스템 (Waitlist System)
-- 사용자가 명시적으로 요청한 알림
-- ============================================

-- 1. 빈자리 대기 테이블
create table if not exists public.waitlist (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  target_date date not null,
  site_id text references public.sites(id) on delete cascade,
  is_notified boolean default false,
  notified_at timestamptz,
  created_at timestamptz default now(),
  -- 동일 사용자가 같은 날짜/사이트에 중복 신청 방지
  unique(user_id, target_date, site_id)
);

-- 2. 인덱스 생성
create index if not exists idx_waitlist_date_site 
on public.waitlist(target_date, site_id) 
where is_notified = false;

create index if not exists idx_waitlist_user 
on public.waitlist(user_id);

-- 3. RLS 활성화
alter table public.waitlist enable row level security;

-- 4. RLS 정책
-- 사용자는 자신의 대기 신청만 조회/관리 가능
create policy "Users can view own waitlist"
on public.waitlist for select 
using (auth.uid() = user_id);

create policy "Users can insert own waitlist"
on public.waitlist for insert 
with check (auth.uid() = user_id);

create policy "Users can delete own waitlist"
on public.waitlist for delete 
using (auth.uid() = user_id);

-- 관리자는 전체 조회 가능
create policy "Admins can view all waitlist"
on public.waitlist for select 
using (exists (
  select 1 from public.profiles 
  where id = auth.uid() and is_admin = true
));

-- 5. 빈자리 발생 시 대기자 조회 함수
create or replace function get_waitlist_users(p_date date, p_site_id text default null)
returns table(user_id uuid, target_date date, site_id text) as $$
  select w.user_id, w.target_date, w.site_id
  from public.waitlist w
  where w.target_date = p_date
    and w.is_notified = false
    and (p_site_id is null or w.site_id = p_site_id or w.site_id is null)
  order by w.created_at asc;
$$ language sql stable;

-- 6. 대기자 알림 완료 처리 함수
create or replace function mark_waitlist_notified(p_user_id uuid, p_date date, p_site_id text default null)
returns void as $$
  update public.waitlist
  set is_notified = true, notified_at = now()
  where user_id = p_user_id 
    and target_date = p_date
    and (p_site_id is null or site_id = p_site_id or site_id is null);
$$ language sql;

-- ============================================
-- 인앱 배지 시스템 (In-App Badge System)
-- SSOT 기반: 푸시 금지 이벤트의 대체 알림
-- ============================================

-- 1. 인앱 배지 테이블
create table if not exists public.in_app_badges (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  badge_target text not null check (badge_target in ('home', 'reservation', 'community', 'myspace')),
  event_type text not null,
  related_id uuid,            -- 관련 게시물/예약 ID (선택)
  title text,                 -- 알림 제목
  body text,                  -- 알림 내용
  link text,                  -- 딥링크 URL
  is_read boolean default false,
  created_at timestamptz default now()
);

-- 2. 인덱스 생성 (성능 최적화)
create index if not exists idx_badges_user_unread 
on public.in_app_badges(user_id, is_read) 
where is_read = false;

create index if not exists idx_badges_target 
on public.in_app_badges(user_id, badge_target);

-- 3. RLS 활성화
alter table public.in_app_badges enable row level security;

-- 4. RLS 정책
-- 사용자는 자신의 배지만 조회 가능
create policy "Users can view own badges"
on public.in_app_badges for select 
using (auth.uid() = user_id);

-- 사용자는 자신의 배지만 읽음 처리 가능
create policy "Users can update own badges"
on public.in_app_badges for update 
using (auth.uid() = user_id);

-- 시스템/관리자가 배지 생성 가능 (서비스 역할)
create policy "Service can insert badges"
on public.in_app_badges for insert 
with check (true);

-- 5. 배지 개수 조회 함수 (탭별)
create or replace function get_badge_counts(p_user_id uuid)
returns jsonb as $$
  select jsonb_build_object(
    'home', coalesce(sum(case when badge_target = 'home' and not is_read then 1 else 0 end), 0),
    'reservation', coalesce(sum(case when badge_target = 'reservation' and not is_read then 1 else 0 end), 0),
    'community', coalesce(sum(case when badge_target = 'community' and not is_read then 1 else 0 end), 0),
    'myspace', coalesce(sum(case when badge_target = 'myspace' and not is_read then 1 else 0 end), 0),
    'total', coalesce(sum(case when not is_read then 1 else 0 end), 0)
  )
  from public.in_app_badges
  where user_id = p_user_id;
$$ language sql stable;

-- 6. 특정 탭 배지 읽음 처리 함수
create or replace function mark_badges_as_read(p_user_id uuid, p_target text)
returns void as $$
  update public.in_app_badges
  set is_read = true
  where user_id = p_user_id 
    and badge_target = p_target 
    and is_read = false;
$$ language sql;

-- 7. notifications 테이블 확장 (이벤트 타입 추가)
alter table public.notifications 
add column if not exists event_type text,
add column if not exists quiet_hours_override boolean default false,
add column if not exists data jsonb;


-- ==============================================================================
-- 📌 Place History Time-Series Table & Trigger (Data Moat Foundation)
-- Created At: 2026-08-16
-- ==============================================================================

-- 1. 오늘자 베이스라인 스냅샷 (1회성 백업 테이블)
create table if not exists public.place_baseline_20260816 as
select id, api_source, category, name, address, is_active, is_protected, trust_score, miss_count, updated_at
from public.master_places;

-- 2. 장소 변경 이력 (place_history) 시계열 테이블
create table if not exists public.place_history (
  id          bigserial primary key,
  place_id    uuid not null references public.master_places(id) on delete cascade,
  event       text not null,   -- DEACTIVATED, REACTIVATED, STRIKE, FESTIVAL_HELD
  before      jsonb,
  after       jsonb,
  source      text default 'DAILY_ROTATION',
  occurred_at timestamptz default now()
);

-- 고속 조회 인덱스
create index if not exists idx_place_history_place_occurred on public.place_history (place_id, occurred_at desc);
create index if not exists idx_place_history_event_occurred on public.place_history (event, occurred_at desc);

-- 3. 이력 기록 PL/pgSQL 트리거 함수
create or replace function public.log_place_change()
returns trigger language plpgsql security definer as $$
begin
  if OLD.is_active is distinct from NEW.is_active then
    insert into public.place_history(place_id, event, before, after)
    values (
      NEW.id,
      case when NEW.is_active then 'REACTIVATED' else 'DEACTIVATED' end,
      jsonb_build_object('is_active', OLD.is_active, 'miss_count', OLD.miss_count),
      jsonb_build_object('is_active', NEW.is_active, 'miss_count', NEW.miss_count)
    );
  elsif NEW.miss_count > OLD.miss_count then
    insert into public.place_history(place_id, event, before, after)
    values (
      NEW.id,
      'STRIKE',
      jsonb_build_object('miss_count', OLD.miss_count),
      jsonb_build_object('miss_count', NEW.miss_count)
    );
  end if;
  return NEW;
end $$;

-- 4. AFTER UPDATE 트리거 생성 (WHEN 조건절로 불필요한 실행 원천 스킵)
drop trigger if exists trg_place_history on public.master_places;
create trigger trg_place_history
after update on public.master_places
for each row
when (OLD.is_active is distinct from NEW.is_active
   or OLD.miss_count is distinct from NEW.miss_count)
execute function public.log_place_change();

-- 5. RLS 보안 정책 (Service Role 전용)
alter table public.place_history enable row level security;

drop policy if exists "Service role full access on place_history" on public.place_history;
create policy "Service role full access on place_history" 
  on public.place_history for all using (auth.role() = 'service_role');

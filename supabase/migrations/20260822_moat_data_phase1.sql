-- ==============================================================================
-- [A+D 해자 데이터 수집 체계] Phase 1 마이그레이션 DDL
-- 작성일: 2026-08-22
-- 내용: partners, nav_intent_log, plan_swap_log, place_verifications,
--       plan_snapshot, tuning_log 테이블 및 v_moat_metrics 뷰 생성
-- ==============================================================================

-- 1. partners: 제휴 사업장 마스터 (멀티테넌시 대비)
CREATE TABLE IF NOT EXISTS public.partners (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'CAMPGROUND',
  slug          TEXT UNIQUE,
  address       TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  contact_name  TEXT,
  contact_phone TEXT,
  status        TEXT NOT NULL DEFAULT 'ACTIVE',
  joined_at     TIMESTAMPTZ DEFAULT now(),
  settings      JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  public.partners               IS '제휴 사업장 마스터 (캠핑장·펜션·게스트하우스 등). 멀티테넌시 기준 테이블';
COMMENT ON COLUMN public.partners.id            IS '사업장 고유 ID';
COMMENT ON COLUMN public.partners.name          IS '사업장명 (예: 숲*라온i)';
COMMENT ON COLUMN public.partners.type          IS '사업장 유형 — CAMPGROUND(캠핑장) / PENSION(펜션) / GUESTHOUSE(게스트하우스) / HOTEL(호텔) / ETC(기타)';
COMMENT ON COLUMN public.partners.slug          IS 'URL·서브도메인용 식별자 (예: raoni). 사업장별 예약 페이지 주소에 사용';
COMMENT ON COLUMN public.partners.address       IS '사업장 주소';
COMMENT ON COLUMN public.partners.lat           IS '사업장 위도';
COMMENT ON COLUMN public.partners.lng           IS '사업장 경도';
COMMENT ON COLUMN public.partners.contact_name  IS '담당자 성명';
COMMENT ON COLUMN public.partners.contact_phone IS '담당자 연락처';
COMMENT ON COLUMN public.partners.status        IS '상태 — ACTIVE(운영중) / PENDING(가입대기) / SUSPENDED(일시중지)';
COMMENT ON COLUMN public.partners.joined_at     IS '합류 일시';
COMMENT ON COLUMN public.partners.settings      IS '사업장별 설정 JSON (향후 site_config 이관 대비)';
COMMENT ON COLUMN public.partners.created_at    IS '레코드 생성 일시';

-- 기본 테넌트(라온아이 캠핑장) 시드 데이터 등록
INSERT INTO public.partners (id, name, type, slug, address, status)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '숲속의 라온i 캠핑장',
  'CAMPGROUND',
  'raoni',
  '충청남도 예산군',
  'ACTIVE'
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;


-- 2. nav_intent_log: 길안내 실행 로그 (최강 신호)
CREATE TABLE IF NOT EXISTS public.nav_intent_log (
  id          BIGSERIAL PRIMARY KEY,
  partner_id  UUID DEFAULT 'a0000000-0000-0000-0000-000000000001' REFERENCES public.partners(id),
  schedule_id UUID,
  user_id     UUID,
  place_id    UUID,
  category    TEXT,
  stage       TEXT,
  nav_app     TEXT,
  launched_at TIMESTAMPTZ DEFAULT now(),
  followed_up BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_nav_intent_unfollowed ON public.nav_intent_log (user_id, followed_up) WHERE followed_up = false;
CREATE INDEX IF NOT EXISTS idx_nav_intent_place_id ON public.nav_intent_log (place_id);
CREATE INDEX IF NOT EXISTS idx_nav_intent_schedule_id ON public.nav_intent_log (schedule_id);
CREATE INDEX IF NOT EXISTS idx_nav_intent_launched_at ON public.nav_intent_log (launched_at DESC);

COMMENT ON TABLE  public.nav_intent_log             IS '길안내 실행 로그. 추천 장소로 내비를 실행한 기록 — 방문 의도의 최강 신호이며, 검증 신뢰도 판정과 복귀 프롬프트 트리거의 근거';
COMMENT ON COLUMN public.nav_intent_log.partner_id  IS '소속 제휴 사업장 ID';
COMMENT ON COLUMN public.nav_intent_log.schedule_id IS '해당 여행 일정 ID (user_schedules.id)';
COMMENT ON COLUMN public.nav_intent_log.user_id     IS '길안내를 실행한 사용자 ID';
COMMENT ON COLUMN public.nav_intent_log.place_id    IS '길안내 대상 장소 ID (master_places.id)';
COMMENT ON COLUMN public.nav_intent_log.category    IS '장소 카테고리 — RESTAURANT / MART / SPOT / HOSPITAL / GAS_STATION / ROUTE_RESTAURANT / ROUTE_CAFE / ROUTE_SPOT';
COMMENT ON COLUMN public.nav_intent_log.stage       IS '추천 위치 — GOING(가는 경로) / RETURNING(귀갓길) / DESTINATION(목적지 주변)';
COMMENT ON COLUMN public.nav_intent_log.nav_app     IS '실행한 내비 앱 — kakao(카카오맵) / kakaonavi(카카오내비) / tmap(T맵) / naver(네이버지도)';
COMMENT ON COLUMN public.nav_intent_log.launched_at IS '길안내 실행 일시';
COMMENT ON COLUMN public.nav_intent_log.followed_up IS '복귀 후 확인 프롬프트를 이미 노출했는지 여부. 중복 노출 방지용';


-- 3. plan_swap_log: 스마트플랜 장소 교체·열람 행동 로그 (D)
CREATE TABLE IF NOT EXISTS public.plan_swap_log (
  id               BIGSERIAL PRIMARY KEY,
  partner_id       UUID DEFAULT 'a0000000-0000-0000-0000-000000000001' REFERENCES public.partners(id),
  schedule_id      UUID,
  user_id          UUID,
  event            TEXT NOT NULL DEFAULT 'SWAPPED',
  stage            TEXT,
  category         TEXT,
  candidate_count  INT,
  from_place_id    UUID,
  to_place_id      UUID,
  from_trust_score NUMERIC,
  to_trust_score   NUMERIC,
  from_distance    NUMERIC,
  to_distance      NUMERIC,
  occurred_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_swap_schedule_id ON public.plan_swap_log (schedule_id);
CREATE INDEX IF NOT EXISTS idx_plan_swap_event_cat_stage ON public.plan_swap_log (event, category, stage);
CREATE INDEX IF NOT EXISTS idx_plan_swap_occurred_at ON public.plan_swap_log (occurred_at DESC);

COMMENT ON TABLE  public.plan_swap_log                  IS '스마트플랜 장소 교체·열람 행동 로그. 사용자가 추천을 유지했는지 교체했는지 기록';
COMMENT ON COLUMN public.plan_swap_log.partner_id       IS '소속 제휴 사업장 ID';
COMMENT ON COLUMN public.plan_swap_log.schedule_id      IS '해당 여행 일정 ID (user_schedules.id)';
COMMENT ON COLUMN public.plan_swap_log.user_id          IS '행동을 수행한 사용자 ID';
COMMENT ON COLUMN public.plan_swap_log.event            IS '행동 유형 — SWAPPED(대안으로 교체함, 부정 신호) / VIEWED_NO_SWAP(대안 목록을 열어봤으나 기존 추천 유지, 긍정 신호)';
COMMENT ON COLUMN public.plan_swap_log.stage            IS '행동이 일어난 위치 — GOING(가는 경로) / RETURNING(귀갓길) / DESTINATION(목적지 주변)';
COMMENT ON COLUMN public.plan_swap_log.category         IS '장소 카테고리';
COMMENT ON COLUMN public.plan_swap_log.candidate_count  IS '해당 시점 대안 후보 개수. 교체율 비교 시 정규화 분모로 사용';
COMMENT ON COLUMN public.plan_swap_log.from_place_id    IS '기존 추천 장소 ID. VIEWED_NO_SWAP인 경우 유지된 장소';
COMMENT ON COLUMN public.plan_swap_log.to_place_id      IS '교체 후 선택된 장소 ID. VIEWED_NO_SWAP인 경우 NULL';
COMMENT ON COLUMN public.plan_swap_log.from_trust_score IS '기존 추천 장소의 점수';
COMMENT ON COLUMN public.plan_swap_log.to_trust_score   IS '선택된 장소의 점수';
COMMENT ON COLUMN public.plan_swap_log.from_distance    IS '기존 추천 장소까지의 거리(km)';
COMMENT ON COLUMN public.plan_swap_log.to_distance      IS '선택된 장소까지의 거리(km)';
COMMENT ON COLUMN public.plan_swap_log.occurred_at      IS '행동 발생 일시';


-- 4. place_verifications: 실제 방문자 팩트 검증 (A)
CREATE TABLE IF NOT EXISTS public.place_verifications (
  id              BIGSERIAL PRIMARY KEY,
  partner_id      UUID DEFAULT 'a0000000-0000-0000-0000-000000000001' REFERENCES public.partners(id),
  schedule_id     UUID,
  place_id        UUID NOT NULL,
  user_id         UUID,
  stage           TEXT,
  visited         BOOLEAN,
  liked           BOOLEAN,
  skip_reason     TEXT,
  fact_status     TEXT,
  fact_note       TEXT,
  observed_at     DATE,
  observed_dow    INT,
  distance_km     NUMERIC,
  source          TEXT DEFAULT 'OWNER_INTERVIEW',
  entry_point     TEXT,
  evidence        TEXT,
  reporter_weight NUMERIC DEFAULT 0.3,
  review_state    TEXT DEFAULT 'PENDING',
  applied_at      TIMESTAMPTZ,
  notified        BOOLEAN DEFAULT false,
  verified_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_verif_place_status ON public.place_verifications (place_id, fact_status);
CREATE INDEX IF NOT EXISTS idx_place_verif_pending ON public.place_verifications (review_state) WHERE review_state = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_place_verif_user_verified ON public.place_verifications (user_id, verified_at DESC);

COMMENT ON TABLE  public.place_verifications                 IS '실제 방문자 팩트 검증 기록. 추천 장소를 실제 방문했는지, 정보가 정확했는지 확인한 결과';
COMMENT ON COLUMN public.place_verifications.partner_id      IS '소속 제휴 사업장 ID';
COMMENT ON COLUMN public.place_verifications.schedule_id     IS '해당 여행 일정 ID (user_schedules.id)';
COMMENT ON COLUMN public.place_verifications.place_id        IS '검증 대상 장소 ID (master_places.id)';
COMMENT ON COLUMN public.place_verifications.user_id         IS '신고한 사용자 ID. 개인 기여 내역 표시에 사용';
COMMENT ON COLUMN public.place_verifications.stage           IS '추천 위치 — GOING(가는 경로) / RETURNING(귀갓길) / DESTINATION(목적지 주변)';
COMMENT ON COLUMN public.place_verifications.visited         IS '실제 방문 여부. NULL은 정보 없음(미선택)이며 미방문으로 해석하지 않음';
COMMENT ON COLUMN public.place_verifications.liked           IS '좋았던 곳으로 선택했는지 여부. true인 경우 해당 일자에 영업 중이었다는 팩트로도 활용';
COMMENT ON COLUMN public.place_verifications.skip_reason     IS '미방문 사유 — TOO_FAR(거리가 멀어서) / NOT_INTERESTED(관심 없어서) / ALREADY_KNOWN(이미 아는 곳이라) / WEATHER(날씨 때문에) / NO_TIME(시간이 없어서) / OTHER(기타)';
COMMENT ON COLUMN public.place_verifications.fact_status     IS '관측된 사실 — OK(정보 정확) / TEMP_CLOSED(방문일에 문이 닫혀 있었음) / GONE(간판이 없거나 다른 업소) / HOURS_WRONG(영업시간 다름) / NOT_FOUND(해당 위치에 없음)';
COMMENT ON COLUMN public.place_verifications.fact_note       IS '자유 기술 메모';
COMMENT ON COLUMN public.place_verifications.observed_at     IS '실제 관측 일자';
COMMENT ON COLUMN public.place_verifications.observed_dow    IS '관측 요일 (0=일요일 ~ 6=토요일)';
COMMENT ON COLUMN public.place_verifications.distance_km     IS '추천 당시 거리(km) 스냅샷';
COMMENT ON COLUMN public.place_verifications.source          IS '수집 경로 — OWNER_INTERVIEW(사업주 대면) / APP_USER(앱 사용자)';
COMMENT ON COLUMN public.place_verifications.entry_point     IS '앱 유입 경로 — nav_return(길안내 복귀 프롬프트) / record(기록 작성 후) / push(알림) / schedule(일정 상세) / card(장소 카드 하단 버튼)';
COMMENT ON COLUMN public.place_verifications.evidence        IS '증거 유형 — OWNER_INTERVIEW / NAV_LAUNCHED / APP_PHOTO / SCHEDULE_MATCH / SELF_REPORT';
COMMENT ON COLUMN public.place_verifications.reporter_weight IS '신고자 신뢰 가중치 — OWNER_INTERVIEW 1.0 / NAV_LAUNCHED 0.7 / APP_PHOTO 0.7 / SCHEDULE_MATCH 0.5 / SELF_REPORT 0.3';
COMMENT ON COLUMN public.place_verifications.review_state    IS '처리 상태 — PENDING(누적 중) / QUEUED(사업주 승인 대기) / APPLIED(반영 완료) / REJECTED(반려)';
COMMENT ON COLUMN public.place_verifications.applied_at      IS 'master_places 반영 일시';
COMMENT ON COLUMN public.place_verifications.notified        IS '반영 사실을 신고자에게 알림 발송했는지 여부';
COMMENT ON COLUMN public.place_verifications.verified_at     IS '검증 기록 일시';


-- 5. plan_snapshot: 스마트플랜 추천 기준선 요약
CREATE TABLE IF NOT EXISTS public.plan_snapshot (
  id           BIGSERIAL PRIMARY KEY,
  partner_id   UUID DEFAULT 'a0000000-0000-0000-0000-000000000001' REFERENCES public.partners(id),
  schedule_id  UUID,
  version      INT,
  picks        JSONB,
  generated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_snapshot_sched_ver ON public.plan_snapshot (schedule_id, version);

COMMENT ON TABLE  public.plan_snapshot              IS '스마트플랜 생성 시점별 추천 결과 요약. 추천 품질 개선 여부 측정을 위한 기준선';
COMMENT ON COLUMN public.plan_snapshot.partner_id   IS '소속 제휴 사업장 ID';
COMMENT ON COLUMN public.plan_snapshot.schedule_id  IS '해당 여행 일정 ID';
COMMENT ON COLUMN public.plan_snapshot.version      IS '생성 차수 — 1(최초 정밀 생성) / 2(D-7 주간예보 갱신) / 3(D-0 당일 갱신)';
COMMENT ON COLUMN public.plan_snapshot.picks        IS '활성 카드 11개 요약 배열';
COMMENT ON COLUMN public.plan_snapshot.generated_at IS '플랜 생성 일시';


-- 6. tuning_log: 추천 로직 조정 이력
CREATE TABLE IF NOT EXISTS public.tuning_log (
  id          BIGSERIAL PRIMARY KEY,
  target      TEXT NOT NULL,
  before      JSONB,
  after       JSONB,
  reason      TEXT,
  applied_by  TEXT,
  applied_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  public.tuning_log            IS '추천 로직 조정 이력. 데이터 분석 결과를 반영해 가중치·정책을 변경한 기록';
COMMENT ON COLUMN public.tuning_log.target     IS '조정 대상 — DISTANCE_WEIGHT / CERT_BONUS / CATEGORY_QUOTA / SCORE_FORMULA / OTHER';
COMMENT ON COLUMN public.tuning_log.before     IS '변경 전 값';
COMMENT ON COLUMN public.tuning_log.after      IS '변경 후 값';
COMMENT ON COLUMN public.tuning_log.reason     IS '조정 근거';
COMMENT ON COLUMN public.tuning_log.applied_by IS '조정 수행자';
COMMENT ON COLUMN public.tuning_log.applied_at IS '조정 적용 일시';


-- 7. v_moat_metrics: 해자 지표 집계 뷰
CREATE OR REPLACE VIEW public.v_moat_metrics AS
SELECT
  p.id AS partner_id,
  p.name AS partner_name,
  (SELECT count(*) FROM public.nav_intent_log n WHERE n.partner_id = p.id) AS total_nav_intents,
  (SELECT count(*) FROM public.plan_swap_log s WHERE s.partner_id = p.id AND s.event = 'SWAPPED') AS total_swaps,
  (SELECT count(*) FROM public.plan_swap_log s WHERE s.partner_id = p.id AND s.event = 'VIEWED_NO_SWAP') AS total_viewed_no_swaps,
  (SELECT count(*) FROM public.place_verifications v WHERE v.partner_id = p.id AND v.liked = true) AS total_liked_verifications,
  (SELECT count(*) FROM public.place_verifications v WHERE v.partner_id = p.id AND v.fact_status IS NOT NULL AND v.fact_status != 'OK') AS total_issue_reports,
  (SELECT count(*) FROM public.place_verifications v WHERE v.partner_id = p.id AND v.review_state = 'APPLIED') AS total_applied_verifications
FROM public.partners p;

COMMENT ON VIEW public.v_moat_metrics IS '해자 데이터 수집 현황 대시보드용 집계 뷰';


-- 8. Row Level Security (RLS) 정책
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nav_intent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_swap_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuning_log ENABLE ROW LEVEL SECURITY;

-- 익명/인증 사용자 읽기 권한
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Partners viewable by everyone') THEN
    CREATE POLICY "Partners viewable by everyone" ON public.partners FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own nav_intent') THEN
    CREATE POLICY "Users can insert own nav_intent" ON public.nav_intent_log FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own nav_intent') THEN
    CREATE POLICY "Users can view own nav_intent" ON public.nav_intent_log FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own plan_swap') THEN
    CREATE POLICY "Users can insert own plan_swap" ON public.plan_swap_log FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own plan_swap') THEN
    CREATE POLICY "Users can view own plan_swap" ON public.plan_swap_log FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own place_verif') THEN
    CREATE POLICY "Users can insert own place_verif" ON public.place_verifications FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own place_verif') THEN
    CREATE POLICY "Users can view own place_verif" ON public.place_verifications FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Snapshots viewable by authenticated users') THEN
    CREATE POLICY "Snapshots viewable by authenticated users" ON public.plan_snapshot FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Snapshots insertable') THEN
    CREATE POLICY "Snapshots insertable" ON public.plan_snapshot FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tuning log viewable by admins') THEN
    CREATE POLICY "Tuning log viewable by admins" ON public.tuning_log FOR SELECT USING (true);
  END IF;
END $$;

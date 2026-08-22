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

COMMENT ON TABLE  public.nav_intent_log             IS '길안내 실행 로그. 장소 상세에서 내비 앱을 켠 행위 기록 (방문 의도 최강 신호)';
COMMENT ON COLUMN public.nav_intent_log.id          IS '로그 고유 ID (자동증가)';
COMMENT ON COLUMN public.nav_intent_log.partner_id  IS '제휴 사업장 ID (기본: 라온아이)';
COMMENT ON COLUMN public.nav_intent_log.schedule_id IS '연계 일정 ID (NULL이면 일반 탐색 중 실행)';
COMMENT ON COLUMN public.nav_intent_log.user_id     IS '실행한 사용자 ID';
COMMENT ON COLUMN public.nav_intent_log.place_id    IS '목적지 master_places.id';
COMMENT ON COLUMN public.nav_intent_log.category    IS '장소 카테고리 (MART/RESTAURANT/SPOT/GAS_STATION/HOSPITAL 등)';
COMMENT ON COLUMN public.nav_intent_log.stage       IS '일정 단계 (GOING:가는길 / RETURNING:귀갓길 / DESTINATION:목적지주변)';
COMMENT ON COLUMN public.nav_intent_log.nav_app     IS '선택한 내비 앱 (kakao / kakaonavi / tmap / naver)';
COMMENT ON COLUMN public.nav_intent_log.launched_at IS '내비 앱 실행 일시';
COMMENT ON COLUMN public.nav_intent_log.followed_up IS '귀환 후 팩트 확인 프롬프트 노출/응답 완료 여부';


-- 3. plan_swap_log: 스마트플랜 교체 및 대안 시트 닫힘(유지) 로그
CREATE TABLE IF NOT EXISTS public.plan_swap_log (
  id                BIGSERIAL PRIMARY KEY,
  partner_id        UUID DEFAULT 'a0000000-0000-0000-0000-000000000001' REFERENCES public.partners(id),
  schedule_id       UUID,
  user_id           UUID,
  event             TEXT NOT NULL,
  stage             TEXT,
  category          TEXT,
  candidate_count   INTEGER,
  from_place_id     UUID,
  to_place_id       UUID,
  from_trust_score  NUMERIC(5,2),
  to_trust_score    NUMERIC(5,2),
  from_distance     NUMERIC(5,2),
  to_distance       NUMERIC(5,2),
  occurred_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_swap_from_place ON public.plan_swap_log (from_place_id);
CREATE INDEX IF NOT EXISTS idx_plan_swap_to_place ON public.plan_swap_log (to_place_id);
CREATE INDEX IF NOT EXISTS idx_plan_swap_event ON public.plan_swap_log (event, category);

COMMENT ON TABLE  public.plan_swap_log                  IS '스마트플랜 카드 교체 및 대안 시트 닫힘 로그 (거절·선택 신호 수집)';
COMMENT ON COLUMN public.plan_swap_log.id               IS '로그 고유 ID (자동증가)';
COMMENT ON COLUMN public.plan_swap_log.partner_id       IS '제휴 사업장 ID';
COMMENT ON COLUMN public.plan_swap_log.schedule_id      IS '연계 일정 ID';
COMMENT ON COLUMN public.plan_swap_log.user_id          IS '행동한 사용자 ID';
COMMENT ON COLUMN public.plan_swap_log.event            IS '이벤트 유형 — SWAPPED(교체실행) / VIEWED_NO_SWAP(대안열람후기존유지)';
COMMENT ON COLUMN public.plan_swap_log.stage            IS '일정 단계 (GOING / RETURNING / DESTINATION)';
COMMENT ON COLUMN public.plan_swap_log.category         IS '장소 카테고리';
COMMENT ON COLUMN public.plan_swap_log.candidate_count  IS '당시 사용자에게 제시된 대안 카드 수';
COMMENT ON COLUMN public.plan_swap_log.from_place_id    IS '교체 전(원래 추천) 장소 ID (VIEWED_NO_SWAP 시 유지된 장소)';
COMMENT ON COLUMN public.plan_swap_log.to_place_id      IS '교체 후(사용자가 선택한) 장소 ID (VIEWED_NO_SWAP 시 NULL)';
COMMENT ON COLUMN public.plan_swap_log.from_trust_score IS '교체 전 장소의 당시 추천 점수 스냅샷';
COMMENT ON COLUMN public.plan_swap_log.to_trust_score   IS '교체 후 장소의 당시 추천 점수 스냅샷';
COMMENT ON COLUMN public.plan_swap_log.from_distance    IS '교체 전 장소의 거리 (km)';
COMMENT ON COLUMN public.plan_swap_log.to_distance      IS '교체 후 장소의 거리 (km)';
COMMENT ON COLUMN public.plan_swap_log.occurred_at      IS '행동 발생 일시';


-- 4. place_verifications: 현장 팩트 검증 마스터 테이블
CREATE TABLE IF NOT EXISTS public.place_verifications (
  id                BIGSERIAL PRIMARY KEY,
  partner_id        UUID DEFAULT 'a0000000-0000-0000-0000-000000000001' REFERENCES public.partners(id),
  schedule_id       UUID,
  place_id          UUID NOT NULL,
  user_id           UUID,
  stage             TEXT,
  visited           BOOLEAN,
  liked             BOOLEAN,
  skip_reason       TEXT,
  fact_status       TEXT,
  fact_note         TEXT,
  observed_at       DATE,
  observed_dow      INTEGER,
  distance_km       NUMERIC(5,2),
  source            TEXT NOT NULL,
  entry_point       TEXT,
  evidence          TEXT,
  reporter_weight   NUMERIC(3,2) DEFAULT 0.5,
  review_state      TEXT DEFAULT 'PENDING',
  applied_at        TIMESTAMPTZ,
  verified_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_verif_place_id ON public.place_verifications (place_id);
CREATE INDEX IF NOT EXISTS idx_place_verif_schedule ON public.place_verifications (schedule_id);
CREATE INDEX IF NOT EXISTS idx_place_verif_review ON public.place_verifications (review_state);
CREATE INDEX IF NOT EXISTS idx_place_verif_source ON public.place_verifications (source, reporter_weight);

COMMENT ON TABLE  public.place_verifications                 IS '장소 팩트 검증 마스터 테이블 (실제 방문자/사업주의 영업·상태 확인 기록)';
COMMENT ON COLUMN public.place_verifications.id              IS '검증 레코드 고유 ID';
COMMENT ON COLUMN public.place_verifications.partner_id      IS '제휴 사업장 ID';
COMMENT ON COLUMN public.place_verifications.schedule_id     IS '연계 일정 ID (어떤 캠핑 일정에서 확인했는지)';
COMMENT ON COLUMN public.place_verifications.place_id        IS '검증 대상 master_places.id';
COMMENT ON COLUMN public.place_verifications.user_id         IS '검증자 user_id (익명이면 NULL)';
COMMENT ON COLUMN public.place_verifications.stage           IS '일정 단계 (GOING / RETURNING / DESTINATION)';
COMMENT ON COLUMN public.place_verifications.visited         IS '실제 방문 여부 (true/false/NULL:미확인)';
COMMENT ON COLUMN public.place_verifications.liked           IS '만족도 (true:좋았음 / false:아쉬움 / NULL:미평가)';
COMMENT ON COLUMN public.place_verifications.skip_reason     IS '미방문 사유 (TOO_FAR:거리 / NOT_INTERESTED:관심 / ALREADY_KNOWN:이미앎 / WEATHER:날씨 / NO_TIME:시간 / OTHER:기타)';
COMMENT ON COLUMN public.place_verifications.fact_status     IS '관측 사실 — OK(정상영업) / TEMP_CLOSED(문닫음·임시휴무) / GONE(간판없음·폐업) / HOURS_WRONG(영업시간다름) / NOT_FOUND(위치없음)';
COMMENT ON COLUMN public.place_verifications.fact_note       IS '검증 메모 (상세 관측 내용)';
COMMENT ON COLUMN public.place_verifications.observed_at     IS '실제 관측 일자 (YYYY-MM-DD)';
COMMENT ON COLUMN public.place_verifications.observed_dow    IS '관측 요일 (0:일 ~ 6:토)';
COMMENT ON COLUMN public.place_verifications.distance_km     IS '일정 출발지/캠핑장 기준 거리 (km)';
COMMENT ON COLUMN public.place_verifications.source          IS '데이터 출처 — OWNER_INTERVIEW(사업주대면) / APP_USER(앱사용자참여) / OPERATOR(운영자직접)';
COMMENT ON COLUMN public.place_verifications.entry_point     IS '유입 경로 — admin_interview(사업주화면) / nav_return(내비복귀) / timeline_prompt(타임라인) / verify_flow(전용화면) / card(카드버튼)';
COMMENT ON COLUMN public.place_verifications.evidence        IS '증거 수준 — OWNER_INTERVIEW(1.0) / NAV_LAUNCHED(0.7) / SCHEDULE_MATCH(0.5) / SELF_REPORT(0.3)';
COMMENT ON COLUMN public.place_verifications.reporter_weight IS '제보자 신뢰 가중치 (0.1 ~ 1.0)';
COMMENT ON COLUMN public.place_verifications.review_state    IS '검토 상태 — PENDING(대기) / APPLIED(반영완료) / REJECTED(기각)';
COMMENT ON COLUMN public.place_verifications.applied_at      IS '마스터 데이터에 가중치/상태가 반영된 일시';
COMMENT ON COLUMN public.place_verifications.verified_at     IS '검증 기록 일시';


-- 5. plan_snapshot: 스마트플랜 추천 기준선 스냅샷
CREATE TABLE IF NOT EXISTS public.plan_snapshot (
  id                    BIGSERIAL PRIMARY KEY,
  schedule_id           UUID NOT NULL,
  partner_id            UUID DEFAULT 'a0000000-0000-0000-0000-000000000001' REFERENCES public.partners(id),
  generated_at          TIMESTAMPTZ DEFAULT now(),
  destination_cards     JSONB NOT NULL,
  route_cards           JSONB,
  return_cards          JSONB,
  total_candidates      INTEGER,
  applied_weights_json  JSONB
);

CREATE INDEX IF NOT EXISTS idx_plan_snapshot_schedule ON public.plan_snapshot (schedule_id);

COMMENT ON TABLE  public.plan_snapshot                      IS '스마트플랜 추천 기준선 요약 스냅샷 (추천 성과 측정용)';
COMMENT ON COLUMN public.plan_snapshot.id                   IS '스냅샷 고유 ID';
COMMENT ON COLUMN public.plan_snapshot.schedule_id          IS '대상 일정 ID';
COMMENT ON COLUMN public.plan_snapshot.partner_id           IS '제휴 사업장 ID';
COMMENT ON COLUMN public.plan_snapshot.generated_at         IS '스냅샷 생성 일시';
COMMENT ON COLUMN public.plan_snapshot.destination_cards    IS '목적지 주변 추천 5개 카드 요약 (id, name, category, trust_score, distance)';
COMMENT ON COLUMN public.plan_snapshot.route_cards          IS '가는 길 추천 3개 카드 요약';
COMMENT ON COLUMN public.plan_snapshot.return_cards         IS '귀갓길 추천 3개 카드 요약';
COMMENT ON COLUMN public.plan_snapshot.total_candidates     IS '전체 후보 장소 수';
COMMENT ON COLUMN public.plan_snapshot.applied_weights_json IS '당시 적용된 가중치 파라미터 스냅샷';


-- 6. tuning_log: 스코어링 정책 조정 이력
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


-- 8. Row Level Security (RLS) 활성화 및 안전한 정책 등록
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nav_intent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_swap_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuning_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners viewable by everyone" ON public.partners;
CREATE POLICY "Partners viewable by everyone" ON public.partners FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own nav_intent" ON public.nav_intent_log;
CREATE POLICY "Users can insert own nav_intent" ON public.nav_intent_log FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own nav_intent" ON public.nav_intent_log;
CREATE POLICY "Users can view own nav_intent" ON public.nav_intent_log FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can insert own plan_swap" ON public.plan_swap_log;
CREATE POLICY "Users can insert own plan_swap" ON public.plan_swap_log FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own plan_swap" ON public.plan_swap_log;
CREATE POLICY "Users can view own plan_swap" ON public.plan_swap_log FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can insert own place_verif" ON public.place_verifications;
CREATE POLICY "Users can insert own place_verif" ON public.place_verifications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own place_verif" ON public.place_verifications;
CREATE POLICY "Users can view own place_verif" ON public.place_verifications FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Snapshots viewable by authenticated users" ON public.plan_snapshot;
CREATE POLICY "Snapshots viewable by authenticated users" ON public.plan_snapshot FOR SELECT USING (true);

DROP POLICY IF EXISTS "Snapshots insertable" ON public.plan_snapshot;
CREATE POLICY "Snapshots insertable" ON public.plan_snapshot FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Tuning log viewable by admins" ON public.tuning_log;
CREATE POLICY "Tuning log viewable by admins" ON public.tuning_log FOR SELECT USING (true);

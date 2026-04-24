-- [20260424] Smart Plan Candidates: 예약자별 개인화 후보군 테이블
-- Stage 4 개인화 레이어에서 예약자별 거리감점 + 2차 쿼터 적용 결과를 저장

CREATE TABLE IF NOT EXISTS smart_plan_candidates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reservation_id UUID NOT NULL,
    fact_id UUID NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    quality_score NUMERIC,
    distance_meters NUMERIC,
    penalty_score NUMERIC,
    final_score NUMERIC,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(reservation_id, fact_id)
);

-- 예약자별 빠른 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_candidates_reservation ON smart_plan_candidates(reservation_id);
CREATE INDEX IF NOT EXISTS idx_candidates_category ON smart_plan_candidates(category);

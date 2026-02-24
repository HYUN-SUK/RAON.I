-- ========================================================================================
-- Smart Camping Plan Phase 1: Hybrid Caching & AI Agent Data Provisioning
-- Table: cached_facilities
-- ========================================================================================
-- 이 테이블은 타사 API(카카오 등)의 원본 데이터를 무단 적재하지 않고,
-- 공공데이터(정부 인증)와 수치 데이터(리뷰 볼륨)를 결합한 '라온 신뢰도 지수' 형태의 
-- 2차 가공 지표를 저장하는 하이브리드 캐싱 전용 테이블입니다. 
-- AI 에이전트 연동을 위한 출처(Provenance) 메타데이터를 포함합니다.

CREATE TABLE IF NOT EXISTS public.cached_facilities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- 카테고리: HOSPITAL(병원), MART(마트/편의점), RESTAURANT(식당), SPOT(관광지), FESTIVAL(행사)
    category VARCHAR(50) NOT NULL, 
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    
    -- [AI Agent Ready] Provenance & Standard Schema Metadata
    source_name VARCHAR(100), -- 예: 'TourAPI', 'PublicDataPortal', 'LocalGov'
    source_url VARCHAR(500),  -- 원본 데이터 확인용 (근거)
    cert_type VARCHAR(100),   -- 예: '안심식당', '권역응급의료센터', '백년가게'
    
    -- [Hybrid Caching] 파생 데이터: 외부 데이터를 결합하여 만든 고유 지표
    raon_trust_score INTEGER DEFAULT 0, -- 라온 신뢰도 지수 (공공 인증 + 자체 가중치)
    raw_volume_data JSONB,              -- 결합용 기초 수치 보관 (예: {"kakao_review_count": 150})
    
    -- Facility specifics (Optional)
    metadata JSONB, -- 추가 정보 (휴무일, 취급 품목, 상세 설명 등 Schema.org 호환 구조화)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Performance Indexes (위치 기반 쿼리 및 카테고리 조회 성능 확보)
CREATE INDEX IF NOT EXISTS idx_cached_facilities_category ON public.cached_facilities(category);
CREATE INDEX IF NOT EXISTS idx_cached_facilities_location ON public.cached_facilities(lat, lng);

-- Security: Enable RLS and setup Read-Only for authenticated/anonymous users based on usage
ALTER TABLE public.cached_facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" 
ON public.cached_facilities FOR SELECT 
USING (true);

-- Trigger for auto-updating `updated_at`
CREATE OR REPLACE FUNCTION update_cached_facilities_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cached_facilities_updated_at ON public.cached_facilities;
CREATE TRIGGER trg_cached_facilities_updated_at
BEFORE UPDATE ON public.cached_facilities
FOR EACH ROW
EXECUTE FUNCTION update_cached_facilities_modtime();

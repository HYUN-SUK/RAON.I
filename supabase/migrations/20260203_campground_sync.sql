-- ═══════════════════════════════════════════════════════════
-- 캠핑장 테이블 확장 (환경 필드 추가)
-- 작성일: 2026-02-03
-- ═══════════════════════════════════════════════════════════

-- 기존 campgrounds 테이블에 환경 필드 추가
ALTER TABLE campgrounds
ADD COLUMN IF NOT EXISTS has_playground BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_parking BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS env_water BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS env_quiet BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS env_view BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS env_forest BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS env_ocean BOOLEAN DEFAULT false;

-- 인덱스 추가 (토글 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_campgrounds_shower ON campgrounds(has_shower) WHERE has_shower = true;
CREATE INDEX IF NOT EXISTS idx_campgrounds_electricity ON campgrounds(has_electricity) WHERE has_electricity = true;
CREATE INDEX IF NOT EXISTS idx_campgrounds_pet ON campgrounds(pet_allowed) WHERE pet_allowed = true;
CREATE INDEX IF NOT EXISTS idx_campgrounds_firepit ON campgrounds(has_firepit) WHERE has_firepit = true;

-- 캠핑장 동기화 RPC (Upsert)
CREATE OR REPLACE FUNCTION upsert_campground(
    p_gocamping_id TEXT,
    p_name TEXT,
    p_address TEXT,
    p_tel TEXT,
    p_homepage_url TEXT,
    p_lat NUMERIC,
    p_lng NUMERIC,
    p_facility_type TEXT[],
    p_has_shower BOOLEAN,
    p_has_electricity BOOLEAN,
    p_has_wifi BOOLEAN,
    p_pet_allowed BOOLEAN,
    p_has_firepit BOOLEAN,
    p_has_playground BOOLEAN,
    p_has_parking BOOLEAN,
    p_env_water BOOLEAN,
    p_env_quiet BOOLEAN,
    p_env_view BOOLEAN,
    p_env_forest BOOLEAN,
    p_env_ocean BOOLEAN,
    p_environment TEXT[],
    p_auto_tags TEXT[],
    p_site_count INTEGER,
    p_intro TEXT
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO campgrounds (
        gocamping_id, name, address, tel, homepage_url,
        lat, lng, facility_type,
        has_shower, has_electricity, has_wifi, pet_allowed, has_firepit,
        has_playground, has_parking,
        env_water, env_quiet, env_view, env_forest, env_ocean,
        environment, auto_tags, site_count, intro,
        updated_at
    ) VALUES (
        p_gocamping_id, p_name, p_address, p_tel, p_homepage_url,
        p_lat, p_lng, p_facility_type,
        p_has_shower, p_has_electricity, p_has_wifi, p_pet_allowed, p_has_firepit,
        p_has_playground, p_has_parking,
        p_env_water, p_env_quiet, p_env_view, p_env_forest, p_env_ocean,
        p_environment, p_auto_tags, p_site_count, p_intro,
        NOW()
    )
    ON CONFLICT (gocamping_id) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        tel = EXCLUDED.tel,
        homepage_url = EXCLUDED.homepage_url,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        facility_type = EXCLUDED.facility_type,
        has_shower = EXCLUDED.has_shower,
        has_electricity = EXCLUDED.has_electricity,
        has_wifi = EXCLUDED.has_wifi,
        pet_allowed = EXCLUDED.pet_allowed,
        has_firepit = EXCLUDED.has_firepit,
        has_playground = EXCLUDED.has_playground,
        has_parking = EXCLUDED.has_parking,
        env_water = EXCLUDED.env_water,
        env_quiet = EXCLUDED.env_quiet,
        env_view = EXCLUDED.env_view,
        env_forest = EXCLUDED.env_forest,
        env_ocean = EXCLUDED.env_ocean,
        environment = EXCLUDED.environment,
        auto_tags = EXCLUDED.auto_tags,
        site_count = EXCLUDED.site_count,
        intro = EXCLUDED.intro,
        updated_at = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 관리자 전용: 캠핑장 삽입/수정 정책 (기존 정책 삭제 후 재생성)
DROP POLICY IF EXISTS "campgrounds_service_insert" ON campgrounds;
DROP POLICY IF EXISTS "campgrounds_service_update" ON campgrounds;

CREATE POLICY "campgrounds_service_insert"
ON campgrounds FOR INSERT
WITH CHECK (true);

CREATE POLICY "campgrounds_service_update"
ON campgrounds FOR UPDATE
USING (true);

-- 참고: 위 정책은 INSERT/UPDATE를 허용하지만,
-- 실제 데이터 동기화는 Service Role Key를 사용하는 서버 측에서만 수행됩니다.

-- ═══════════════════════════════════════════════════════════
-- camping_records 테이블 확장 (1분 기록 시스템 v2)
-- ═══════════════════════════════════════════════════════════

-- 1. 공개 여부 필드
ALTER TABLE camping_records ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- 2. 캠핑장 유형 (raonai / external)
ALTER TABLE camping_records ADD COLUMN IF NOT EXISTS campground_type TEXT DEFAULT 'external';

-- 3. 캠핑장 정보 (일정에서 가져옴)
ALTER TABLE camping_records ADD COLUMN IF NOT EXISTS campground_name TEXT;
ALTER TABLE camping_records ADD COLUMN IF NOT EXISTS campground_address TEXT;

-- 4. 위치 (PostGIS 필요시)
-- ALTER TABLE camping_records ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326);
-- 대신 간단한 좌표 저장
ALTER TABLE camping_records ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE camping_records ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 5. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_camping_records_is_public ON camping_records(is_public);
CREATE INDEX IF NOT EXISTS idx_camping_records_campground_type ON camping_records(campground_type);

-- 6. 공개 기록 조회용 RLS 정책 추가
-- 기존 정책 삭제 후 재생성 (공개 기록은 누구나 볼 수 있도록)
DROP POLICY IF EXISTS "Users can CRUD own records" ON camping_records;
DROP POLICY IF EXISTS "Anyone can view public records" ON camping_records;

-- 자신의 기록은 모든 작업 가능
CREATE POLICY "Users can CRUD own records"
    ON camping_records
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 공개 기록은 누구나 조회 가능
CREATE POLICY "Anyone can view public records"
    ON camping_records
    FOR SELECT
    USING (is_public = TRUE);

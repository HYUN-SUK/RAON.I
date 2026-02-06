-- ═══════════════════════════════════════════════════════════
-- 캠핑 기록 테이블 (1분 기록 기능용)
-- ═══════════════════════════════════════════════════════════

-- 1. 캠핑 기록 테이블
CREATE TABLE IF NOT EXISTS camping_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES user_schedules(id) ON DELETE SET NULL,
    content TEXT NOT NULL DEFAULT '',
    photo_url TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS idx_camping_records_user_id ON camping_records(user_id);
CREATE INDEX IF NOT EXISTS idx_camping_records_schedule_id ON camping_records(schedule_id);
CREATE INDEX IF NOT EXISTS idx_camping_records_created_at ON camping_records(created_at DESC);

-- 3. RLS 정책
ALTER TABLE camping_records ENABLE ROW LEVEL SECURITY;

-- 자신의 기록만 조회/수정/삭제 가능
CREATE POLICY "Users can CRUD own records"
    ON camping_records
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_camping_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_camping_records_updated_at ON camping_records;
CREATE TRIGGER trigger_camping_records_updated_at
    BEFORE UPDATE ON camping_records
    FOR EACH ROW
    EXECUTE FUNCTION update_camping_records_updated_at();

-- 5. Storage Bucket for records (run in Supabase Dashboard if not exists)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('records', 'records', true);

-- ═══════════════════════════════════════════════════════════
-- Phase 12.3: 캠핑 일정 관리 시스템
-- 작성일: 2026-02-04
-- ═══════════════════════════════════════════════════════════

-- 1. 캠핑 일정 테이블
CREATE TABLE IF NOT EXISTS user_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- 출처: 라온아이 예약 또는 외부
    source TEXT NOT NULL DEFAULT 'external' CHECK (source IN ('raonai', 'external')),
    reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    
    -- 캠핑장 정보
    campground_id UUID REFERENCES campgrounds(id) ON DELETE SET NULL,
    campground_name TEXT NOT NULL,
    campground_address TEXT,
    campground_lat DOUBLE PRECISION,
    campground_lng DOUBLE PRECISION,
    
    -- 일정
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    
    -- 상태
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    
    -- 기록 연동
    record_written BOOLEAN DEFAULT FALSE,
    record_id UUID, -- 추후 records 테이블 연동
    
    -- 알림 전송 상태
    notification_d4_sent BOOLEAN DEFAULT FALSE,
    notification_d1_sent BOOLEAN DEFAULT FALSE,
    notification_d0_sent BOOLEAN DEFAULT FALSE,
    
    -- 메모
    memo TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 준비물 체크리스트 테이블
CREATE TABLE IF NOT EXISTS schedule_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES user_schedules(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    item TEXT NOT NULL,
    is_checked BOOLEAN DEFAULT FALSE,
    category TEXT DEFAULT 'etc' CHECK (category IN ('essential', 'cooking', 'sleeping', 'activity', 'etc')),
    sort_order INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 캠핑장 찜 테이블
CREATE TABLE IF NOT EXISTS campground_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    campground_id UUID REFERENCES campgrounds(id) ON DELETE CASCADE NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, campground_id)
);

-- 4. 인덱스
CREATE INDEX IF NOT EXISTS idx_user_schedules_user_id ON user_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_user_schedules_check_in ON user_schedules(check_in);
CREATE INDEX IF NOT EXISTS idx_user_schedules_status ON user_schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedule_checklists_schedule_id ON schedule_checklists(schedule_id);
CREATE INDEX IF NOT EXISTS idx_campground_favorites_user_id ON campground_favorites(user_id);

-- 5. RLS 정책

-- user_schedules
ALTER TABLE user_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own schedules" ON user_schedules;
CREATE POLICY "Users can view own schedules" ON user_schedules
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own schedules" ON user_schedules;
CREATE POLICY "Users can insert own schedules" ON user_schedules
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own schedules" ON user_schedules;
CREATE POLICY "Users can update own schedules" ON user_schedules
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own schedules" ON user_schedules;
CREATE POLICY "Users can delete own schedules" ON user_schedules
    FOR DELETE USING (auth.uid() = user_id);

-- schedule_checklists
ALTER TABLE schedule_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own checklists" ON schedule_checklists;
CREATE POLICY "Users can manage own checklists" ON schedule_checklists
    FOR ALL USING (auth.uid() = user_id);

-- campground_favorites
ALTER TABLE campground_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own favorites" ON campground_favorites;
CREATE POLICY "Users can manage own favorites" ON campground_favorites
    FOR ALL USING (auth.uid() = user_id);

-- 6. Updated_at 트리거
CREATE OR REPLACE FUNCTION update_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_schedule_updated_at ON user_schedules;
CREATE TRIGGER trigger_update_schedule_updated_at
    BEFORE UPDATE ON user_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_schedule_updated_at();

-- 7. 일정 UPSERT RPC
CREATE OR REPLACE FUNCTION upsert_schedule(
    p_user_id UUID,
    p_source TEXT,
    p_campground_name TEXT,
    p_campground_address TEXT,
    p_campground_lat DOUBLE PRECISION,
    p_campground_lng DOUBLE PRECISION,
    p_check_in DATE,
    p_check_out DATE,
    p_memo TEXT DEFAULT NULL,
    p_campground_id UUID DEFAULT NULL,
    p_reservation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_schedule_id UUID;
BEGIN
    INSERT INTO user_schedules (
        user_id, source, campground_id, campground_name, campground_address,
        campground_lat, campground_lng, check_in, check_out, memo, reservation_id
    ) VALUES (
        p_user_id, p_source, p_campground_id, p_campground_name, p_campground_address,
        p_campground_lat, p_campground_lng, p_check_in, p_check_out, p_memo, p_reservation_id
    )
    RETURNING id INTO v_schedule_id;
    
    RETURN v_schedule_id;
END;
$$;

-- 8. 찜 토글 RPC
CREATE OR REPLACE FUNCTION toggle_campground_favorite(
    p_user_id UUID,
    p_campground_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM campground_favorites 
        WHERE user_id = p_user_id AND campground_id = p_campground_id
    ) INTO v_exists;
    
    IF v_exists THEN
        DELETE FROM campground_favorites 
        WHERE user_id = p_user_id AND campground_id = p_campground_id;
        RETURN FALSE; -- 찜 해제됨
    ELSE
        INSERT INTO campground_favorites (user_id, campground_id)
        VALUES (p_user_id, p_campground_id);
        RETURN TRUE; -- 찜 추가됨
    END IF;
END;
$$;

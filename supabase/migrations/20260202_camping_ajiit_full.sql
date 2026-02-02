-- ═══════════════════════════════════════════════════════════
-- 캠핑 아지트 (Camping Ajiit) 전체 스키마
-- 작성일: 2026-02-02
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 1. 캠핑장 마스터 테이블 (고캠핑 API)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS campgrounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gocamping_id TEXT UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  tel TEXT,
  homepage_url TEXT,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  facility_type TEXT[],
  has_shower BOOLEAN DEFAULT false,
  has_electricity BOOLEAN DEFAULT false,
  has_wifi BOOLEAN DEFAULT false,
  pet_allowed BOOLEAN DEFAULT false,
  has_firepit BOOLEAN DEFAULT false,
  environment TEXT[],
  auto_tags TEXT[],
  user_tags JSONB DEFAULT '{}',
  site_count INTEGER,
  intro TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- 2. 사용자 캠핑 모드
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_camping_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  toggles TEXT[] DEFAULT '{}',
  distance_km INTEGER DEFAULT 100,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, mode)
);

-- ═══════════════════════════════════════════════════════════
-- 3. Plan Lock (현재 계획 중인 캠핑)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_plan_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  toggles TEXT[] DEFAULT '{}',
  distance_km INTEGER DEFAULT 100,
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  recommended_campgrounds UUID[],
  selected_campground_id UUID,
  status TEXT DEFAULT 'planning', -- 'planning', 'booked', 'completed'
  UNIQUE(user_id)
);

-- ═══════════════════════════════════════════════════════════
-- 4. 찜 (Favorites)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  campground_id UUID REFERENCES campgrounds(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, campground_id)
);

-- ═══════════════════════════════════════════════════════════
-- 5. 캠핑 일정 (라온아이 + 타 캠핑장)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_camping_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,                -- 'raonai' | 'external'
  reservation_id UUID,                 -- 라온아이 예약 시 연결
  campground_name TEXT,
  campground_address TEXT,
  campground_lat NUMERIC(10,7),
  campground_lng NUMERIC(10,7),
  check_in TIMESTAMPTZ NOT NULL,
  check_out TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled',     -- 'scheduled', 'completed', 'cancelled'
  record_written BOOLEAN DEFAULT false,
  notification_d4_sent BOOLEAN DEFAULT false,
  notification_d1_sent BOOLEAN DEFAULT false,
  notification_d0_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- 6. 기록 태그
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS record_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID, -- REFERENCES posts(id) ON DELETE CASCADE (별도 연결)
  tag TEXT NOT NULL,
  is_standard BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- 7. 캠핑장 사용자 태그 기록
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS campground_user_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  campground_id UUID REFERENCES campgrounds(id) ON DELETE CASCADE,
  tags TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, campground_id)
);

-- ═══════════════════════════════════════════════════════════
-- 인덱스
-- ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_campgrounds_lat_lng ON campgrounds(lat, lng);
CREATE INDEX IF NOT EXISTS idx_campgrounds_auto_tags ON campgrounds USING GIN(auto_tags);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_schedules_user ON user_camping_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_user_schedules_checkin ON user_camping_schedules(check_in);

-- ═══════════════════════════════════════════════════════════
-- 찜 수 집계 뷰
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW campground_favorites_count AS
SELECT campground_id, COUNT(*) as favorite_count
FROM user_favorites GROUP BY campground_id;

-- ═══════════════════════════════════════════════════════════
-- RLS 정책
-- ═══════════════════════════════════════════════════════════
ALTER TABLE campgrounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_camping_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_plan_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_camping_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE campground_user_tags ENABLE ROW LEVEL SECURITY;

-- campgrounds: 누구나 읽기 가능
CREATE POLICY "campgrounds_read_all" ON campgrounds FOR SELECT USING (true);

-- user_camping_modes: 본인만 CRUD
CREATE POLICY "user_camping_modes_select" ON user_camping_modes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_camping_modes_insert" ON user_camping_modes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_camping_modes_update" ON user_camping_modes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_camping_modes_delete" ON user_camping_modes FOR DELETE USING (auth.uid() = user_id);

-- user_plan_locks: 본인만 CRUD
CREATE POLICY "user_plan_locks_select" ON user_plan_locks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_plan_locks_insert" ON user_plan_locks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_plan_locks_update" ON user_plan_locks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_plan_locks_delete" ON user_plan_locks FOR DELETE USING (auth.uid() = user_id);

-- user_favorites: 본인만 CRUD
CREATE POLICY "user_favorites_select" ON user_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_favorites_insert" ON user_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_favorites_delete" ON user_favorites FOR DELETE USING (auth.uid() = user_id);

-- user_camping_schedules: 본인만 CRUD
CREATE POLICY "user_camping_schedules_select" ON user_camping_schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_camping_schedules_insert" ON user_camping_schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_camping_schedules_update" ON user_camping_schedules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_camping_schedules_delete" ON user_camping_schedules FOR DELETE USING (auth.uid() = user_id);

-- record_tags: 본인 기록의 태그만 관리 (posts 테이블 조인 필요 - 추후 RPC로 처리)
CREATE POLICY "record_tags_select" ON record_tags FOR SELECT USING (true);
CREATE POLICY "record_tags_insert" ON record_tags FOR INSERT WITH CHECK (true);
CREATE POLICY "record_tags_delete" ON record_tags FOR DELETE USING (true);

-- campground_user_tags: 본인만 CRUD
CREATE POLICY "campground_user_tags_select" ON campground_user_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "campground_user_tags_insert" ON campground_user_tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "campground_user_tags_update" ON campground_user_tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "campground_user_tags_delete" ON campground_user_tags FOR DELETE USING (auth.uid() = user_id);

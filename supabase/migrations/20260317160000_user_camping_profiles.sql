-- ============================================================
-- Migration: user_camping_profiles
-- 사용자 캠핑 프로필 (출발지 + 인원 구성) 통합 테이블
-- 한 번 입력하면 예약/일정/추천/스마트플랜 모두에서 재사용
-- ============================================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS user_camping_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 출발지 정보
  origin_label TEXT,              -- "서울 강남구" (표시용)
  origin_lat DOUBLE PRECISION,
  origin_lng DOUBLE PRECISION,
  -- 인원 구성
  adults INT DEFAULT 2,
  kids_preschool INT DEFAULT 0,
  kids_elementary INT DEFAULT 0,
  kids_teen INT DEFAULT 0,
  has_pet BOOLEAN DEFAULT false,
  -- 메타
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. RLS 활성화
ALTER TABLE user_camping_profiles ENABLE ROW LEVEL SECURITY;

-- 3. RLS 정책: 본인 레코드만 CRUD 가능
CREATE POLICY "Users can read own camping profile"
  ON user_camping_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own camping profile"
  ON user_camping_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own camping profile"
  ON user_camping_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. Upsert RPC 함수 (첫 입력 & 수정 동일 함수)
CREATE OR REPLACE FUNCTION upsert_camping_profile(
  p_user_id UUID,
  p_origin_label TEXT DEFAULT NULL,
  p_origin_lat DOUBLE PRECISION DEFAULT NULL,
  p_origin_lng DOUBLE PRECISION DEFAULT NULL,
  p_adults INT DEFAULT 2,
  p_kids_preschool INT DEFAULT 0,
  p_kids_elementary INT DEFAULT 0,
  p_kids_teen INT DEFAULT 0,
  p_has_pet BOOLEAN DEFAULT false
) RETURNS VOID AS $$
BEGIN
  INSERT INTO user_camping_profiles (
    user_id, origin_label, origin_lat, origin_lng,
    adults, kids_preschool, kids_elementary, kids_teen, has_pet,
    created_at, updated_at
  ) VALUES (
    p_user_id, p_origin_label, p_origin_lat, p_origin_lng,
    p_adults, p_kids_preschool, p_kids_elementary, p_kids_teen, p_has_pet,
    now(), now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    origin_label = COALESCE(EXCLUDED.origin_label, user_camping_profiles.origin_label),
    origin_lat = COALESCE(EXCLUDED.origin_lat, user_camping_profiles.origin_lat),
    origin_lng = COALESCE(EXCLUDED.origin_lng, user_camping_profiles.origin_lng),
    adults = EXCLUDED.adults,
    kids_preschool = EXCLUDED.kids_preschool,
    kids_elementary = EXCLUDED.kids_elementary,
    kids_teen = EXCLUDED.kids_teen,
    has_pet = EXCLUDED.has_pet,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC 실행 권한 부여
GRANT EXECUTE ON FUNCTION upsert_camping_profile(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INT, INT, INT, INT, BOOLEAN)
  TO authenticated;

-- 6. 인덱스
CREATE INDEX IF NOT EXISTS idx_camping_profiles_user_id ON user_camping_profiles(user_id);

RAISE NOTICE '✅ user_camping_profiles 테이블 및 RPC 생성 완료';

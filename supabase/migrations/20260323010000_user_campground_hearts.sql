-- ============================================================
-- Migration: user_campground_hearts
-- 사용자 캠핑장 '찜' (좋아요) 테이블
-- ============================================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS user_campground_hearts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campground_id UUID NOT NULL REFERENCES campgrounds(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, campground_id)
);

-- 2. RLS 활성화
ALTER TABLE user_campground_hearts ENABLE ROW LEVEL SECURITY;

-- 3. RLS 정책
CREATE POLICY "Users can read own hearts"
  ON user_campground_hearts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hearts"
  ON user_campground_hearts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own hearts"
  ON user_campground_hearts FOR DELETE
  USING (auth.uid() = user_id);

-- 4. 인덱스
CREATE INDEX IF NOT EXISTS idx_user_campground_hearts_user_id ON user_campground_hearts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_campground_hearts_campground_id ON user_campground_hearts(campground_id);

-- 5. RPC (Toggle Heart)
CREATE OR REPLACE FUNCTION toggle_campground_heart(
  p_campground_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_campground_hearts 
    WHERE user_id = auth.uid() AND campground_id = p_campground_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM user_campground_hearts 
    WHERE user_id = auth.uid() AND campground_id = p_campground_id;
    RETURN FALSE; -- Heart removed
  ELSE
    INSERT INTO user_campground_hearts (user_id, campground_id)
    VALUES (auth.uid(), p_campground_id);
    RETURN TRUE; -- Heart added
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION toggle_campground_heart(UUID) TO authenticated;

-- 6. 찜 수 집계 뷰 (Replaces legacy campground_favorites_count if exists)
CREATE OR REPLACE VIEW campground_hearts_count AS
SELECT campground_id, COUNT(*) as heart_count
FROM user_campground_hearts GROUP BY campground_id;

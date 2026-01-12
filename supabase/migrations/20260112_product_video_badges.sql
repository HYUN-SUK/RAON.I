-- =====================================================
-- 상품 데이터 최적화 마이그레이션
-- YouTube/쇼츠 임베드 및 혜택 배지 지원
-- 2026-01-12
-- =====================================================

-- 1. products 테이블에 영상 및 배지 컬럼 추가
-- =====================================================

-- 영상 URL (YouTube, Instagram Reels, TikTok 등)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- 영상 플랫폼 타입 (youtube, youtube_shorts, instagram, tiktok)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS video_type TEXT;

-- 혜택 배지 배열 (free_shipping, quality_guarantee, limited_stock, gift_included, best_seller, new_arrival)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS badges TEXT[];

-- 2. 컬럼 설명 추가
-- =====================================================
COMMENT ON COLUMN products.video_url IS '상품 소개 영상 URL (YouTube/Instagram/TikTok 임베드용)';
COMMENT ON COLUMN products.video_type IS '영상 플랫폼 타입 (youtube, youtube_shorts, instagram, tiktok)';
COMMENT ON COLUMN products.badges IS '혜택 배지 배열 (free_shipping, quality_guarantee, limited_stock, gift_included, best_seller, new_arrival)';

-- 3. 유효한 video_type 값 체크 제약조건 (선택사항)
-- =====================================================
ALTER TABLE products
ADD CONSTRAINT valid_video_type 
CHECK (video_type IS NULL OR video_type IN ('youtube', 'youtube_shorts', 'instagram', 'tiktok'));

-- 4. 기존 상품에 기본 배지 설정 (선택사항 - 주석 해제하여 실행)
-- =====================================================
-- UPDATE products 
-- SET badges = ARRAY['free_shipping', 'quality_guarantee']
-- WHERE badges IS NULL;

-- 5. 인덱스 추가 (배지 검색 최적화용 - 선택사항)
-- =====================================================
-- CREATE INDEX IF NOT EXISTS idx_products_badges ON products USING GIN (badges);

-- =====================================================
-- 실행 완료 메시지
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'Products table updated with video_url, video_type, badges columns';
END $$;

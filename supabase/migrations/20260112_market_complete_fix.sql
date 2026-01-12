-- =====================================================
-- 마켓 기능 DB 설정 (안전한 재실행 버전)
-- 2026-01-12
-- =====================================================

-- 1. 카테고리 관리 컬럼 추가 (site_config)
-- 이미 존재하면 건너뜀
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_config' AND column_name = 'market_categories') THEN
        ALTER TABLE site_config ADD COLUMN market_categories JSONB DEFAULT '[
            {"id": "lantern", "label": "조명/랜턴", "order": 1},
            {"id": "tableware", "label": "식기/키친", "order": 2},
            {"id": "furniture", "label": "가구/체어", "order": 3},
            {"id": "goods", "label": "굿즈", "order": 4}
        ]'::jsonb;
        RAISE NOTICE 'market_categories column added';
    ELSE
        RAISE NOTICE 'market_categories column already exists';
    END IF;
END $$;

-- 2. 상품 이미지 스토리지 버킷 생성
-- 이미 존재하면 건너뜀
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product_images', 'product_images', true, 5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
) ON CONFLICT (id) DO NOTHING;

-- 3. 스토리지 정책 설정 (중복 에러 방지)
DO $$
BEGIN
    -- 읽기 정책
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Read Access for product_images'
    ) THEN
        CREATE POLICY "Public Read Access for product_images"
        ON storage.objects FOR SELECT USING (bucket_id = 'product_images');
        RAISE NOTICE 'Read policy created';
    ELSE
        RAISE NOTICE 'Read policy already exists';
    END IF;

    -- 업로드 정책
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated Upload for product_images'
    ) THEN
        CREATE POLICY "Authenticated Upload for product_images"
        ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product_images' AND auth.role() = 'authenticated');
        RAISE NOTICE 'Upload policy created';
    ELSE
        RAISE NOTICE 'Upload policy already exists';
    END IF;
END $$;

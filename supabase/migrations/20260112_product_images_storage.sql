-- =====================================================
-- 상품 이미지 Storage 버킷 생성
-- 2026-01-12
-- =====================================================

-- 1. product_images 버킷 생성 (공개 접근)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product_images',
    'product_images',
    true,  -- 공개 버킷 (URL로 직접 접근 가능)
    5242880,  -- 5MB 제한
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[];

-- 2. Storage 정책: 모든 사용자가 읽기 가능
CREATE POLICY "Public Read Access for product_images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product_images');

-- 3. Storage 정책: 인증된 사용자만 업로드 가능
CREATE POLICY "Authenticated Upload for product_images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'product_images' 
    AND auth.role() = 'authenticated'
);

-- 4. Storage 정책: 인증된 사용자가 삭제 가능
CREATE POLICY "Authenticated Delete for product_images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'product_images' 
    AND auth.role() = 'authenticated'
);

-- =====================================================
-- 완료 메시지
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'product_images bucket created with public access';
END $$;

-- 1. sites 테이블에 image_urls 컬럼 추가 (TEXT 배열 타입)
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT ARRAY[]::text[];

-- 2. 기존 데이터 초기화 (기존 image_url이 등록되어 있다면 image_urls의 첫번째 요소로 마이그레이션)
UPDATE public.sites 
SET image_urls = ARRAY[image_url] 
WHERE image_url IS NOT NULL 
  AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL OR array_length(image_urls, 1) = 0);

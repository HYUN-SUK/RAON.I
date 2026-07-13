-- 1. sites 테이블에 가격 정책 컬럼 추가 (멱등성 보장 PL/pgSQL 블록)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sites' AND column_name='weekday') THEN
        ALTER TABLE public.sites ADD COLUMN weekday INTEGER DEFAULT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sites' AND column_name='weekend') THEN
        ALTER TABLE public.sites ADD COLUMN weekend INTEGER DEFAULT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sites' AND column_name='peak_weekday') THEN
        ALTER TABLE public.sites ADD COLUMN peak_weekday INTEGER DEFAULT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sites' AND column_name='peak_weekend') THEN
        ALTER TABLE public.sites ADD COLUMN peak_weekend INTEGER DEFAULT NULL;
    END IF;
END $$;

-- 2. 에어컨 대여 (8개 에어컨 기기) 초기 데이터 적재
INSERT INTO public.sites (id, name, site_type, capacity, base_price, price, is_active, description, features)
VALUES 
  ('air-1', '에어컨 1번', 'AIR_CON', 1, 10000, 10000, true, '여름 한시 에어컨 대여 서비스입니다.', ARRAY['에어컨 대여', '하루 1만원']),
  ('air-2', '에어컨 2번', 'AIR_CON', 1, 10000, 10000, true, '여름 한시 에어컨 대여 서비스입니다.', ARRAY['에어컨 대여', '하루 1만원']),
  ('air-3', '에어컨 3번', 'AIR_CON', 1, 10000, 10000, true, '여름 한시 에어컨 대여 서비스입니다.', ARRAY['에어컨 대여', '하루 1만원']),
  ('air-4', '에어컨 4번', 'AIR_CON', 1, 10000, 10000, true, '여름 한시 에어컨 대여 서비스입니다.', ARRAY['에어컨 대여', '하루 1만원']),
  ('air-5', '에어컨 5번', 'AIR_CON', 1, 10000, 10000, true, '여름 한시 에어컨 대여 서비스입니다.', ARRAY['에어컨 대여', '하루 1만원']),
  ('air-6', '에어컨 6번', 'AIR_CON', 1, 10000, 10000, true, '여름 한시 에어컨 대여 서비스입니다.', ARRAY['에어컨 대여', '하루 1만원']),
  ('air-7', '에어컨 7번', 'AIR_CON', 1, 10000, 10000, true, '여름 한시 에어컨 대여 서비스입니다.', ARRAY['에어컨 대여', '하루 1만원']),
  ('air-8', '에어컨 8번', 'AIR_CON', 1, 10000, 10000, true, '여름 한시 에어컨 대여 서비스입니다.', ARRAY['에어컨 대여', '하루 1만원'])
ON CONFLICT (id) DO UPDATE 
SET 
  name = EXCLUDED.name, 
  site_type = EXCLUDED.site_type, 
  base_price = EXCLUDED.base_price, 
  price = EXCLUDED.price,
  capacity = EXCLUDED.capacity,
  description = EXCLUDED.description,
  features = EXCLUDED.features;

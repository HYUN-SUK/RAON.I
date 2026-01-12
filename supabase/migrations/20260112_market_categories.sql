-- =====================================================
-- 마켓 카테고리 동적 관리 마이그레이션
-- 2026-01-12
-- =====================================================

-- 1. site_config 테이블에 market_categories 컬럼 추가
-- JSON 배열 형태: [{"id": "lantern", "label": "조명/랜턴", "order": 1}, ...]
ALTER TABLE site_config
ADD COLUMN IF NOT EXISTS market_categories JSONB DEFAULT '[
    {"id": "lantern", "label": "조명/랜턴", "order": 1},
    {"id": "tableware", "label": "식기/키친", "order": 2},
    {"id": "furniture", "label": "가구/체어", "order": 3},
    {"id": "goods", "label": "굿즈", "order": 4}
]'::jsonb;

-- 2. 컬럼 설명 추가
COMMENT ON COLUMN site_config.market_categories IS '마켓 카테고리 목록 (JSON 배열: id, label, order)';

-- 3. 기존 데이터에 기본 카테고리 설정
UPDATE site_config
SET market_categories = '[
    {"id": "lantern", "label": "조명/랜턴", "order": 1},
    {"id": "tableware", "label": "식기/키친", "order": 2},
    {"id": "furniture", "label": "가구/체어", "order": 3},
    {"id": "goods", "label": "굿즈", "order": 4}
]'::jsonb
WHERE market_categories IS NULL;

-- =====================================================
-- 완료 메시지
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'market_categories column added to site_config';
END $$;

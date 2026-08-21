-- [20260821] Master Places Sido Sync Index & RPC
-- 일일 지역 로테이션 동기화 카운트 타임아웃 방지 및 고속 집계

-- 1. 복합 B-Tree 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_master_places_sido_source_active 
ON master_places (sido, api_source, is_active);

-- 2. 고속 사전/사후 집계 RPC 함수
CREATE OR REPLACE FUNCTION get_region_sync_counts(p_sido_aliases text[])
RETURNS TABLE(
    api_source text,
    active_count bigint,
    inactive_count bigint
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mp.api_source,
        COUNT(*) FILTER (WHERE mp.is_active = true) AS active_count,
        COUNT(*) FILTER (WHERE mp.is_active = false) AS inactive_count
    FROM master_places mp
    WHERE mp.sido = ANY(p_sido_aliases)
    GROUP BY mp.api_source;
END;
$$;

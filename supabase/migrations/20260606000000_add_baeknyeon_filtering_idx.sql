-- master_places 테이블의 api_source 검색 및 삭제 속도 향상을 위한 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_master_places_api_source ON master_places(api_source);

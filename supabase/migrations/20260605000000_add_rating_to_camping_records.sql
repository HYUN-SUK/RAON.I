-- camping_records 테이블에 rating(만족도 별점) 컬럼 추가
ALTER TABLE camping_records ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 0;

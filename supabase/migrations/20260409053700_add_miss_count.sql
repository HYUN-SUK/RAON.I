-- miss_count: 3진 아웃(Multi-Strike) Soft Delete 방식 지원
-- API 로테이션에서 연속 미확인 횟수를 추적하여 일시적 API 오류로 인한 데이터 손실 방지
ALTER TABLE master_places ADD COLUMN IF NOT EXISTS miss_count INTEGER DEFAULT 0;

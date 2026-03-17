-- 20260317_add_api_status_to_logs.sql
ALTER TABLE public.automation_logs 
ADD COLUMN IF NOT EXISTS api_status JSONB;

COMMENT ON COLUMN public.automation_logs.api_status IS 'API별 상세 점검 결과 (JSON 배열)';

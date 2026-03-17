-- Migration: Add api_status column to automation_logs
ALTER TABLE public.automation_logs 
ADD COLUMN IF NOT EXISTS api_status JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.automation_logs.api_status IS '상세 API별 소통 현황 및 오류 정보 (JSON 배열)';

-- 1. 캠핏 연동 로그 테이블 생성
CREATE TABLE IF NOT EXISTS public.camfit_integration_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_raw TEXT NOT NULL,                     -- 수신된 알림톡 텍스트 원본
    external_id TEXT,                              -- 캠핏 예약번호 (예: C20260714000204)
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')), -- 연동 상태
    error_message TEXT,                            -- 실패 원인 상세
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. RLS 활성화
ALTER TABLE public.camfit_integration_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Allow public select on logs" ON public.camfit_integration_logs;
CREATE POLICY "Allow public select on logs"
ON public.camfit_integration_logs FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow public insert on logs" ON public.camfit_integration_logs;
CREATE POLICY "Allow public insert on logs"
ON public.camfit_integration_logs FOR INSERT
WITH CHECK (true);

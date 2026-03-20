-- 1. Create automation_logs table
CREATE TABLE IF NOT EXISTS public.automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,           -- 'MASTER_SYNC', 'SMART_PLAN_CACHING'
    status TEXT NOT NULL,             -- 'RUNNING', 'SUCCESS', 'FAILURE'
    processed_count INTEGER DEFAULT 0,
    message TEXT,
    duration_ms INTEGER,
    target_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add description for admin
COMMENT ON TABLE public.automation_logs IS '크론 자동화 작업의 실행 이력 및 성능 로그';

-- 3. Enable RLS
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DROP POLICY IF EXISTS "Public can read automation logs" ON public.automation_logs;
CREATE POLICY "Public can read automation logs"
ON public.automation_logs FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Service role can manage automation logs" ON public.automation_logs;
CREATE POLICY "Service role can manage automation logs"
ON public.automation_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Add index for performance
CREATE INDEX IF NOT EXISTS idx_automation_logs_job_name ON public.automation_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON public.automation_logs(created_at DESC);

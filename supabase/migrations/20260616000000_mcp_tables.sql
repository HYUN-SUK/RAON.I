-- [20260616] MCP API Keys & Usage Logs Tables

-- 1. Create mcp_api_keys table
CREATE TABLE IF NOT EXISTS public.mcp_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,                             -- 라온아이 회원 ID
    api_key_hash TEXT NOT NULL UNIQUE,                 -- SHA-256 해싱된 API 키
    key_hint TEXT,                                     -- 키 식별용 힌트 (예: "My Claude Client")
    tier TEXT DEFAULT 'FREE' CHECK (tier IN ('FREE', 'PRO', 'ENTERPRISE')), -- 요금제 티어
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_used_at TIMESTAMPTZ
);

-- 인덱스 추가 (빠른 해시 조회용)
CREATE INDEX IF NOT EXISTS idx_mcp_api_key_hash ON public.mcp_api_keys(api_key_hash);

-- RLS 활성화
ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS 정책 설정 (외부 일반 anon/authenticated 사용자는 SELECT 차단, service_role만 가능)
DROP POLICY IF EXISTS "Service role performs all operations on mcp_api_keys" ON public.mcp_api_keys;
CREATE POLICY "Service role performs all operations on mcp_api_keys" 
ON public.mcp_api_keys FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);


-- 2. Create mcp_usage_logs table (호출 미터링 및 감사용)
CREATE TABLE IF NOT EXISTS public.mcp_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES public.mcp_api_keys(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,                           -- 호출한 툴 이름
    request_ip TEXT,                                   -- 요청지 IP
    success BOOLEAN DEFAULT TRUE,                      -- 성공 여부
    execution_time_ms INTEGER,                         -- 실행 시간 (ms)
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 추가 (조회 및 분석용)
CREATE INDEX IF NOT EXISTS idx_mcp_logs_created_at ON public.mcp_usage_logs(created_at);

-- RLS 활성화
ALTER TABLE public.mcp_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책 설정 (service_role만 가능)
DROP POLICY IF EXISTS "Service role performs all operations on mcp_usage_logs" ON public.mcp_usage_logs;
CREATE POLICY "Service role performs all operations on mcp_usage_logs" 
ON public.mcp_usage_logs FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- ========================================================================================
-- Smart Persona System v2.0: 4-Layer Traceable Architecture
-- ========================================================================================

-- 1. User Action Log: 원본 행동 기록
CREATE TABLE IF NOT EXISTS public.user_action_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'RESERVATION', 'SCHEDULE_ADD', 'SMART_PLAN_SWAP', etc.
    entity_id TEXT,           -- 대상 ID (캠핑장 ID 등)
    entity_name TEXT,         -- 대상 명칭
    raw_metadata JSONB DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_user_action_log_user_id ON public.user_action_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_action_log_occurred_at ON public.user_action_log(occurred_at desc);

-- 2. User Tag Ledger: 태그 변동 내역 (장부)
CREATE TABLE IF NOT EXISTS public.user_tag_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_id UUID REFERENCES public.user_action_log(id) ON DELETE SET NULL,
    tag_id TEXT NOT NULL,      -- Canonical Tag ID (e.g., 'FAMILY_INFANT')
    delta_score NUMERIC NOT NULL,
    source_type TEXT DEFAULT 'AUTOMATIC', -- 'AUTOMATIC', 'MANUAL', 'LEGACY_MIGRATION'
    reason TEXT,               -- 변동 사유 요약
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_user_tag_ledger_user_id ON public.user_tag_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tag_ledger_tag_id ON public.user_tag_ledger(tag_id);

-- 3. User Persona Snapshots: 장기(Global) 성향 요약
CREATE TABLE IF NOT EXISTS public.user_persona_snapshots (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tags JSONB DEFAULT '{}'::jsonb, -- { "TAG_ID": score }
    last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Trip Persona Snapshots: 단기(Trip) 상황 요약
CREATE TABLE IF NOT EXISTS public.trip_persona_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trip_id TEXT,             -- 특정 일정(Schedule ID)과의 연결 (선택)
    tags JSONB DEFAULT '{}'::jsonb,
    constraints JSONB DEFAULT '{}'::jsonb, -- { "hasKids": true, "petCount": 1 }
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_trip_persona_snapshots_user_id ON public.trip_persona_snapshots(user_id);

-- RLS (Row Level Security) 설정
ALTER TABLE public.user_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tag_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_persona_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_persona_snapshots ENABLE ROW LEVEL SECURITY;

-- 사용자는 본인의 데이터만 조회 가능
DROP POLICY IF EXISTS "Users can view own action log" ON public.user_action_log;
CREATE POLICY "Users can view own action log" ON public.user_action_log FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own tag ledger" ON public.user_tag_ledger;
CREATE POLICY "Users can view own tag ledger" ON public.user_tag_ledger FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own persona snapshot" ON public.user_persona_snapshots;
CREATE POLICY "Users can view own persona snapshot" ON public.user_persona_snapshots FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own trip snapshot" ON public.trip_persona_snapshots;
CREATE POLICY "Users can view own trip snapshot" ON public.trip_persona_snapshots FOR SELECT USING (auth.uid() = user_id);

-- 서비스 역할(서버 사이드)만 쓰기 가능
DROP POLICY IF EXISTS "Service role full access action log" ON public.user_action_log;
CREATE POLICY "Service role full access action log" ON public.user_action_log FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access tag ledger" ON public.user_tag_ledger;
CREATE POLICY "Service role full access tag ledger" ON public.user_tag_ledger FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access persona snapshot" ON public.user_persona_snapshots;
CREATE POLICY "Service role full access persona snapshot" ON public.user_persona_snapshots FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access trip snapshot" ON public.trip_persona_snapshots;
CREATE POLICY "Service role full access trip snapshot" ON public.trip_persona_snapshots FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 완료 메시지
COMMENT ON TABLE public.user_action_log IS '사용자 행동 원본 로그 (Traceability 원천)';
COMMENT ON TABLE public.user_tag_ledger IS '태그 점수 변동 장부 (설명 가능한 추천의 근거)';
COMMENT ON TABLE public.user_persona_snapshots IS '사용자 장기 성향 스냅샷 (Global Persona)';
COMMENT ON TABLE public.trip_persona_snapshots IS '사용자 이번 여행 성향/제약 스냅샷 (Contextual Persona)';

-- ========================================================================================
-- Smart Camping Plan Phase 2: Action-to-Tag Mapping System DDL
-- ========================================================================================
-- 사용자의 캠핑 취향(마스터 태그)을 유연하게 수집/분석하기 위한 스키마

-- 1. user_personas 테이블 생성
-- JSONB 칼럼을 사용하여 태그 추가/삭제/변경 시 스키마 변경 비용 최소화 (앱 유연성 보장)
CREATE TABLE IF NOT EXISTS public.user_personas (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tags JSONB DEFAULT '{}'::jsonb,  -- 예: {"#가족캠프": 12.5, "#불멍매니아": 5.0}
    last_action_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security) 설정
ALTER TABLE public.user_personas ENABLE ROW LEVEL SECURITY;

-- 사용자는 본인의 페르소나 정보만 읽을 수 있음
DROP POLICY IF EXISTS "Users can view own persona" ON public.user_personas;
CREATE POLICY "Users can view own persona" ON public.user_personas
    FOR SELECT USING (auth.uid() = user_id);

-- 서버/Edge Function만 데이터를 (upsert/update) 기록할 수 있도록 제어 
-- (브라우저 클라이언트가 임의로 점수 조작 불가)
DROP POLICY IF EXISTS "Service role full access persona" ON public.user_personas;
CREATE POLICY "Service role full access persona" ON public.user_personas
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- 2. add_user_tag RPC (안전한 동시성 처리 및 UPSERT 로직)
-- 입력된 태그의 가중치(Weight)를 기존 태그 지갑(JSONB)에 원자적으로 누적합니다.
DROP FUNCTION IF EXISTS add_user_tag(UUID, TEXT, NUMERIC) CASCADE;
CREATE OR REPLACE FUNCTION add_user_tag(
    p_user_id UUID,
    p_tag TEXT,
    p_weight NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_weight NUMERIC;
BEGIN
    -- user_personas 레코드가 없으면 생성, 있으면 락을 잡고 수행
    INSERT INTO public.user_personas (user_id, tags, last_action_at)
    VALUES (
        p_user_id, 
        jsonb_build_object(p_tag, p_weight), 
        timezone('utc'::text, now())
    )
    ON CONFLICT (user_id) DO UPDATE 
    SET 
        -- 기존 태그의 값을 읽어와서 합산 (없으면 0으로 간주 후 합산)
        tags = public.user_personas.tags || jsonb_build_object(
            p_tag, 
            COALESCE((public.user_personas.tags->>p_tag)::NUMERIC, 0) + p_weight
        ),
        last_action_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now());
END;
$$;

GRANT EXECUTE ON FUNCTION add_user_tag(UUID, TEXT, NUMERIC) TO authenticated, anon;


-- 3. decay_user_tags (시간 감가상각 함수 - pg_cron 등을 통해 새벽에 실행)
-- 모든 태그의 점수를 일괄적으로 특정 비율(예: 0.95 = -5%)만큼 감소시킵니다.
-- 일정 점수(예: 0.1) 이하로 떨어진 태그는 제거하는 로직도 추후 추가 가능합니다.
DROP FUNCTION IF EXISTS decay_user_tags(NUMERIC) CASCADE;
CREATE OR REPLACE FUNCTION decay_user_tags(p_decay_factor NUMERIC DEFAULT 0.95)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
    v_new_tags JSONB;
    v_key TEXT;
    v_val NUMERIC;
BEGIN
    FOR r IN SELECT user_id, tags FROM public.user_personas LOOP
        v_new_tags := '{}'::jsonb;
        
        -- 각 태그를 순회하며 감가상각 적용
        FOR v_key, v_val IN SELECT * FROM jsonb_each_text(r.tags) LOOP
            -- 소수점 2자리까지만 남기고 버림. 만약 0.01 이하라면 아예 삭제 (가비지 컬렉션)
            v_val := ROUND((v_val::NUMERIC * p_decay_factor), 2);
            IF v_val > 0.05 THEN
                v_new_tags := v_new_tags || jsonb_build_object(v_key, v_val);
            END IF;
        END LOOP;

        UPDATE public.user_personas
        SET tags = v_new_tags
        WHERE user_id = r.user_id;
    END LOOP;
END;
$$;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ Phase 2: Action-to-Tag 시스템 스키마 생성 완료';
    RAISE NOTICE '  - Table: user_personas (JSONB tag wallet)';
    RAISE NOTICE '  - RPC: add_user_tag (Atomic Upsert)';
    RAISE NOTICE '  - RPC: decay_user_tags (Time Decay GC)';
END $$;

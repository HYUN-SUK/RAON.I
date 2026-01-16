-- User Permission Consents 테이블
-- 위치/푸시 동의 여부만 저장 (실제 위치 정보는 저장하지 않음)

CREATE TABLE IF NOT EXISTS public.user_permission_consents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    location_granted boolean DEFAULT false,
    push_granted boolean DEFAULT false,
    location_granted_at timestamp with time zone,
    push_granted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.user_permission_consents ENABLE ROW LEVEL SECURITY;

-- 사용자 정책: 본인 데이터 조회/수정 가능
CREATE POLICY "Users can view their own consents"
ON public.user_permission_consents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their own consents"
ON public.user_permission_consents FOR ALL
USING (auth.uid() = user_id);

-- 관리자 정책: 전체 조회 가능 (집계용)
CREATE POLICY "Admins can view all consents"
ON public.user_permission_consents FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- 인덱스 생성 (집계 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_user_permission_consents_location 
ON public.user_permission_consents(location_granted);

CREATE INDEX IF NOT EXISTS idx_user_permission_consents_push 
ON public.user_permission_consents(push_granted);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_user_permission_consents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_permission_consents_updated_at
    BEFORE UPDATE ON public.user_permission_consents
    FOR EACH ROW
    EXECUTE FUNCTION update_user_permission_consents_updated_at();

-- ============================================
-- 기존 push_tokens 데이터 기반 마이그레이션
-- (이미 푸시 동의한 사용자들을 집계에 포함)
-- ============================================
INSERT INTO user_permission_consents (user_id, push_granted, push_granted_at)
SELECT DISTINCT user_id, true, created_at
FROM push_tokens
WHERE user_id IS NOT NULL AND is_active = true
ON CONFLICT (user_id) DO UPDATE SET
    push_granted = true,
    push_granted_at = EXCLUDED.push_granted_at;

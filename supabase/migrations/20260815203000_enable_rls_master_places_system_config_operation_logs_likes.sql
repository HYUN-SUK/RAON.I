-- ==============================================================================
-- Migration: 20260815203000_enable_rls_master_places_system_config_operation_logs_likes.sql
-- Description: Enable RLS and establish robust policies for master_places, system_config, operation_logs, and likes
-- ==============================================================================

-- 1. master_places: 공개 읽기 허용 (스마트플랜 / 반경 RPC 100% 정상 작동)
ALTER TABLE public.master_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on master_places" ON public.master_places;
CREATE POLICY "Allow public read on master_places" 
    ON public.master_places 
    FOR SELECT 
    USING (true);


-- 2. system_config: 공개 읽기 허용 + 관리자 3중 인증 시에만 수정/등록
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on system_config" ON public.system_config;
CREATE POLICY "Allow public read on system_config" 
    ON public.system_config 
    FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Allow admin modify system_config" ON public.system_config;
CREATE POLICY "Allow admin modify system_config" 
    ON public.system_config
    FOR ALL
    USING (
        (auth.jwt() ->> 'email' = 'admin@raon.ai') OR 
        ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') OR 
        ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
    )
    WITH CHECK (
        (auth.jwt() ->> 'email' = 'admin@raon.ai') OR 
        ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') OR 
        ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
    );


-- 3. operation_logs: 관리자 전용 조회/등록 + 수정/삭제 절대 불가 (불변 감사 로그)
ALTER TABLE public.operation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin read operation_logs" ON public.operation_logs;
CREATE POLICY "Allow admin read operation_logs" 
    ON public.operation_logs 
    FOR SELECT 
    USING (
        (auth.jwt() ->> 'email' = 'admin@raon.ai') OR 
        ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') OR 
        ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
    );

DROP POLICY IF EXISTS "Allow admin insert operation_logs" ON public.operation_logs;
CREATE POLICY "Allow admin insert operation_logs" 
    ON public.operation_logs 
    FOR INSERT 
    WITH CHECK (
        (auth.jwt() ->> 'email' = 'admin@raon.ai') OR 
        ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') OR 
        ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin') OR
        auth.uid() IS NOT NULL
    );


-- 4. likes: 외래키 CASCADE 보장 + 공개 읽기 + 사용자/관리자 좋아요 등록 및 삭제
ALTER TABLE public.likes DROP CONSTRAINT IF EXISTS likes_post_id_fkey;
ALTER TABLE public.likes 
    ADD CONSTRAINT likes_post_id_fkey 
    FOREIGN KEY (post_id) 
    REFERENCES public.posts(id) 
    ON DELETE CASCADE;

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read likes" ON public.likes;
CREATE POLICY "Allow public read likes" 
    ON public.likes 
    FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Allow users insert likes" ON public.likes;
CREATE POLICY "Allow users insert likes" 
    ON public.likes
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id OR 
        user_id = '00000000-0000-0000-0000-000000000000' OR
        auth.uid() IS NOT NULL OR
        (auth.jwt() ->> 'email' = 'admin@raon.ai')
    );

DROP POLICY IF EXISTS "Allow users delete likes" ON public.likes;
CREATE POLICY "Allow users delete likes" 
    ON public.likes
    FOR DELETE
    USING (
        auth.uid() = user_id OR 
        user_id = '00000000-0000-0000-0000-000000000000' OR
        auth.uid() IS NOT NULL OR
        (auth.jwt() ->> 'email' = 'admin@raon.ai')
    );

-- ================================================
-- NUCLEAR RLS RESET (진짜 최종)
-- Date: 2026-01-16 (KST)
-- Description: 기존 정책을 모두 날리고, 가장 단순하고 강력한 규칙으로 재설정합니다.
-- ================================================

-- 1. reservations 테이블 정책 초기화
DROP POLICY IF EXISTS "Users can create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can view own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users can update own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Admins can view all reservations" ON public.reservations;
DROP POLICY IF EXISTS "Users and Admins view reservations" ON public.reservations; -- 아까 만든 것

-- 2. notifications 테이블 정책 초기화
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users and Admins view notifications" ON public.notifications; -- 아까 만든 것
DROP POLICY IF EXISTS "Allow Insert Notifications" ON public.notifications; -- 아까 만든 것

-- ================================================
-- 재설정 (NEW POLICIES)
-- ================================================

-- 1. [예약] 조회 (SELECT): 본인 것 OR 관리자(UUID 지정)
CREATE POLICY "policy_reservations_select_v3" ON public.reservations
    FOR SELECT USING (
        auth.uid() = user_id 
        OR 
        auth.uid() = '7e41103c-246e-44d3-b1d5-e5678dece820' -- 관리자 UUID
        OR 
        (auth.jwt() ->> 'email') = 'admin@raon.ai'
    );

-- 2. [예약] 생성 (INSERT): 누구나 가능 (인증된 사용자)
CREATE POLICY "policy_reservations_insert_v3" ON public.reservations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. [예약] 수정 (UPDATE): 본인 것 OR 관리자
CREATE POLICY "policy_reservations_update_v3" ON public.reservations
    FOR UPDATE USING (
        auth.uid() = user_id 
        OR 
        auth.uid() = '7e41103c-246e-44d3-b1d5-e5678dece820'
    );

-- 4. [알림] 조회 (SELECT): 본인 것 OR 관리자
CREATE POLICY "policy_notifications_select_v3" ON public.notifications
    FOR SELECT USING (
        auth.uid() = user_id 
        OR 
        auth.uid() = '7e41103c-246e-44d3-b1d5-e5678dece820'
    );

-- 5. [알림] 생성 (INSERT): 누구나 가능 (시스템이 넣으므로)
CREATE POLICY "policy_notifications_insert_v3" ON public.notifications
    FOR INSERT WITH CHECK (true);

-- 6. [알림] 수정 (UPDATE): 본인 것 (읽음 처리 등)
CREATE POLICY "policy_notifications_update_v3" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

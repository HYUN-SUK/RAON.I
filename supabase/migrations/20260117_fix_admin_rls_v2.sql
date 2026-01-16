-- ================================================
-- Fix Admin RLS (Broader Email Check)
-- Date: 2026-01-17
-- Description: Improve Admin visibility by checking user_metadata as well.
-- ================================================

-- 1. RESERVATIONS
DROP POLICY IF EXISTS "Users and Admins view reservations" ON public.reservations;

CREATE POLICY "Users and Admins view reservations" ON public.reservations
    FOR SELECT USING (
        (auth.uid() = user_id)
        OR 
        -- Check both top-level email claim AND user_metadata email
        (auth.jwt() ->> 'email' = 'admin@raon.ai')
        OR
        ((auth.jwt() -> 'user_metadata' ->> 'email') = 'admin@raon.ai')
    );

-- 2. NOTIFICATIONS
DROP POLICY IF EXISTS "Users and Admins view notifications" ON public.notifications;

CREATE POLICY "Users and Admins view notifications" ON public.notifications
    FOR SELECT USING (
        (auth.uid() = user_id)
        OR 
        (auth.jwt() ->> 'email' = 'admin@raon.ai')
        OR
        ((auth.jwt() -> 'user_metadata' ->> 'email') = 'admin@raon.ai')
    );

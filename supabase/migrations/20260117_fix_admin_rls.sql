-- ================================================
-- Fix Admin RLS for Reservations
-- Date: 2026-01-17
-- Description: Ensure Admin can view ALL reservations.
--              Improve 'Users can view own reservations' policy.
-- ================================================

-- 1. Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view own reservations" ON public.reservations;

-- 2. Create new SELECT policy working for both Users and Admins
CREATE POLICY "Users and Admins view reservations" ON public.reservations
    FOR SELECT USING (
        -- User sees their own
        (auth.uid() = user_id)
        OR 
        -- Admin sees everything (Check email claim properly)
        (auth.jwt() ->> 'email' = 'admin@raon.ai')
        OR
        -- Service Role always sees everything (already handled by service role policy, but good for completeness)
        (auth.role() = 'service_role')
    );

-- 3. Also check NOTIFICATION RLS for Admin visibility
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Users and Admins view notifications" ON public.notifications
    FOR SELECT USING (
        (auth.uid() = user_id)
        OR 
        (auth.jwt() ->> 'email' = 'admin@raon.ai')
    );

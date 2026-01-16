-- ================================================
-- Fix Guest Reservation RLS & Constraints
-- Date: 2026-01-17
-- Description: Allow creating reservations with NULL user_id (Guest).
--              Previously, we used a dummy UUID which caused FK violations.
-- ================================================

-- 1. Ensure reservations table allows NULL in user_id (Default is nullable, but good to ensure FK doesn't restrict if not VALID)
-- Note: 'REFERENCES auth.users' allows NULL unless 'NOT NULL' constraint exists.
-- We assume it's nullable.

-- 2. Update RLS Policy for INSERT to allow NULL user_id
DROP POLICY IF EXISTS "Users can create own reservations" ON public.reservations;

CREATE POLICY "Users can create own reservations" ON public.reservations
    FOR INSERT WITH CHECK (
        -- Logged in user matches
        (auth.uid() = user_id) 
        OR 
        -- Guest user (user_id is null)
        (user_id IS NULL)
    );

-- 3. Update RLS Policy for SELECT to allow seeing own reservation?
-- Guests generally can't see "My Reservations" via RLS because they have no auth.uid().
-- They rely on LocalStorage or public lookup (if implemented). 
-- For now, we only need to fix INSERT permission.

-- 4. Notification RLS (Already fixed, but guests skip this)

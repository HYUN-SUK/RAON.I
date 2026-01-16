-- ================================================
-- Fix Notification RLS Policy
-- Date: 2026-01-17
-- Description: Allow authenticated users to insert their own notifications.
-- Required for: Reservation confirmation notifications created by client-side logic.
-- ================================================

-- DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;

create policy "Users can insert their own notifications"
on public.notifications for insert
with check ( auth.uid() = user_id );

-- Optional: If we want users to send notifications to OTHERS (e.g. Admin), 
-- we might need a broader policy or a Security Definer function.
-- For now, we prioritize self-notifications (Reservation Submitted).

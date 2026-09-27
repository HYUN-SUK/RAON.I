-- [20260927000000_fix_notifications_update_rls.sql]
-- Allow authenticated users to update their own notifications (e.g. mark as read)

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow Admins to insert notifications for ANY user (Reservation Confirmation, etc.)
-- Current policy "Users can insert their own notifications" restricts to auth.uid() = user_id

DROP POLICY IF EXISTS "Admins can insert any notifications" ON public.notifications;

CREATE POLICY "Admins can insert any notifications"
ON public.notifications FOR INSERT
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'service_role'
);

-- Also ensure Admins can SELECT any notification (to see history in Admin Console if needed)
DROP POLICY IF EXISTS "Admins can view any notifications" ON public.notifications;

CREATE POLICY "Admins can view any notifications"
ON public.notifications FOR SELECT
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'service_role'
);

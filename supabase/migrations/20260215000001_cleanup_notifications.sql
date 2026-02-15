-- Drop POTENTIAL duplicate triggers that might cause double notifications
-- 'trigger_push_notification' is the current correct one.
-- 'on_notification_insert' was from v2.
-- 'push_notification_trigger' was from v1 (hypothetically).

DROP TRIGGER IF EXISTS on_notification_insert ON public.notifications;
DROP TRIGGER IF EXISTS push_notification_trigger ON public.notifications;

-- We KEEP 'trigger_push_notification' (created in 20260214...)

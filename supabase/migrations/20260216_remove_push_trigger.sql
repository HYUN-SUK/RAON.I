-- Remove unreliable push notification trigger
-- We now invoke the Edge Function directly from the source (camping-reminder or application logic)

DROP TRIGGER IF EXISTS trigger_push_notification ON public.notifications;
DROP FUNCTION IF EXISTS public.handle_new_notification();

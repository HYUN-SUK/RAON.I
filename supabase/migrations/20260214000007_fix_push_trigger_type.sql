-- Fix: handle_new_notification trigger function
-- The pg_net.http_post() returns BIGINT, not UUID.
-- Declaring request_id as UUID caused: "invalid input syntax for type uuid: 91"

-- Drop and recreate the function
DROP FUNCTION IF EXISTS public.handle_new_notification() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_notification()
RETURNS TRIGGER AS $$
DECLARE
    project_url text := 'https://khqiqwtoyvesxahsjukk.supabase.co/functions/v1/push-notification';
    service_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocWlxd3RveXZlc3hhaHNqdWtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgzOTYwNSwiZXhwIjoyMDgxNDE1NjA1fQ.EKpyz8NvGZLbmTPn4m_-PZNeDD4GgcpzlqPDdY1inHI';
    request_id bigint;
BEGIN
    -- Only trigger for 'queued' status
    IF NEW.status = 'queued' THEN
        SELECT INTO request_id
            net.http_post(
                url := project_url,
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || service_key
                ),
                body := jsonb_build_object(
                    'record', row_to_json(NEW)
                )
            );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate Trigger
DROP TRIGGER IF EXISTS trigger_push_notification ON public.notifications;

CREATE TRIGGER trigger_push_notification
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_notification();

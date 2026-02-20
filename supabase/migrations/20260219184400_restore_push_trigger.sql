-- Restore Push Notification Trigger
-- This trigger invokes the 'push-notification' Edge Function when a new notification is inserted with status 'queued'.

CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Ensure permissions for pg_net
GRANT USAGE ON SCHEMA net TO postgres, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO postgres, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA net TO postgres, authenticated, service_role;
GRANT EXECUTE ON FUNCTION net.http_post(text, jsonb, jsonb, jsonb, integer) TO postgres, authenticated, service_role;

-- Function to call Edge Function
DROP FUNCTION IF EXISTS public.handle_new_notification() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_notification()
RETURNS TRIGGER AS $$
DECLARE
    project_url text := 'https://khqiqwtoyvesxahsjukk.supabase.co/functions/v1/push-notification';
    service_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocWlxd3RveXZlc3hhaHNqdWtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgzOTYwNSwiZXhwIjoyMDgxNDE1NjA1fQ.EKpyz8NvGZLbmTPn4m_-PZNeDD4GgcpzlqPDdY1inHI';
BEGIN
    -- Only trigger for 'queued' status
    IF NEW.status = 'queued' THEN
        PERFORM
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

-- Create Trigger
DROP TRIGGER IF EXISTS trigger_push_notification ON public.notifications;
CREATE TRIGGER trigger_push_notification
AFTER INSERT ON public.notifications
FOR EACH ROW
WHEN (NEW.status = 'queued')
EXECUTE FUNCTION public.handle_new_notification();

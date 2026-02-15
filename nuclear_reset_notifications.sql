
-- Drop table and cascade to triggers/policies
DROP TABLE IF EXISTS public.notifications CASCADE;

-- Recreate Table (Combined from 20260105 and 20260106)
CREATE TABLE public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- reservation, community, mission, etc.
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link TEXT,
    status TEXT DEFAULT 'queued',
    error_message TEXT,
    event_type TEXT,
    quiet_hours_override BOOLEAN DEFAULT FALSE,
    data JSONB DEFAULT '{}',
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Indices
CREATE INDEX IF NOT EXISTS idx_notifications_queued 
ON public.notifications(status, created_at) 
WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON public.notifications(user_id, created_at DESC);

-- Trigger Function (from 20260213)
CREATE OR REPLACE FUNCTION public.handle_new_notification()
RETURNS TRIGGER AS $$
DECLARE
    project_url text := 'https://khqiqwtoyvesxahsjukk.supabase.co/functions/v1/push-notification';
    service_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocWlxd3RveXZlc3hhaHNqdWtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgzOTYwNSwiZXhwIjoyMDgxNDE1NjA1fQ.EKpyz8NvGZLbmTPn4m_-PZNeDD4GgcpzlqPDdY1inHI';
    request_id uuid;
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

-- Create Trigger
DROP TRIGGER IF EXISTS trigger_push_notification ON public.notifications;

CREATE TRIGGER trigger_push_notification
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_notification();

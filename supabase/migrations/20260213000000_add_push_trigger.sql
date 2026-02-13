
-- Enable pg_net extension if not already enabled
create extension if not exists "pg_net";

-- Create a function to call the Edge Function
DROP FUNCTION IF EXISTS public.handle_new_notification() CASCADE;
create or replace function public.handle_new_notification()
returns trigger as $$
declare
    project_url text := 'https://khqiqwtoyvesxahsjukk.supabase.co/functions/v1/push-notification';
    service_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocWlxd3RveXZlc3hhaHNqdWtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgzOTYwNSwiZXhwIjoyMDgxNDE1NjA1fQ.EKpyz8NvGZLbmTPn4m_-PZNeDD4GgcpzlqPDdY1inHI';
    request_id uuid;
begin
    -- Only trigger for 'queued' status
    if new.status = 'queued' then
        select into request_id
            net.http_post(
                url := project_url,
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || service_key
                ),
                body := jsonb_build_object(
                    'record', row_to_json(new)
                )
            );
    end if;
    return new;
end;
$$ language plpgsql security definer;

-- Create the trigger
drop trigger if exists trigger_push_notification on public.notifications;

DROP TRIGGER IF EXISTS trigger_push_notification ON public.notifications;
create trigger trigger_push_notification
after insert on public.notifications
for each row
execute function public.handle_new_notification();

-- ==========================================================
-- RAON.I Camping Reminder Cron Job Setup
-- ==========================================================

-- 1. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 2. Define the Cron Job
-- Runs every day at 09:00 AM KST (00:00 UTC)
-- Invokes the 'camping-reminder' Edge Function via pg_net (or internal HTTP call)

SELECT cron.schedule(
    'invoke-camping-reminder',  -- Job Name
    '0 0 * * *',              -- Schedule (Every day at 00:00 UTC)
    $$
    select
      net.http_post(
          url:='https://khqiqwtoyvesxahsjukk.supabase.co/functions/v1/camping-reminder',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
);

-- Note: 'app.settings.service_role_key' needs to be set in the database session or hardcoded if necessary.
-- Alternatively, we can use the anon key if RLS allows, but service_role is safer for internal jobs.
-- For now, let's use a more standard approach if app settings aren't guaranteed:

-- ALTERNATIVE: Direct SQL update if pure DB logic was used, but here we need to call Edge Function.
-- We will use the standard Supabase way (pg_net).

-- Ensure pg_net is enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

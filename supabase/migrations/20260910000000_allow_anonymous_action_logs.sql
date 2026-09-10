-- ========================================================================================
-- Allow anonymous action logs for site visit (PV/UV) & instant plan generation
-- ========================================================================================

-- Drop NOT NULL constraint on user_id in public.user_action_log
ALTER TABLE public.user_action_log ALTER COLUMN user_id DROP NOT NULL;

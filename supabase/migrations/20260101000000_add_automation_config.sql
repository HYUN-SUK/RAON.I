-- Add automation_config column to open_day_rules table
-- This stores the JSON configuration for automated opening logic (e.g., { "monthsToAdd": 2, "targetDay": "END" })
ALTER TABLE public.open_day_rules
ADD COLUMN IF NOT EXISTS automation_config JSONB;

-- Comment on column for clarity
COMMENT ON COLUMN public.open_day_rules.automation_config IS 'Stores configuration for automated rules (e.g., months offset, specific day). Used when repeat_rule is MONTHLY.';

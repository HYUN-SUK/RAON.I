-- [v11.9.83] Add deposit_deadline_hours to site_config with a default value of 6
ALTER TABLE public.site_config 
ADD COLUMN IF NOT EXISTS deposit_deadline_hours integer DEFAULT 6 NOT NULL;

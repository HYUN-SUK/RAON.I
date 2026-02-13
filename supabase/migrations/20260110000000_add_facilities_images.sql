-- Add facilities description and image array columns
ALTER TABLE site_config 
ADD COLUMN IF NOT EXISTS facilities_description text,
ADD COLUMN IF NOT EXISTS bathroom_images jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS site_images jsonb DEFAULT '[]';

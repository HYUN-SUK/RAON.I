-- Add facilities description and image array columns
ALTER TABLE site_config 
ADD COLUMN facilities_description text,
ADD COLUMN bathroom_images jsonb DEFAULT '[]',
ADD COLUMN site_images jsonb DEFAULT '[]';

-- Migration: Add Creator Identity Fields
-- Date: 2025-12-21
-- Description: Adds nickname and profile_image_url to creators table.

-- Add columns
ALTER TABLE creators 
ADD COLUMN IF NOT EXISTS nickname TEXT,
ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- Add constraint for unique nickname only if it's not null (initially)
-- We might want to enforce uniqueness.
ALTER TABLE creators
ADD CONSTRAINT creators_nickname_key UNIQUE (nickname);

-- Update RLS to allow public read of these fields (already covered by "true" policy but good to note)
-- "Public creators are viewable by everyone" ON creators FOR SELECT USING (true); -> Covers new columns.

-- Comment on columns
COMMENT ON COLUMN creators.nickname IS 'Public display name for the creator (Creator Identity)';
COMMENT ON COLUMN creators.profile_image_url IS 'Public avatar URL for the creator';

-- Create Enums
CREATE TYPE creator_content_type AS ENUM ('LIVE', 'NOVEL', 'WEBTOON', 'ESSAY', 'ALBUM');
CREATE TYPE creator_content_status AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'HIDDEN');
CREATE TYPE creator_content_visibility AS ENUM ('PUBLIC', 'PRIVATE');

-- Create Creators Table (Profile)
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bio TEXT,
  region TEXT,
  portfolio_links JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Creator Contents Table (Series/Work)
CREATE TABLE IF NOT EXISTS creator_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  type creator_content_type NOT NULL,
  title TEXT NOT NULL,
  cover_image_url TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  status creator_content_status NOT NULL DEFAULT 'DRAFT',
  visibility creator_content_visibility NOT NULL DEFAULT 'PUBLIC',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Creator Episodes Table (Episodes)
CREATE TABLE IF NOT EXISTS creator_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES creator_contents(id) ON DELETE CASCADE,
  episode_no INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  body_ref JSONB, -- Stores text content, image URLs, or embed URL depending on type
  status creator_content_status NOT NULL DEFAULT 'DRAFT',
  visibility creator_content_visibility NOT NULL DEFAULT 'PUBLIC',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(content_id, episode_no)
);

-- Enable RLS
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_episodes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Creators
-- Public can view creators
CREATE POLICY "Public creators are viewable by everyone" ON creators
  FOR SELECT USING (true);

-- Users can insert their own creator profile
CREATE POLICY "Users can create their own creator profile" ON creators
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Creators can update their own profile
CREATE POLICY "Creators can update their own profile" ON creators
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for Creator Contents
-- Public can view PUBLISHED contents
CREATE POLICY "Published contents are viewable by everyone" ON creator_contents
  FOR SELECT USING (status = 'PUBLISHED' AND visibility = 'PUBLIC');

-- Creators can view all their own contents
CREATE POLICY "Creators can view their own contents" ON creator_contents
  FOR SELECT USING (auth.uid() = creator_id);

-- Creators can insert their own contents
CREATE POLICY "Creators can insert their own contents" ON creator_contents
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Creators can update their own contents
CREATE POLICY "Creators can update their own contents" ON creator_contents
  FOR UPDATE USING (auth.uid() = creator_id);

-- RLS Policies for Creator Episodes
-- Public can view PUBLISHED episodes of PUBLISHED contents
CREATE POLICY "Published episodes are viewable by everyone" ON creator_episodes
  FOR SELECT USING (
    status = 'PUBLISHED' 
    AND visibility = 'PUBLIC'
    AND EXISTS (
      SELECT 1 FROM creator_contents 
      WHERE id = creator_episodes.content_id 
      AND status = 'PUBLISHED'
    )
  );

-- Creators can view their own episodes
CREATE POLICY "Creators can view their own episodes" ON creator_episodes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM creator_contents
      WHERE id = creator_episodes.content_id
      AND creator_id = auth.uid()
    )
  );

-- Creators can insert their own episodes
CREATE POLICY "Creators can insert their own episodes" ON creator_episodes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM creator_contents
      WHERE id = creator_episodes.content_id
      AND creator_id = auth.uid()
    )
  );

-- Creators can update their own episodes
CREATE POLICY "Creators can update their own episodes" ON creator_episodes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM creator_contents
      WHERE id = creator_episodes.content_id
      AND creator_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
-- Check if triggers exist before creating them to avoid errors in idempotent runs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_creators_updated_at') THEN
        CREATE TRIGGER update_creators_updated_at BEFORE UPDATE ON creators FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_creator_contents_updated_at') THEN
        CREATE TRIGGER update_creator_contents_updated_at BEFORE UPDATE ON creator_contents FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_creator_episodes_updated_at') THEN
        CREATE TRIGGER update_creator_episodes_updated_at BEFORE UPDATE ON creator_episodes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;

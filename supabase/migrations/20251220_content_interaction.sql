-- Creator Content Interactions Migration
-- Created based on SSOT v9 (Quiet Empathy, Privacy First)

-- 1. Creator Content Likes Table
CREATE TABLE IF NOT EXISTS creator_content_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES creator_contents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(content_id, user_id)
);

-- 2. Creator Content Comments Table
CREATE TABLE IF NOT EXISTS creator_content_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES creator_contents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Creator Follows Table
CREATE TABLE IF NOT EXISTS creator_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(creator_id, follower_id)
);

-- 4. Enable RLS
ALTER TABLE creator_content_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_content_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_follows ENABLE ROW LEVEL SECURITY;

-- 5. Add Counters to creator_contents (Optimization for Reads)
ALTER TABLE creator_contents 
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

ALTER TABLE creators
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0;


-- 6. RLS Policies

-- Likes
CREATE POLICY "Likes are viewable by everyone" ON creator_content_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can like contents" ON creator_content_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike contents" ON creator_content_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Comments
CREATE POLICY "Comments are viewable by everyone" ON creator_content_comments
  FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON creator_content_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON creator_content_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Follows
CREATE POLICY "Follows are viewable by everyone" ON creator_follows
  FOR SELECT USING (true); -- Publicly viewable for counts, but UI might hide list

CREATE POLICY "Users can follow creators" ON creator_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow creators" ON creator_follows
  FOR DELETE USING (auth.uid() = follower_id);


-- 7. Functions & Triggers for Counters

-- Function to handle like count
CREATE OR REPLACE FUNCTION update_creator_content_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE creator_contents SET like_count = like_count + 1 WHERE id = NEW.content_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE creator_contents SET like_count = like_count - 1 WHERE id = OLD.content_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_creator_content_like_count
AFTER INSERT OR DELETE ON creator_content_likes
FOR EACH ROW EXECUTE FUNCTION update_creator_content_like_count();

-- Function to handle comment count
CREATE OR REPLACE FUNCTION update_creator_content_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE creator_contents SET comment_count = comment_count + 1 WHERE id = NEW.content_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE creator_contents SET comment_count = comment_count - 1 WHERE id = OLD.content_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_creator_content_comment_count
AFTER INSERT OR DELETE ON creator_content_comments
FOR EACH ROW EXECUTE FUNCTION update_creator_content_comment_count();

-- Function to handle follower count
CREATE OR REPLACE FUNCTION update_creator_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE creators SET follower_count = follower_count + 1 WHERE id = NEW.creator_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE creators SET follower_count = follower_count - 1 WHERE id = OLD.creator_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_creator_follower_count
AFTER INSERT OR DELETE ON creator_follows
FOR EACH ROW EXECUTE FUNCTION update_creator_follower_count();

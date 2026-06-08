-- Migration: Fix Creator Follower Trigger Schema
-- Date: 2026-06-08
-- Description: Update update_creator_follower_count trigger function to explicitly reference public.creators to avoid schema search_path issues.

CREATE OR REPLACE FUNCTION public.update_creator_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.creators SET follower_count = follower_count + 1 WHERE id = NEW.creator_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.creators SET follower_count = follower_count - 1 WHERE id = OLD.creator_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

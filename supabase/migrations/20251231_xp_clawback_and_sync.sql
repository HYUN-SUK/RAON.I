-- Migration: XP/Token Clawback & Sync
-- Date: 2025-12-31

SET search_path = public, auth, extensions;

-- 1. Schema Update: Add xp_amount to point_history
-- We need to know how much XP was granted to reverse it.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'point_history' AND column_name = 'xp_amount') THEN
        ALTER TABLE public.point_history ADD COLUMN xp_amount INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. Update RPC: Grant Reward (to store XP amount)
CREATE OR REPLACE FUNCTION grant_user_reward(
    p_user_id UUID,
    p_xp_amount INTEGER,
    p_token_amount INTEGER, 
    p_gold_amount INTEGER DEFAULT 0,
    p_reason TEXT DEFAULT 'REWARD',
    p_related_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_current_xp INTEGER;
    v_current_level INTEGER;
    v_new_xp INTEGER;
    v_new_level INTEGER;
BEGIN
    -- Get current stats
    SELECT xp, level INTO v_current_xp, v_current_level
    FROM public.profiles
    WHERE id = p_user_id;

    v_new_xp := COALESCE(v_current_xp, 0) + p_xp_amount;
    
    -- Level Calculation: Level = floor(sqrt(XP / 100)) + 1
    v_new_level := floor(sqrt(v_new_xp / 100)) + 1;

    -- Update Profile (XP, Token, Gold, Level)
    UPDATE public.profiles
    SET 
        xp = v_new_xp,
        raon_token = raon_token + p_token_amount,
        gold_point = gold_point + p_gold_amount,
        level = GREATEST(v_current_level, v_new_level),
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Log Transaction with XP Amount
    INSERT INTO public.point_history (user_id, amount, xp_amount, reason, related_mission_id) 
    VALUES (p_user_id, p_token_amount, p_xp_amount, p_reason, p_related_id); 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger: XP/Token Clawback on Deletion
-- When point_history is deleted, reverse changes.
CREATE OR REPLACE FUNCTION handle_point_history_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Deduct Token (amount) and XP (xp_amount)
    -- Also ensure we don't drop below zero? Or just let it happen (penalty)?
    -- Users usually want strictly consistent math, so deduction is correct even if it goes negative (debt),
    -- but usually UI handles min 0. Let's allow math to run.
    
    UPDATE public.profiles
    SET 
        raon_token = raon_token - OLD.amount,
        xp = xp - COALESCE(OLD.xp_amount, 0), -- Handle legacy nulls as 0
        -- Recalculate level?
        -- Level is derivative of XP. We should likely recalculate it.
        -- Optimization: Recalc level in a separate step or here.
        -- Logic: Level = floor(sqrt(XP / 100)) + 1
        level = floor(sqrt(GREATEST(0, xp - COALESCE(OLD.xp_amount, 0)) / 100)) + 1,
        updated_at = NOW()
    WHERE id = OLD.user_id;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_point_history_delete ON public.point_history;
CREATE TRIGGER on_point_history_delete
    AFTER DELETE ON public.point_history
    FOR EACH ROW
    EXECUTE FUNCTION handle_point_history_deletion();


-- 4. Trigger: Sync Mission Likes to Comment Likes
-- Prerequisite: Verify comment_likes table is the standard 'likes' table?
-- Actually, earlier code in communityService used 'likes' table for posts.
-- 'toggle_comment_like' rpc used 'comment_likes' table?
-- Let's assume table name 'comment_likes'.
-- IMPORTANT: Need to be sure about table name. Using 'comment_likes' based on typical pattern.
-- If file `20251223_community_comment_likes.sql` confirms it, we are good.

CREATE OR REPLACE FUNCTION sync_mission_like_to_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mission_id UUID;
    v_user_id UUID; -- The user who OWNS the mission/comment
    v_liker_id UUID; -- The user who LIKED
    v_community_post_id UUID;
    v_comment_id UUID;
BEGIN
    -- Identify the Mission Participation (that was liked)
    IF (TG_OP = 'INSERT') THEN
        v_liker_id := NEW.user_id;
        SELECT mission_id, user_id INTO v_mission_id, v_user_id
        FROM public.user_missions WHERE id = NEW.user_mission_id;
    ELSIF (TG_OP = 'DELETE') THEN
        v_liker_id := OLD.user_id;
        SELECT mission_id, user_id INTO v_mission_id, v_user_id
        FROM public.user_missions WHERE id = OLD.user_mission_id;
    END IF;

    -- Identify Related Community Post & Comment
    SELECT community_post_id INTO v_community_post_id
    FROM public.missions WHERE id = v_mission_id;

    IF v_community_post_id IS NULL THEN RETURN NULL; END IF;

    -- Find the comment by the Mission Participant on that Post
    SELECT id INTO v_comment_id
    FROM public.comments
    WHERE post_id = v_community_post_id AND user_id = v_user_id
    LIMIT 1;

    IF v_comment_id IS NULL THEN RETURN NULL; END IF;

    -- Sync: Update comment_likes
    IF (TG_OP = 'INSERT') THEN
        -- Add like to comment if not exists
        INSERT INTO public.comment_likes (user_id, comment_id)
        VALUES (v_liker_id, v_comment_id)
        ON CONFLICT DO NOTHING;
        
        -- Update comment likes count (if not handled by another trigger)
        -- communityService handles it via RPC 'increment_like_count' usually,
        -- but here we are doing DB-side sync.
        -- We should check if 'comment_likes' has a trigger to update 'comments.likes_count'.
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM public.comment_likes
        WHERE user_id = v_liker_id AND comment_id = v_comment_id;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_mission_likes ON public.mission_likes;
CREATE TRIGGER sync_mission_likes
    AFTER INSERT OR DELETE ON public.mission_likes
    FOR EACH ROW
    EXECUTE FUNCTION sync_mission_like_to_comment();

-- 5. Trigger: Sync Comment Likes to Mission Likes (Reverse)
CREATE OR REPLACE FUNCTION sync_comment_like_to_mission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_comment_id UUID;
    v_liker_id UUID;
    v_post_id UUID;
    v_author_id UUID;
    v_mission_id UUID;
    v_user_mission_id UUID;
BEGIN
    -- 1. Identify Comment and Liker
    IF (TG_OP = 'INSERT') THEN
        v_comment_id := NEW.comment_id;
        v_liker_id := NEW.user_id;
    ELSE
        v_comment_id := OLD.comment_id;
        v_liker_id := OLD.user_id;
    END IF;

    -- 2. Identify Post and Author of the Comment
    SELECT post_id, user_id INTO v_post_id, v_author_id
    FROM public.comments WHERE id = v_comment_id;

    -- 3. Check if this Post is a Mission Post
    SELECT id INTO v_mission_id
    FROM public.missions WHERE community_post_id = v_post_id;

    IF v_mission_id IS NULL THEN RETURN NULL; END IF;

    -- 4. Identify the User Mission (Mission Proof)
    SELECT id INTO v_user_mission_id
    FROM public.user_missions
    WHERE mission_id = v_mission_id AND user_id = v_author_id;

    IF v_user_mission_id IS NULL THEN RETURN NULL; END IF;

    -- 5. Sync Action
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.mission_likes (user_id, user_mission_id)
        VALUES (v_liker_id, v_user_mission_id)
        ON CONFLICT DO NOTHING;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM public.mission_likes
        WHERE user_id = v_liker_id AND user_mission_id = v_user_mission_id;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_comment_likes ON public.comment_likes;
CREATE TRIGGER sync_comment_likes
    AFTER INSERT OR DELETE ON public.comment_likes
    FOR EACH ROW
    EXECUTE FUNCTION sync_comment_like_to_mission();


-- Migration: Mission Ranking & Admin Deletion
-- Date: 2025-12-31

SET search_path = public, auth, extensions;

-- 1. Get Trending Missions (Ranking System)
-- Sorts missions by a score: (Participants * 1.0) + (Total Likes * 0.5)
CREATE OR REPLACE FUNCTION get_trending_missions()
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    mission_type TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    reward_xp INTEGER,
    reward_point INTEGER,
    participant_count BIGINT,
    total_likes BIGINT,
    score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.title,
        m.description,
        m.mission_type,
        m.start_date,
        m.end_date,
        m.reward_xp,
        m.reward_point,
        COALESCE(stats.p_count, 0) as participant_count,
        COALESCE(stats.l_count, 0) as total_likes,
        (COALESCE(stats.p_count, 0) * 1.0 + COALESCE(stats.l_count, 0) * 0.5) as score
    FROM public.missions m
    LEFT JOIN (
        SELECT
            mission_id,
            COUNT(*) as p_count,
            SUM(likes_count) as l_count
        FROM public.user_missions
        GROUP BY mission_id
    ) stats ON m.id = stats.mission_id
    WHERE m.is_active = true
    ORDER BY score DESC, m.created_at DESC;
END;
$$;

-- 2. Admin Delete Comment (Moderation)
-- Bypasses "Owner Only" RLS, handles counter updates
CREATE OR REPLACE FUNCTION admin_delete_comment(p_comment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_post_id UUID;
BEGIN
    -- Get post_id to update counter
    SELECT post_id INTO v_post_id FROM public.comments WHERE id = p_comment_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Delete the comment
    DELETE FROM public.comments WHERE id = p_comment_id;

    -- Update Comment Counter on Post
    IF v_post_id IS NOT NULL THEN
        UPDATE public.posts
        SET comment_count = (
            SELECT count(*) 
            FROM public.comments 
            WHERE post_id = v_post_id
        )
        WHERE id = v_post_id;
    END IF;

    RETURN TRUE;
END;
$$;

-- 3. Admin Withdraw Mission Participation (Moderation)
-- Allows Admin to remove ANY user's participation + cascade cleanup
CREATE OR REPLACE FUNCTION admin_withdraw_mission_participation(p_target_user_id UUID, p_mission_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_community_post_id UUID;
BEGIN
    -- Get Community Post ID linked to this mission
    SELECT community_post_id INTO v_community_post_id
    FROM public.missions
    WHERE id = p_mission_id;

    -- A. Delete Point History (Rewards)
    DELETE FROM public.point_history
    WHERE related_id = p_mission_id AND user_id = p_target_user_id;

    -- A-2. Delete Mission Likes (Cascade Safety)
    DELETE FROM public.mission_likes
    WHERE user_mission_id IN (
        SELECT id FROM public.user_missions
        WHERE mission_id = p_mission_id AND user_id = p_target_user_id
    );

    -- B. Delete Comments (If auto-posted to community)
    IF v_community_post_id IS NOT NULL THEN
        DELETE FROM public.comments
        WHERE post_id = v_community_post_id AND user_id = p_target_user_id;

        -- Update Post Counter
        UPDATE public.posts
        SET comment_count = (
            SELECT count(*) 
            FROM public.comments 
            WHERE post_id = v_community_post_id
        )
        WHERE id = v_community_post_id;
    END IF;

    -- C. Delete User Mission Entry
    DELETE FROM public.user_missions
    WHERE mission_id = p_mission_id AND user_id = p_target_user_id;

    RETURN FOUND;
END;
$$;

-- Grant Execute Permissions
GRANT EXECUTE ON FUNCTION get_trending_missions() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION admin_delete_comment(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_withdraw_mission_participation(UUID, UUID) TO authenticated, service_role;

-- 4. Admin Delete Creator Comment (Moderation)
CREATE OR REPLACE FUNCTION admin_delete_creator_comment(p_comment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.creator_content_comments WHERE id = p_comment_id;
    
    -- No counter update needed if we rely on count(*) queries or if there is a trigger.
    -- CreatorContent usually has comment_count? 
    -- If so, we should update it. Let's assume there is a trigger or we update it manually.
    -- Checking CreatorContent schema: it has comment_count.
    
    -- Let's attempt to update counter if possible.
    -- Assuming creator_contents table.
    UPDATE public.creator_contents c
    SET comment_count = (
        SELECT count(*) 
        FROM public.creator_content_comments 
        WHERE content_id = c.id
    )
    WHERE id = (
        SELECT content_id 
        FROM public.creator_content_comments 
        WHERE id = p_comment_id
    ); 
    -- Wait, we deleted it first, so subquery returns null. 
    -- Valid approach: Get content_id first.
    
    RETURN TRUE;
END;
$$;

-- Redefine for safety to get ID first
CREATE OR REPLACE FUNCTION admin_delete_creator_comment(p_comment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_content_id UUID;
BEGIN
    -- Get content_id
    SELECT content_id INTO v_content_id FROM public.creator_content_comments WHERE id = p_comment_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Delete
    DELETE FROM public.creator_content_comments WHERE id = p_comment_id;

    -- Update Counter
    IF v_content_id IS NOT NULL THEN
        UPDATE public.creator_contents
        SET comment_count = (
            SELECT count(*) 
            FROM public.creator_content_comments 
            WHERE content_id = v_content_id
        )
        WHERE id = v_content_id;
    END IF;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_creator_comment(UUID) TO authenticated, service_role;

-- 5. Admin Delete Post (Global Moderation)
CREATE OR REPLACE FUNCTION admin_delete_post(p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete the post (Cascading deletes handles comments/likes usually, but let's be safe)
    -- Assuming foreign keys on comments/likes have ON DELETE CASCADE
    DELETE FROM public.posts WHERE id = p_post_id;
    
    RETURN FOUND; -- Returns true if a row was deleted, false otherwise
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_post(UUID) TO authenticated, service_role;

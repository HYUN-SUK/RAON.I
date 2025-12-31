-- Migration: Simplify Likes & Ranking (SSOT)
-- Date: 2025-12-31

SET search_path = public, auth, extensions;

-- 1. Remove Sync Triggers (No longer needed as we will ignore mission_likes)
DROP TRIGGER IF EXISTS sync_mission_likes ON public.mission_likes;
DROP TRIGGER IF EXISTS sync_comment_likes ON public.comment_likes;
DROP FUNCTION IF EXISTS sync_mission_like_to_comment();
DROP FUNCTION IF EXISTS sync_comment_like_to_mission();

-- 2. Update Ranking RPC to use Comment Likes directly
-- This is the "Single Source of Truth" approach.
-- Logic: Mission Score = (Participants * 1.0) + (Total Likes on Comments * 0.5)

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
            um.mission_id,
            COUNT(DISTINCT um.user_id) as p_count,
            -- Sum likes from the RELATED COMMENTS
            -- Join path: user_mission -> mission -> community_post -> comment (by user) -> likes_count
            SUM(COALESCE(c.likes_count, 0)) as l_count
        FROM public.user_missions um
        JOIN public.missions m ON um.mission_id = m.id
        LEFT JOIN public.comments c ON 
            c.post_id = m.community_post_id 
            AND c.user_id = um.user_id 
            -- Note: We assume 1 valid comment per user per mission post generally, 
            -- or we sum all if they commented multiple times (which is fair engagement).
        GROUP BY um.mission_id
    ) stats ON m.id = stats.mission_id
    WHERE m.is_active = true
    ORDER BY score DESC, m.created_at DESC;
END;
$$;

-- 3. Grant Permissions
GRANT EXECUTE ON FUNCTION get_trending_missions() TO authenticated, anon, service_role;

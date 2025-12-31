-- Fix Admin RPC Bug (Column Name Mismatch)
-- Date: 2025-12-31

SET search_path = public, auth, extensions;

-- Redefine admin_withdraw_mission_participation with correct column 'related_mission_id'
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
    -- BUG FIX: Changed 'related_id' to 'related_mission_id'
    DELETE FROM public.point_history
    WHERE related_mission_id = p_mission_id AND user_id = p_target_user_id;

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

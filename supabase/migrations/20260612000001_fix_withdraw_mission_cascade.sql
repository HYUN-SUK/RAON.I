-- Fix: Cascade delete mission private archive posts on mission withdrawal

-- 1. Redefine 'withdraw_mission' to delete personal archive posts matching the mission
DROP FUNCTION IF EXISTS public.withdraw_mission(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.withdraw_mission(p_mission_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Delete matching personal archive posts (PRIVATE stories)
    DELETE FROM public.posts
    WHERE author_id = v_user_id 
      AND (meta_data->>'related_mission_id') = p_mission_id::text;
    
    -- Delete User Mission Entry
    DELETE FROM public.user_missions
    WHERE mission_id = p_mission_id AND user_id = v_user_id;
    
    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_mission(UUID) TO authenticated, service_role;

-- 2. Redefine 'admin_withdraw_mission_participation' to delete personal archive posts matching the mission
DROP FUNCTION IF EXISTS public.admin_withdraw_mission_participation(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.admin_withdraw_mission_participation(p_target_user_id UUID, p_mission_id UUID)
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

    -- A. Delete Point History (Rewards) using standard 'related_id'
    DELETE FROM public.point_history
    WHERE related_id = p_mission_id AND user_id = p_target_user_id;

    -- A-2. Delete Mission Likes
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

    -- Delete matching personal archive posts (PRIVATE stories)
    DELETE FROM public.posts
    WHERE author_id = p_target_user_id 
      AND (meta_data->>'related_mission_id') = p_mission_id::text;

    -- C. Delete User Mission Entry
    DELETE FROM public.user_missions
    WHERE mission_id = p_mission_id AND user_id = p_target_user_id;

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_withdraw_mission_participation(UUID, UUID) TO authenticated, service_role;

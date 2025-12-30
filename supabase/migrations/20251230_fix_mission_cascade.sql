-- Enhanced withdraw_mission to clean up comments
SET search_path = public, auth, extensions;

CREATE OR REPLACE FUNCTION withdraw_mission(p_mission_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_community_post_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Get Community Post ID for this mission
    SELECT community_post_id INTO v_community_post_id
    FROM public.missions
    WHERE id = p_mission_id;
    
    -- 2. Delete the specific comment for this mission context
    IF v_community_post_id IS NOT NULL THEN
        DELETE FROM public.comments
        WHERE post_id = v_community_post_id AND user_id = v_user_id;
    END IF;

    -- 3. Delete Mission Participation
    DELETE FROM public.user_missions
    WHERE mission_id = p_mission_id AND user_id = v_user_id;
    
    RETURN FOUND;
END;
$$;

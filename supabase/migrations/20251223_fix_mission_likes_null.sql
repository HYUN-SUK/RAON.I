-- Fix NULL handling in toggle_mission_like

CREATE OR REPLACE FUNCTION toggle_mission_like(p_user_mission_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_exists BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Check if like exists
    SELECT EXISTS (
        SELECT 1 FROM public.mission_likes
        WHERE user_mission_id = p_user_mission_id AND user_id = v_user_id
    ) INTO v_exists;

    IF v_exists THEN
        -- Unlike
        DELETE FROM public.mission_likes
        WHERE user_mission_id = p_user_mission_id AND user_id = v_user_id;

        -- Decrement count
        UPDATE public.user_missions
        SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0) -- Ensure not negative
        WHERE id = p_user_mission_id;
        
        RETURN FALSE; -- Unliked
    ELSE
        -- Like
        INSERT INTO public.mission_likes (user_mission_id, user_id)
        VALUES (p_user_mission_id, v_user_id);

        -- Increment count
        UPDATE public.user_missions
        SET likes_count = COALESCE(likes_count, 0) + 1
        WHERE id = p_user_mission_id;
        
        RETURN TRUE; -- Liked
    END IF;
END;
$$;

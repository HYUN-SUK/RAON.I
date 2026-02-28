-- Hotfix: Standardize point_history related Column
-- Purpose: Resolve "column related_mission_id does not exist" and conflicting RPCs

DO $$
BEGIN
    -- 1. Ensure 'related_id' exists and 'related_mission_id' is renamed if it still exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'point_history' AND column_name = 'related_mission_id'
    ) THEN
        ALTER TABLE public.point_history RENAME COLUMN related_mission_id TO related_id;
    END IF;

    -- 2. If 'related_id' still doesn't exist (unlikely), add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'point_history' AND column_name = 'related_id'
    ) THEN
        ALTER TABLE public.point_history ADD COLUMN related_id UUID;
    END IF;
END $$;

-- 3. Redefine 'admin_withdraw_mission_participation' to use 'related_id'
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

    -- C. Delete User Mission Entry
    DELETE FROM public.user_missions
    WHERE mission_id = p_mission_id AND user_id = p_target_user_id;

    RETURN FOUND;
END;
$$;

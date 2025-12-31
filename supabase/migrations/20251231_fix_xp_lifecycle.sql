-- FIX XP LIFECYCLE & DELETION CASADES
-- Date: 2025-12-31
-- Purpose: Ensure point_history is deleted when source content is deleted, allowing XP clawback and re-acquisition.

SET search_path = public, auth, extensions;

-- 1. Trigger for MISSION WITHDRAWAL (User Mission Delete -> Point History Delete)
CREATE OR REPLACE FUNCTION cascade_delete_point_history_on_mission_withdraw()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Delete point history related to this mission for this user
    -- This will fire 'on_point_history_delete' trigger which handles clawback
    DELETE FROM public.point_history 
    WHERE user_id = OLD.user_id 
    AND related_mission_id = OLD.mission_id;
    
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_point_history_mission ON public.user_missions;
CREATE TRIGGER trg_cascade_point_history_mission
    BEFORE DELETE ON public.user_missions
    FOR EACH ROW
    EXECUTE FUNCTION cascade_delete_point_history_on_mission_withdraw();


-- 2. Trigger for POST DELETION (Post Delete -> Point History Delete)
CREATE OR REPLACE FUNCTION cascade_delete_point_history_on_post_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Delete point history related to this post (e.g., CREATE_POST reward)
    DELETE FROM public.point_history 
    WHERE related_id = OLD.id;
    
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_point_history_post ON public.posts;
CREATE TRIGGER trg_cascade_point_history_post
    BEFORE DELETE ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION cascade_delete_point_history_on_post_delete();


-- 3. Ensure 'handle_point_history_deletion' trigger exists and is correct (Clawback Logic)
-- (Re-defining to be safe, from previous plan)
CREATE OR REPLACE FUNCTION handle_point_history_deletion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Deduct Token and XP
    UPDATE public.profiles
    SET 
        raon_token = raon_token - OLD.amount,
        xp = xp - COALESCE(OLD.xp_amount, 0),
        -- Recalc level
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


-- 4. Admin Force Delete RPC (Enhanced for safety)
CREATE OR REPLACE FUNCTION admin_force_delete_post(p_post_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Use Replica Role to bypass potential foreign key stucks, 
    -- BUT we want triggers to fire for cleanup if possible.
    -- However, if constraints are missing, we force delete manually.
    
    -- 1. Manual Cleanup of Dependencies (Top-Down)
    DELETE FROM public.likes WHERE post_id = p_post_id;
    DELETE FROM public.comment_likes WHERE comment_id IN (SELECT id FROM public.comments WHERE post_id = p_post_id);
    DELETE FROM public.comments WHERE post_id = p_post_id;
    
    -- Point History for the post itself is handled by trigger above (trg_cascade_point_history_post),
    -- BUT we run explicit delete just in case trigger fails or doesn't fire due to permissions.
    DELETE FROM public.point_history WHERE related_id = p_post_id;

    -- 2. Delete Post
    DELETE FROM public.posts WHERE id = p_post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_force_delete_post(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

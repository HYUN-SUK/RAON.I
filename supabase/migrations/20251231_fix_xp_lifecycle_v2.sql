-- FIX XP LIFECYCLE & DELETION CASADES (CORRECTED)
-- Date: 2025-12-31
-- Purpose: Fix 'column related_mission_id does not exist' and ensure XP clawback works.

SET search_path = public, auth, extensions;

-- 1. FIX RPC: grant_user_reward (Use 'related_id' instead of failed 'related_mission_id')
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
    v_new_level := floor(sqrt(v_new_xp / 100)) + 1;

    -- Update Profile
    UPDATE public.profiles
    SET 
        xp = v_new_xp,
        raon_token = raon_token + p_token_amount,
        gold_point = gold_point + p_gold_amount,
        level = GREATEST(v_current_level, v_new_level),
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Log Transaction (Using related_id generic column)
    INSERT INTO public.point_history (user_id, amount, xp_amount, reason, related_id) 
    VALUES (p_user_id, p_token_amount, p_xp_amount, p_reason, p_related_id); 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Trigger for MISSION WITHDRAWAL (Corrected column name)
CREATE OR REPLACE FUNCTION cascade_delete_point_history_on_mission_withdraw()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Delete point history related to this mission (using related_id)
    -- We assume related_id holds the mission_id for MISSION_REWARD actions
    DELETE FROM public.point_history 
    WHERE user_id = OLD.user_id 
    AND related_id = OLD.mission_id;
    
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_point_history_mission ON public.user_missions;
CREATE TRIGGER trg_cascade_point_history_mission
    BEFORE DELETE ON public.user_missions
    FOR EACH ROW
    EXECUTE FUNCTION cascade_delete_point_history_on_mission_withdraw();


-- 3. Trigger for POST DELETION (Corrected, redundant but safe)
CREATE OR REPLACE FUNCTION cascade_delete_point_history_on_post_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
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


-- 4. Trigger: Clawback Logic (Use handle_point_history_deletion)
CREATE OR REPLACE FUNCTION handle_point_history_deletion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.profiles
    SET 
        raon_token = raon_token - OLD.amount,
        xp = xp - COALESCE(OLD.xp_amount, 0),
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


-- 5. Admin Force Delete RPC (Safeguard)
CREATE OR REPLACE FUNCTION admin_force_delete_post(p_post_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM public.likes WHERE post_id = p_post_id;
    DELETE FROM public.comment_likes WHERE comment_id IN (SELECT id FROM public.comments WHERE post_id = p_post_id);
    DELETE FROM public.comments WHERE post_id = p_post_id;
    DELETE FROM public.point_history WHERE related_id = p_post_id;
    DELETE FROM public.posts WHERE id = p_post_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_force_delete_post(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

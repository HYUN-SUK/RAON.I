-- 1. Create robust withdraw function (Bypasses RLS)
CREATE OR REPLACE FUNCTION withdraw_mission(p_mission_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    DELETE FROM public.user_missions
    WHERE mission_id = p_mission_id AND user_id = v_user_id;
    
    -- Also delete likes? (Cascade handles it, but good to be sure)
    -- Also remove points? (Optional, skipping for now as per policy)
    
    RETURN FOUND;
END;
$$;

-- 2. Force ensure community posts for all active missions
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT id FROM public.missions WHERE is_active = true AND community_post_id IS NULL) LOOP
        PERFORM public.ensure_mission_post(r.id);
    END LOOP;
END $$;

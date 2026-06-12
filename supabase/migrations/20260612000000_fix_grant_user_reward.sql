-- Fix grant_user_reward RPC to use standard related_id column
-- Date: 2026-06-12

SET search_path = public, auth, extensions;

CREATE OR REPLACE FUNCTION public.grant_user_reward(
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
    
    -- Level Calculation: Level = floor(sqrt(XP / 100)) + 1
    v_new_level := floor(sqrt(v_new_xp / 100)) + 1;

    -- Update Profile (XP, Token, Gold, Level)
    UPDATE public.profiles
    SET 
        xp = v_new_xp,
        raon_token = raon_token + p_token_amount,
        gold_point = gold_point + p_gold_amount,
        level = GREATEST(v_current_level, v_new_level),
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Log Transaction with Standard related_id Column instead of related_mission_id
    INSERT INTO public.point_history (user_id, amount, xp_amount, reason, related_id) 
    VALUES (p_user_id, p_token_amount, p_xp_amount, p_reason, p_related_id); 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

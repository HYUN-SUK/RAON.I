-- 1. Generalize Point History Table
DO $$
BEGIN
    -- Rename column if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'point_history' AND column_name = 'related_mission_id'
    ) THEN
        ALTER TABLE public.point_history RENAME COLUMN related_mission_id TO related_id;
    END IF;

    -- Drop Foreign Key Constraint (to allow generic IDs like Post ID)
    -- We need to find the constraint name. Usually it's point_history_related_mission_id_fkey or simiar.
    -- Dynamic drop is safer.
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN (
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'point_history' AND constraint_type = 'FOREIGN KEY'
        ) LOOP
            EXECUTE 'ALTER TABLE public.point_history DROP CONSTRAINT ' || r.constraint_name;
        END LOOP;
    END;
END $$;

-- 2. Update RPC to use 'related_id'
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
    
    -- Level Calculation
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

    -- Log Transaction (Using new column 'related_id')
    INSERT INTO public.point_history (user_id, amount, reason, related_id) 
    VALUES (p_user_id, p_token_amount, p_reason, p_related_id); 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

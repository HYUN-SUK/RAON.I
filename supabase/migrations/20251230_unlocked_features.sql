-- 1. Create table for persistent feature unlocks
CREATE TABLE IF NOT EXISTS public.user_unlocked_features (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    acquired_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, feature_key)
);

-- 2. RLS Policies
ALTER TABLE public.user_unlocked_features ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own unlocks
DROP POLICY IF EXISTS "Users can view own unlocks" ON public.user_unlocked_features;
CREATE POLICY "Users can view own unlocks"
    ON public.user_unlocked_features FOR SELECT
    USING (auth.uid() = user_id);

-- Restrict INSERT/UPDATE/DELETE to server-side only (or via RPC)
-- We will rely on RPC for safe transactions involving token deduction.
DROP POLICY IF EXISTS "No direct modification by users" ON public.user_unlocked_features;
-- No policy for INSERT/UPDATE/DELETE means denied by default for keys not matching other policies. 
-- But good practice to be explicit or just leave default deny. Default deny is sufficient.

-- 3. RPC: Purchase Feature
CREATE OR REPLACE FUNCTION purchase_feature(
    p_feature_key TEXT,
    p_cost INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_current_tokens INTEGER;
BEGIN
    v_user_id := auth.uid();
    
    -- Check if user is logged in
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if already unlocked
    IF EXISTS (
        SELECT 1 FROM public.user_unlocked_features 
        WHERE user_id = v_user_id AND feature_key = p_feature_key
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Already unlocked');
    END IF;

    -- Get current tokens
    SELECT raon_token INTO v_current_tokens
    FROM public.profiles
    WHERE id = v_user_id;

    -- Check balance
    IF v_current_tokens < p_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not enough tokens');
    END IF;

    -- Deduct tokens
    UPDATE public.profiles
    SET raon_token = raon_token - p_cost,
        updated_at = NOW()
    WHERE id = v_user_id;

    -- Record in history
    INSERT INTO public.point_history (user_id, amount, reason, related_mission_id)
    VALUES (v_user_id, -p_cost, 'UNLOCK_FEATURE:' || p_feature_key, NULL);

    -- Grant feature
    INSERT INTO public.user_unlocked_features (user_id, feature_key)
    VALUES (v_user_id, p_feature_key);

    RETURN jsonb_build_object('success', true, 'message', 'Feature unlocked');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

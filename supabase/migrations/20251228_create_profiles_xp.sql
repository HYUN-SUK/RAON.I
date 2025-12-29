
-- 1. Create Table (if not exists)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    nickname TEXT,
    avatar_url TEXT,
    description TEXT,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    -- Columns will be handled carefully below
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Handle Schema Evolution (Point -> Raon Token, Add Gold)
DO $$
BEGIN
    -- Rename 'point' to 'raon_token' if it exists (legacy support)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'point') THEN
        ALTER TABLE public.profiles RENAME COLUMN point TO raon_token;
    END IF;

    -- Add 'raon_token' if it doesn't exist (and wasn't just renamed)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'raon_token') THEN
        ALTER TABLE public.profiles ADD COLUMN raon_token INTEGER DEFAULT 0;
    END IF;

    -- Add 'gold_point' for future use
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'gold_point') THEN
        ALTER TABLE public.profiles ADD COLUMN gold_point INTEGER DEFAULT 0;
    END IF;
END $$;

-- 3. RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone."
    ON public.profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile."
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- 4. Triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, nickname, avatar_url)
    VALUES (
        new.id,
        new.email,
        split_part(new.email, '@', 1),
        new.raw_user_meta_data->>'avatar_url'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. RPC Functions (Rewards & Points)

-- IMPORTANT: Drop existing functions to avoid signature/return type conflicts
DROP FUNCTION IF EXISTS grant_user_reward(uuid, integer, integer, text, uuid); -- Old Sig
DROP FUNCTION IF EXISTS grant_user_reward(uuid, integer, integer, integer, text, uuid); -- New Sig (Safe Check)
DROP FUNCTION IF EXISTS use_user_point(uuid, integer, text); -- Old Sig

-- RPC: Grant Reward (XP + Token + Gold)
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

    -- Log Transaction
    -- For now, logging Token amount as primary amount in 'point_history'
    -- Ideally, point_history needs schema update, but we reuse (amount, reason) for Token tracking.
    INSERT INTO public.point_history (user_id, amount, reason, related_mission_id) 
    VALUES (p_user_id, p_token_amount, p_reason, p_related_id); 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Use Point (Specifically Raon Token)
CREATE OR REPLACE FUNCTION use_user_point(
    p_user_id UUID,
    p_amount INTEGER,
    p_reason TEXT
)
RETURNS VOID AS $$
DECLARE
    v_current_token INTEGER;
BEGIN
    SELECT raon_token INTO v_current_token
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_current_token < p_amount THEN
        RAISE EXCEPTION 'Not enough Raon Tokens';
    END IF;

    UPDATE public.profiles
    SET raon_token = raon_token - p_amount
    WHERE id = p_user_id;

    INSERT INTO public.point_history (user_id, amount, reason)
    VALUES (p_user_id, -p_amount, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

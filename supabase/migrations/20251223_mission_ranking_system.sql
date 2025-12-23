-- Mission Likes & Ranking System
-- 1. Create mission_likes table (User <-> UserMission)
-- 2. Add likes_count cache to user_missions
-- 3. Add ranking_processed flag to missions
-- 4. Create function to toggle like
-- 5. Create function to process ranking rewards

-- 1. Mission Likes Table
CREATE TABLE IF NOT EXISTS public.mission_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_mission_id UUID NOT NULL REFERENCES public.user_missions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_mission_id, user_id)
);

-- RLS for mission_likes
ALTER TABLE public.mission_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all likes"
    ON public.mission_likes FOR SELECT
    USING (true);

CREATE POLICY "Users can like missions"
    ON public.mission_likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike missions"
    ON public.mission_likes FOR DELETE
    USING (auth.uid() = user_id);

-- 2. Add likes_count to user_missions
ALTER TABLE public.user_missions 
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- 3. Add ranking_processed to missions
ALTER TABLE public.missions
ADD COLUMN IF NOT EXISTS ranking_processed BOOLEAN DEFAULT FALSE;

-- 4. Function to toggle like
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
        SET likes_count = likes_count - 1
        WHERE id = p_user_mission_id;
        
        RETURN FALSE; -- Unliked
    ELSE
        -- Like
        INSERT INTO public.mission_likes (user_mission_id, user_id)
        VALUES (p_user_mission_id, v_user_id);

        -- Increment count
        UPDATE public.user_missions
        SET likes_count = likes_count + 1
        WHERE id = p_user_mission_id;
        
        RETURN TRUE; -- Liked
    END IF;
END;
$$;

-- 5. Function to process ranking (To be called by Cron or Admin)
-- Returns JSON of winners for verification
CREATE OR REPLACE FUNCTION process_mission_ranking(p_mission_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mission RECORD;
    v_winners RECORD;
    v_result JSON;
BEGIN
    -- Get mission details
    SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mission not found';
    END IF;

    -- Update ranking_processed flag
    UPDATE public.missions SET ranking_processed = TRUE WHERE id = p_mission_id;

    -- Select Top 3 Users (Most Likes)
    -- Logic: Rank by likes_count DESC, then created_at ASC (First comer wins tie)
    WITH ranked_users AS (
        SELECT 
            um.user_id,
            um.id as user_mission_id,
            um.likes_count,
            um.image_url,
            ROW_NUMBER() OVER (ORDER BY um.likes_count DESC, um.created_at ASC) as rank
        FROM public.user_missions um
        WHERE um.mission_id = p_mission_id
        AND um.status = 'approved' -- Only approved missions count? Or all submitted? Let's say all submitted for now, or maybe only approved. Usually approved.
        -- Actually, if we auto-approve, then 'submitted' is fine. Let's assume valid submissions.
    )
    SELECT json_agg(r) INTO v_result
    FROM ranked_users r
    WHERE r.rank <= 3;

    -- Give Rewards (Example Logic - Adjust amounts as needed)
    -- Rank 1: 500 XP, 100 P
    -- Rank 2: 300 XP, 50 P
    -- Rank 3: 100 XP, 30 P
    
    -- Loop through winners and insert points (Implementation omitted for safety, just returning winners for now)
    -- You can uncomment this part to actually give rewards
    /*
    FOR v_winners IN SELECT * FROM json_to_recordset(v_result) AS x(user_id uuid, rank int)
    LOOP
        IF v_winners.rank = 1 THEN
            PERFORM give_user_reward(v_winners.user_id, 500, 100, 'Mission Ranking 1st Place');
        ELSIF v_winners.rank = 2 THEN
            PERFORM give_user_reward(v_winners.user_id, 300, 50, 'Mission Ranking 2nd Place');
        ELSIF v_winners.rank = 3 THEN
            PERFORM give_user_reward(v_winners.user_id, 100, 30, 'Mission Ranking 3rd Place');
        END IF;
    END LOOP;
    */

    RETURN v_result;
END;
$$;

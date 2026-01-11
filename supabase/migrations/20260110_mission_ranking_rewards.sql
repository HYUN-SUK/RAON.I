-- 주간 미션 랭킹 보상 시스템 마이그레이션
-- Mission Ranking Reward System Migration

-- 1. site_config에 미션 보상 설정 컬럼 추가 (admin_settings 대신)
ALTER TABLE site_config 
ADD COLUMN IF NOT EXISTS mission_reward_1st_xp INTEGER DEFAULT 500,
ADD COLUMN IF NOT EXISTS mission_reward_1st_token INTEGER DEFAULT 150,
ADD COLUMN IF NOT EXISTS mission_reward_2nd_xp INTEGER DEFAULT 300,
ADD COLUMN IF NOT EXISTS mission_reward_2nd_token INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS mission_reward_3rd_xp INTEGER DEFAULT 200,
ADD COLUMN IF NOT EXISTS mission_reward_3rd_token INTEGER DEFAULT 50;

-- 2. missions 테이블에 ranking_processed 플래그 추가
ALTER TABLE missions
ADD COLUMN IF NOT EXISTS ranking_processed BOOLEAN DEFAULT FALSE;

-- 3. mission_rewards 테이블 생성 (보상 지급 기록)
CREATE TABLE IF NOT EXISTS mission_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
    xp_awarded INTEGER NOT NULL DEFAULT 0,
    token_awarded INTEGER NOT NULL DEFAULT 0,
    awarded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_mission_rewards_mission_id ON mission_rewards(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_rewards_user_id ON mission_rewards(user_id);

-- RLS Policies
ALTER TABLE mission_rewards ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 보상 기록 조회 가능
DROP POLICY IF EXISTS "Admin can view all rewards" ON mission_rewards;
CREATE POLICY "Admin can view all rewards" ON mission_rewards
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'admin@raon.ai')
    );

-- 사용자는 자신의 보상 기록만 조회 가능
DROP POLICY IF EXISTS "Users can view own rewards" ON mission_rewards;
CREATE POLICY "Users can view own rewards" ON mission_rewards
    FOR SELECT USING (user_id = auth.uid());

-- 시스템만 보상 기록 삽입 가능 (service_role 사용)
DROP POLICY IF EXISTS "System can insert rewards" ON mission_rewards;
CREATE POLICY "System can insert rewards" ON mission_rewards
    FOR INSERT WITH CHECK (true);

-- 4. 랭킹 처리 RPC 함수
CREATE OR REPLACE FUNCTION process_mission_ranking(p_mission_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
    v_top3 RECORD;
    v_settings RECORD;
    v_mission RECORD;
    v_rank INTEGER := 0;
    v_rewards_given JSON := '[]'::JSON;
BEGIN
    -- 1. 미션 확인
    SELECT * INTO v_mission FROM missions WHERE id = p_mission_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Mission not found');
    END IF;
    
    IF v_mission.ranking_processed THEN
        RETURN json_build_object('success', false, 'error', 'Ranking already processed');
    END IF;

    -- 2. 보상 설정 조회
    SELECT 
        COALESCE(mission_reward_1st_xp, 500) as r1_xp,
        COALESCE(mission_reward_1st_token, 150) as r1_token,
        COALESCE(mission_reward_2nd_xp, 300) as r2_xp,
        COALESCE(mission_reward_2nd_token, 100) as r2_token,
        COALESCE(mission_reward_3rd_xp, 200) as r3_xp,
        COALESCE(mission_reward_3rd_token, 50) as r3_token
    INTO v_settings
    FROM site_config
    LIMIT 1;

    -- 3. Top 3 추출 및 보상 지급
    FOR v_top3 IN 
        SELECT 
            um.user_id,
            um.id as user_mission_id,
            COALESCE(um.likes_count, 0) as likes,
            ROW_NUMBER() OVER (ORDER BY COALESCE(um.likes_count, 0) DESC, um.completed_at ASC) as rank_num
        FROM user_missions um
        WHERE um.mission_id = p_mission_id
          AND um.status = 'COMPLETED'
        ORDER BY likes DESC, um.completed_at ASC
        LIMIT 3
    LOOP
        v_rank := v_top3.rank_num;
        
        -- 순위별 보상 결정
        DECLARE
            v_xp INTEGER;
            v_token INTEGER;
        BEGIN
            IF v_rank = 1 THEN
                v_xp := v_settings.r1_xp;
                v_token := v_settings.r1_token;
            ELSIF v_rank = 2 THEN
                v_xp := v_settings.r2_xp;
                v_token := v_settings.r2_token;
            ELSIF v_rank = 3 THEN
                v_xp := v_settings.r3_xp;
                v_token := v_settings.r3_token;
            END IF;

            -- 보상 기록 저장
            INSERT INTO mission_rewards (mission_id, user_id, rank, xp_awarded, token_awarded)
            VALUES (p_mission_id, v_top3.user_id, v_rank, v_xp, v_token);

            -- 사용자에게 보상 지급
            PERFORM grant_user_reward(v_top3.user_id, v_xp, v_token, 0, 'MISSION_RANKING', p_mission_id::TEXT);
        END;
    END LOOP;

    -- 4. 랭킹 처리 완료 표시
    UPDATE missions SET ranking_processed = TRUE WHERE id = p_mission_id;

    RETURN json_build_object(
        'success', true,
        'mission_id', p_mission_id,
        'rankings_processed', v_rank
    );
END;
$$;

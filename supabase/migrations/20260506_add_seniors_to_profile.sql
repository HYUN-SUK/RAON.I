-- [20260506] 캠핑 프로필에 부모님(seniors) 인원 정보 추가

-- 1. 테이블 컬럼 추가
ALTER TABLE public.user_camping_profiles 
ADD COLUMN IF NOT EXISTS seniors INTEGER DEFAULT 0;

-- 2. RPC 함수 업데이트 (p_seniors 매개변수 추가)
CREATE OR REPLACE FUNCTION public.upsert_camping_profile(
    p_user_id UUID,
    p_adults INTEGER,
    p_kids_preschool INTEGER,
    p_kids_elementary INTEGER,
    p_kids_teen INTEGER,
    p_seniors INTEGER, -- 추가됨
    p_has_pet BOOLEAN,
    p_preferred_activities TEXT[],
    p_preferred_vibes TEXT[],
    p_equipment_level TEXT,
    p_food_preferences TEXT[],
    p_location_priority TEXT,
    p_safety_priority TEXT,
    p_last_site_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_profile_id UUID;
BEGIN
    INSERT INTO public.user_camping_profiles (
        user_id, adults, kids_preschool, kids_elementary, kids_teen, seniors, has_pet,
        preferred_activities, preferred_vibes, equipment_level, food_preferences,
        location_priority, safety_priority, last_site_id, updated_at
    )
    VALUES (
        p_user_id, p_adults, p_kids_preschool, p_kids_elementary, p_kids_teen, p_seniors, p_has_pet,
        p_preferred_activities, p_preferred_vibes, p_equipment_level, p_food_preferences,
        p_location_priority, p_safety_priority, p_last_site_id, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        adults = EXCLUDED.adults,
        kids_preschool = EXCLUDED.kids_preschool,
        kids_elementary = EXCLUDED.kids_elementary,
        kids_teen = EXCLUDED.kids_teen,
        seniors = EXCLUDED.seniors, -- 추가됨
        has_pet = EXCLUDED.has_pet,
        preferred_activities = EXCLUDED.preferred_activities,
        preferred_vibes = EXCLUDED.preferred_vibes,
        equipment_level = EXCLUDED.equipment_level,
        food_preferences = EXCLUDED.food_preferences,
        location_priority = EXCLUDED.location_priority,
        safety_priority = EXCLUDED.safety_priority,
        last_site_id = EXCLUDED.last_site_id,
        updated_at = NOW()
    RETURNING id INTO v_profile_id;

    RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

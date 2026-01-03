-- 🚨 RAON.I Data Restoration Script
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Fix Missing Site Config (Restores Home Chips)
INSERT INTO public.site_config (
    id, 
    address_main, 
    address_detail, 
    phone_number, 
    rules_guide_text, 
    pricing_guide_text, 
    layout_image_url, 
    nearby_places
) VALUES (
    1, 
    '강원 화악산로 1234', 
    '라온아이 캠핑장', 
    '010-1234-5678', 
    '매너타임 준수 (22:00 ~ 08:00)', 
    '평일 5만원 / 주말 7만원', 
    NULL,
    '[{"title": "화악산 계곡", "desc": "맑은 물이 흐르는 계곡"}, {"title": "천문대", "desc": "별이 쏟아지는 관측소"}]'::jsonb
) ON CONFLICT (id) DO UPDATE SET
    address_main = EXCLUDED.address_main,
    rules_guide_text = EXCLUDED.rules_guide_text;

-- 2. Create Active Mission (Restores Mission Card)
INSERT INTO public.missions (
    title, 
    description, 
    start_date, 
    end_date, 
    is_active, 
    reward_xp, 
    reward_point, 
    mission_type
) VALUES (
    '📸 (복구) 이 주의 캠핑 요리왕',
    '나만의 캠핑 요리를 자랑해보세요! (복구된 미션)',
    NOW(),
    NOW() + INTERVAL '7 days',
    true,
    100,
    50,
    'PHOTO'
);

-- Note: For Admin Password, please go to Authentication > Users > Find 'admin@raon.ai' > Reset Password.

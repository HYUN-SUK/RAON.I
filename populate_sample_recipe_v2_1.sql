-- populate_sample_recipe_v2_1.sql

-- Update the 'Today's Chef' (Cooking) item with V2.1 Rich Data
-- We target the item with title '매운탕' (Spiced Fish Stew)

update recommendation_pool
set 
    servings = '2-3인분',
    calories = 540,
    -- Using a high-quality food image for the Hero Header
    image_url = 'https://images.unsplash.com/photo-1549203386-9d4394c850d1?q=80&w=1000&auto=format&fit=crop',
    
    -- Ensure V2 base fields are also populated (just in case)
    time_required = 40,
    difficulty = 2,
    ingredients = array['광어 서더리 (1마리)', '무 (1/4개)', '애호박 (1/2개)', '쑥갓 (한 줌)', '대파 (1대)', '청양고추 (2개)', '양념장 (고춧가루, 다진마늘, 국간장)'],
    process_steps = array['무와 애호박을 먹기 좋은 크기로 썰어주세요.', '냄비에 물 1L와 무를 넣고 먼저 끓여 육수를 냅니다.', '육수가 끓으면 양념장을 풀고 서더리를 넣어주세요.', '생선이 익으면 애호박과 대파를 넣고 5분간 더 끓입니다.', '마지막으로 쑥갓과 청양고추를 올리면 완성!'],
    tips = '오래 끓일수록 국물이 진해지지만, 생선 살이 부서질 수 있으니 주의하세요! 비린내 제거를 위해 소주를 약간 넣어도 좋습니다.'

where title = '매운탕';

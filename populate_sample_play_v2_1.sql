-- populate_sample_play_v2_1.sql

-- Update the 'Today's Play' (Play) item with V2.1 Rich Data
-- We target the item with category = 'play'

update recommendation_pool
set 
    -- V2 Base Fields
    time_required = 60,
    difficulty = 1,
    
    -- V2.1 Premium Fields
    age_group = '5세 이상',
    location_type = '야외',
    calories = 150,
    image_url = 'https://images.unsplash.com/photo-1472396961693-142e6e596e35?q=80&w=1000&auto=format&fit=crop', -- Forest trail image
    
    -- Content (Using JSONB array format)
    ingredients = '["편안한 운동화", "물병", "모자", "간식"]'::jsonb,
    
    process_steps = '[
        "가벼운 스트레칭으로 몸을 풀어주세요. (5분)",
        "정해진 코스(A코스)를 따라 천천히 걷습니다.",
        "중간 지점 쉼터에서 물을 마시며 휴식합니다.",
        "반환점의 도장을 찍고 다시 출발점으로 돌아옵니다.",
        "완주 기념 배지를 받으세요!"
    ]'::jsonb,
    
    tips = '여름철에는 벌레 기피제를 챙기는 것이 좋습니다. 아이들과 함께라면 중간중간 숲 속 곤충 찾기 놀이를 해보세요!'

where category = 'play';

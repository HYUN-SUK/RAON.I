-- 20251226_recommendation_v2_1.sql

-- Add V2.1 columns for Premium Recipe/Play Details
alter table recommendation_pool
add column if not exists servings text, -- e.g., "2-3인분"
add column if not exists calories integer, -- e.g., 500 (kcal)
add column if not exists age_group text, -- e.g., "5세 이상", "전연령"
add column if not exists location_type text; -- e.g., "실내", "야외", "텐트"

-- Add comments for clarity
comment on column recommendation_pool.servings is 'Cooking: Recommended number of servings';
comment on column recommendation_pool.calories is 'Cooking: Estimated calories (kcal)';
comment on column recommendation_pool.age_group is 'Play: Recommended age group';
comment on column recommendation_pool.location_type is 'Play: Indoor/Outdoor/Tent';

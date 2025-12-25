-- 20251225_recommendation_v2.sql

-- Add new columns for detailed recommendation logic
alter table recommendation_pool
add column if not exists difficulty integer check (difficulty between 1 and 5),
add column if not exists time_required integer, -- minutes
add column if not exists min_participants integer,
add column if not exists max_participants integer,
add column if not exists materials jsonb default '[]'::jsonb, -- Array of strings
add column if not exists ingredients jsonb default '[]'::jsonb, -- Array of strings or objects
add column if not exists process_steps jsonb default '[]'::jsonb, -- Array of strings or objects
add column if not exists tips text;

-- Add comment for documentation
comment on column recommendation_pool.difficulty is '1: Easy, 5: Hard';
comment on column recommendation_pool.time_required is 'Estimated time in minutes';
comment on column recommendation_pool.materials is 'For Play: Required items';
comment on column recommendation_pool.ingredients is 'For Cooking: Required ingredients';
comment on column recommendation_pool.process_steps is 'Step-by-step instructions';

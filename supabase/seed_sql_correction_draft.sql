
-- Update tags for sample recommendations by Title
-- We use UPDATE because ID is bigint (auto-increment) and we don't know the IDs in the remote DB.

-- 1. 솥뚜껑 삼겹살
UPDATE public.recommendation_pool
SET 
    tags = ARRAY['#고기', '#저녁', '#술안주', '#바비큐', '#메인요리', '#파티', '#헤비'],
    season = ARRAY['spring', 'summer', 'autumn', 'winter']::text[], -- season is stored in metadata usually, but let's check schema. Schema says 'metadata' has season. Wait, my previous script tried to update 'tags' and 'metadata'.
    -- The previous script had 'metadata' with season. The schema has 'tags' as jsonb? 
    -- 20251225_recommendation_engine.sql says: tags jsonb default '{}'::jsonb
    -- But the previous seed used ARRAY['#...'].
    -- ERROR: column "tags" is of type jsonb but expression is of type text[]
    -- Wait, looking at 20251225 schema: "tags jsonb default '{}'::jsonb"
    -- But my previous seed used "tags = ARRAY[...]".
    -- I need to verify if tags is JSONB or ARRAY.
    -- CONTRADICTION: 20251225 schema says jsonb.
    -- But 20260211 or later might have changed it?
    -- `20260212_recommendation_constraint.sql` might show changes.
    metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{season}',
        '["spring", "summer", "autumn", "winter"]'
    )
WHERE title = '솥뚜껑 삼겹살';

-- Wait, I need to know the column types for sure. 
-- 20251225_recommendation_engine.sql: tags jsonb
-- But `seed_recommendations.sql` (which I read previously from user's disk?) had `ARRAY['#...']`.
-- If the user already had that file, maybe the schema changed to text[]?
-- I will inspect `20260212_recommendation_constraint.sql` first.

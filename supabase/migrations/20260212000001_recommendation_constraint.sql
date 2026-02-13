-- 20260212_recommendation_constraint.sql

-- Add Unique Constraint to recommendation_pool to prevent duplicates
-- Strategy:
-- 1. Remove duplicate entries if any exist (keeping the latest one)
-- 2. Add unique constraint on (title, category)

DO $$
BEGIN
    -- 1. Remove duplicates (if any)
    DELETE FROM recommendation_pool
    WHERE id IN (
        SELECT id
        FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY title, category 
                       ORDER BY updated_at DESC
                   ) as r_num
            FROM recommendation_pool
        ) t
        WHERE t.r_num > 1
    );

    -- 2. Add Constraint
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'recommendation_pool_title_category_key'
    ) THEN
        ALTER TABLE recommendation_pool
            ADD CONSTRAINT recommendation_pool_title_category_key UNIQUE (title, category);
    END IF;

END $$;

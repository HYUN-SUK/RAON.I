-- DEBUG: Check for Constraints and Attempt Raw Delete
-- 1. Inspect Foreign Keys on 'posts'
SELECT
    tc.table_schema, 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='posts';

-- 2. Check if ANY tables verify 'posts' (Inverse FK) - e.g. comments pointing to posts
-- This logic is complex in pure SQL without looking at all tables, but mainly we care if 'comments' or 'images' exist.
SELECT * FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' 
AND constraint_name IN (
    SELECT constraint_name FROM information_schema.referential_constraints 
    WHERE unique_constraint_name IN (
        SELECT constraint_name FROM information_schema.table_constraints 
        WHERE table_name = 'posts' AND constraint_type = 'PRIMARY KEY'
    )
);

-- 3. Attempt Raw Delete (Transaction safe - matches RLS Test Verify ID)
BEGIN;
DELETE FROM public.posts WHERE id = 'e2d695a1-10f1-4f61-a12b-083212f1460b';
-- If this fails, it will show the Constraint Violation error.
ROLLBACK; -- Always rollback so we don't actually destroy data if we want to debug closer, or COMMIT if we just want it gone.
-- Actually, let's ROLLBACK to see the error.

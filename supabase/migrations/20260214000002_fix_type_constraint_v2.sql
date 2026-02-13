-- 20251219_fix_type_constraint.sql
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_type_check;
DO $$ BEGIN
    ALTER TABLE public.posts ADD CONSTRAINT posts_type_check CHECK (type IN ('story', 'notice', 'review', 'qna', 'group_story', 'STORY', 'NOTICE', 'REVIEW', 'GROUP', 'QNA'));
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN duplicate_table THEN null;
END $$;

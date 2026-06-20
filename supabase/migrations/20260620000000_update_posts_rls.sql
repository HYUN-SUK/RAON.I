-- Update RLS policy for posts table to reflect new permission rules
-- 1) Public visibility posts -> Viewable by everyone
-- 2) NOTICE posts -> Viewable by everyone
-- 3) Private STORY or REVIEW -> Viewable ONLY by author
-- 4) Private QNA -> Viewable ONLY by author OR admin

DROP POLICY IF EXISTS "Read Access Policy" ON public.posts;

CREATE POLICY "Read Access Policy" ON public.posts FOR SELECT USING (
  -- 1. Public content
  (meta_data->>'visibility' = 'PUBLIC' OR meta_data->>'visibility' IS NULL)
  -- 2. Notices are always public
  OR (type = 'NOTICE')
  -- 3. Author always sees their own content (Private STORY, REVIEW, QNA)
  OR (auth.uid() = author_id)
  -- 4. Admin can only see QNA type private posts (STORY and REVIEW private posts are hidden even from Admin)
  OR (
    (type = 'QNA' OR type = 'qna') AND (
      (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR 
      (auth.jwt() ->> 'email' = 'admin@raon.ai')
    )
  )
);

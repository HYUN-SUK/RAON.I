-- 1. Create comment_likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(comment_id, user_id)
);

-- 2. Add likes_count to comments
ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- 3. Enable RLS for comment_likes
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can like comments"
    ON public.comment_likes FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Everyone can see comment likes"
    ON public.comment_likes FOR SELECT
    USING (true);

-- 4. RPC for Toggling Comment Like
CREATE OR REPLACE FUNCTION toggle_comment_like(p_comment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_exists BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Check if like exists
    SELECT EXISTS (
        SELECT 1 FROM public.comment_likes
        WHERE comment_id = p_comment_id AND user_id = v_user_id
    ) INTO v_exists;

    IF v_exists THEN
        -- Unlike
        DELETE FROM public.comment_likes
        WHERE comment_id = p_comment_id AND user_id = v_user_id;

        -- Decrement count
        UPDATE public.comments
        SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0)
        WHERE id = p_comment_id;
        
        RETURN FALSE; -- Unliked
    ELSE
        -- Like
        INSERT INTO public.comment_likes (comment_id, user_id)
        VALUES (p_comment_id, v_user_id);

        -- Increment count
        UPDATE public.comments
        SET likes_count = COALESCE(likes_count, 0) + 1
        WHERE id = p_comment_id;
        
        RETURN TRUE; -- Liked
    END IF;
END;
$$;

-- 5. Enable DELETE for comments (Users can delete their own comments)
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;

CREATE POLICY "Users can delete own comments"
    ON public.comments FOR DELETE
    USING (auth.uid() = user_id);

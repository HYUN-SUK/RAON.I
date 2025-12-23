-- RPC to fetch comments with user info and like status
CREATE OR REPLACE FUNCTION get_post_comments(p_post_id UUID)
RETURNS TABLE (
    id UUID,
    post_id UUID,
    user_id UUID,
    content TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ,
    likes_count INTEGER,
    is_liked_by_me BOOLEAN,
    user_info JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_viewer_id UUID := auth.uid();
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.post_id,
        c.user_id,
        c.content,
        c.image_url,
        c.created_at,
        COALESCE(c.likes_count, 0),
        CASE 
            WHEN v_viewer_id IS NULL THEN FALSE 
            ELSE EXISTS(
                SELECT 1 FROM public.comment_likes cl 
                WHERE cl.comment_id = c.id AND cl.user_id = v_viewer_id
            ) 
        END as is_liked_by_me,
        jsonb_build_object(
            'nickname', COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
            'profile_image_url', au.raw_user_meta_data->>'avatar_url'
        ) as user_info
    FROM public.comments c
    LEFT JOIN auth.users au ON c.user_id = au.id
    WHERE c.post_id = p_post_id
    ORDER BY c.created_at ASC;
END;
$$;

-- Mission Feed RPC
-- Fetches mission submissions with user info and like status

CREATE OR REPLACE FUNCTION get_mission_feed(p_mission_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    mission_id UUID,
    content TEXT,
    image_url TEXT,
    status TEXT,
    completed_at TIMESTAMPTZ,
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
        um.id,
        um.user_id,
        um.mission_id,
        um.content,
        um.image_url,
        um.status::TEXT,
        um.completed_at,
        um.created_at,
        COALESCE(um.likes_count, 0),
        CASE 
            WHEN v_viewer_id IS NULL THEN FALSE 
            ELSE EXISTS(
                SELECT 1 FROM public.mission_likes ml 
                WHERE ml.user_mission_id = um.id AND ml.user_id = v_viewer_id
            ) 
        END as is_liked_by_me,
        jsonb_build_object(
            'nickname', COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
            'profile_image_url', au.raw_user_meta_data->>'avatar_url'
        ) as user_info
    FROM public.user_missions um
    JOIN auth.users au ON um.user_id = au.id
    WHERE um.mission_id = p_mission_id
    AND um.status IN ('COMPLETED', 'CLAIMED', 'APPROVED') -- Show completed missions
    ORDER BY um.created_at DESC;
END;
$$;

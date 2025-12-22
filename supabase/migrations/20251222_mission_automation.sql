-- RPC to ensure a Mission has a corresponding Community Post
-- This allows any authenticated user (via App) to trigger post creation "lazily"
-- even if they don't have permission to write to missions/posts tables directly.

CREATE OR REPLACE FUNCTION public.ensure_mission_post(target_mission_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the function creator (admin)
AS $$
DECLARE
    existing_post_id UUID;
    mission_record RECORD;
    new_post_id UUID;
BEGIN
    -- 1. Check if mission exists and get details
    SELECT * INTO mission_record FROM public.missions WHERE id = target_mission_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mission not found';
    END IF;

    -- 2. If already linked, return it
    IF mission_record.community_post_id IS NOT NULL THEN
        RETURN mission_record.community_post_id;
    END IF;

    -- 3. Create Post (Type: STORY, Author: RAON.I)
    -- Using 'RAON.I' as author to indicate official system post
    INSERT INTO public.posts (
        type, 
        title, 
        content, 
        author_name, 
        images, 
        meta_data
    ) VALUES (
        'STORY',
        '[금주의 미션] ' || mission_record.title,
        mission_record.description,
        '라온아이', 
        ARRAY[]::TEXT[],
        jsonb_build_object('status', 'OPEN', 'visibility', 'PUBLIC', 'is_mission', true)
    ) RETURNING id INTO new_post_id;

    -- 4. Link back to Mission
    UPDATE public.missions 
    SET community_post_id = new_post_id 
    WHERE id = target_mission_id;

    RETURN new_post_id;
END;
$$;

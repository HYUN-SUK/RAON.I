-- Consolidated Script: Create Function AND Grant Permissions

-- 1. Create or Replace the Function
CREATE OR REPLACE FUNCTION public.ensure_mission_post(target_mission_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    existing_post_id UUID;
    mission_record RECORD;
    new_post_id UUID;
BEGIN
    SELECT * INTO mission_record FROM public.missions WHERE id = target_mission_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mission not found';
    END IF;

    IF mission_record.community_post_id IS NOT NULL THEN
        RETURN mission_record.community_post_id;
    END IF;

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

    UPDATE public.missions 
    SET community_post_id = new_post_id 
    WHERE id = target_mission_id;

    RETURN new_post_id;
END;
$$;

-- 2. Grant Permissions (The part that failed previously)
GRANT EXECUTE ON FUNCTION public.ensure_mission_post(UUID) TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload config';

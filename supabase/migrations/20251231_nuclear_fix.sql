-- NUCLEAR FIX: Force Delete & Safe XP
-- Date: 2025-12-31

SET search_path = public, auth, extensions;

-- 1. AGGRESSIVE CONSTRAINT REMOVAL
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'point_history' 
        AND constraint_type = 'UNIQUE'
    ) LOOP
        -- Preserve PK, drop others to allow re-acquisition
        IF r.constraint_name != 'point_history_pkey' THEN
            EXECUTE 'ALTER TABLE public.point_history DROP CONSTRAINT ' || r.constraint_name;
        END IF;
    END LOOP;
END $$;


-- 2. FORCE DELETE RPC
CREATE OR REPLACE FUNCTION admin_force_delete_post(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Delete Likes
    DELETE FROM public.likes WHERE post_id = p_post_id;
    
    -- 2. Delete Comments and their Interactions
    DELETE FROM public.comment_likes 
    WHERE comment_id IN (SELECT id FROM public.comments WHERE post_id = p_post_id);
    
    DELETE FROM public.comments WHERE post_id = p_post_id;

    -- 3. Delete Point History (Orphaned)
    DELETE FROM public.point_history WHERE related_id = p_post_id;

    -- 4. Delete Post
    DELETE FROM public.posts WHERE id = p_post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_force_delete_post(UUID) TO authenticated, service_role;

-- 3. RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';

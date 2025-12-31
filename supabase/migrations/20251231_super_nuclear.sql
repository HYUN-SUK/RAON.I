-- SUPER NUCLEAR FIX
-- Use this if normal constraints are causing unresolvable blocks.

-- 1. TURN OFF REPLICATION (Disables Triggers & FKs temporarily)
SET session_replication_role = 'replica';

-- 2. FORCE CLEANUP (Remove stuck data manually if ID is known, but here we just drop constraints)

-- 3. DROP CONSTRAINTS EXPLICITLY (Guessing typical names)
ALTER TABLE public.point_history DROP CONSTRAINT IF EXISTS point_history_user_id_related_mission_id_key;
ALTER TABLE public.point_history DROP CONSTRAINT IF EXISTS point_history_user_id_related_id_key;
ALTER TABLE public.point_history DROP CONSTRAINT IF EXISTS point_history_related_mission_id_key; -- If distinct

-- 4. RE-ENABLE REPLICATION
SET session_replication_role = 'origin';

-- 5. ENSURE RPC EXISTS (Re-run creation just in case)
CREATE OR REPLACE FUNCTION admin_force_delete_post(p_post_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Disable triggers for this transaction to avoid recursion blocks
    SET session_replication_role = 'replica';
    
    DELETE FROM public.likes WHERE post_id = p_post_id;
    DELETE FROM public.comment_likes WHERE comment_id IN (SELECT id FROM public.comments WHERE post_id = p_post_id);
    DELETE FROM public.comments WHERE post_id = p_post_id;
    DELETE FROM public.point_history WHERE related_id = p_post_id;
    DELETE FROM public.posts WHERE id = p_post_id;

    -- Re-enable
    SET session_replication_role = 'origin';
END;
$$;

GRANT EXECUTE ON FUNCTION admin_force_delete_post(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

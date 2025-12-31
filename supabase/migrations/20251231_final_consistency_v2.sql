-- FINAL V2: XP CASCADE & ADMIN FIXES
SET search_path = public, auth, extensions;

-- 1. DROP LEGACY SYNC TRIGGERS
DROP TRIGGER IF EXISTS sync_mission_likes ON public.mission_likes;
DROP TRIGGER IF EXISTS sync_comment_likes ON public.comment_likes;
DROP FUNCTION IF EXISTS sync_mission_like_to_comment();
DROP FUNCTION IF EXISTS sync_comment_like_to_mission();

-- 2. GENERIC CASCADE DELETE FUNCTION (The Fix)
CREATE OR REPLACE FUNCTION cascade_delete_point_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete point history where related_id matches the deleted entity's ID
    DELETE FROM public.point_history WHERE related_id = OLD.id;
    RETURN OLD;
END;
$$;

-- 3. ATTACH CASCADE TRIGGERS (Posts, Comments, UserMissions)
DROP TRIGGER IF EXISTS on_delete_user_mission_points ON public.user_missions;
CREATE TRIGGER on_delete_user_mission_points
    AFTER DELETE ON public.user_missions
    FOR EACH ROW EXECUTE FUNCTION cascade_delete_point_history();

DROP TRIGGER IF EXISTS on_delete_post_points ON public.posts;
CREATE TRIGGER on_delete_post_points
    AFTER DELETE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION cascade_delete_point_history();

DROP TRIGGER IF EXISTS on_delete_comment_points ON public.comments;
CREATE TRIGGER on_delete_comment_points
    AFTER DELETE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION cascade_delete_point_history();

-- 4. FIX XP RE-ACQUISITION (Drop Constraints)
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'point_history' AND constraint_name LIKE '%related_mission_id_key%') LOOP
        EXECUTE 'ALTER TABLE public.point_history DROP CONSTRAINT ' || r.constraint_name;
    END LOOP;
END $$;

-- 5. ADMIN COMMENT DELETION RPC
CREATE OR REPLACE FUNCTION admin_delete_comment(p_comment_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM public.comments WHERE id = p_comment_id;
    RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_delete_comment(UUID) TO authenticated, service_role;

-- 6. ADMIN RLS POLICIES (Full Access)
DROP POLICY IF EXISTS "Admin can delete any post" ON public.posts;
CREATE POLICY "Admin can delete any post" ON public.posts FOR DELETE TO authenticated
USING ((auth.jwt() ->> 'email') = 'admin@raon.ai' OR ((auth.jwt() -> 'user_metadata') ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admin can delete any comment" ON public.comments;
CREATE POLICY "Admin can delete any comment" ON public.comments FOR DELETE TO authenticated
USING ((auth.jwt() ->> 'email') = 'admin@raon.ai' OR ((auth.jwt() -> 'user_metadata') ->> 'role') = 'admin');

NOTIFY pgrst, 'reload schema';

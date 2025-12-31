-- CONSISTENCY FIXES: XP Cascade & Admin Permissions
-- Date: 2025-12-31

SET search_path = public, auth, extensions;

-- 1. XP CLAWBACK CASCADE TRIGGER
-- When a User Mission is deleted, we MUST delete the associated point_history
-- so that the 'on_point_history_delete' trigger fires and deducts the points.
CREATE OR REPLACE FUNCTION cascade_delete_point_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete point history where related_id matches the deleted entity's ID
    -- This works for user_missions, and potentially posts/comments if they use related_id logic.
    DELETE FROM public.point_history WHERE related_id = OLD.id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_user_mission_delete_points ON public.user_missions;
CREATE TRIGGER on_user_mission_delete_points
    AFTER DELETE ON public.user_missions
    FOR EACH ROW
    EXECUTE FUNCTION cascade_delete_point_history();

-- 2. ENSURE ADMIN CAN DELETE Any Post Trigger?
-- Usually RLS handles this. Admin needs 'true' for DELETE policy.
-- Let's verify RLS policies for 'posts' and 'comments'.

-- Allow Admin to Delete ANY Post
DROP POLICY IF EXISTS "Admin can delete any post" ON public.posts;
CREATE POLICY "Admin can delete any post"
    ON public.posts
    FOR DELETE
    TO authenticated
    USING (
        (auth.jwt() ->> 'email') = 'admin@raon.ai' OR
        ((auth.jwt() -> 'user_metadata') ->> 'role') = 'admin'
    );

-- Allow Admin to Delete ANY Comment
DROP POLICY IF EXISTS "Admin can delete any comment" ON public.comments;
CREATE POLICY "Admin can delete any comment"
    ON public.comments
    FOR DELETE
    TO authenticated
    USING (
        (auth.jwt() ->> 'email') = 'admin@raon.ai' OR
        ((auth.jwt() -> 'user_metadata') ->> 'role') = 'admin'
    );

-- 3. RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';

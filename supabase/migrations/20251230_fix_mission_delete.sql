-- Allow users to delete their own mission participation
-- Drop if exists to avoid "already exists" error
DROP POLICY IF EXISTS "Users can delete own mission participation" ON public.user_missions;

CREATE POLICY "Users can delete own mission participation" ON public.user_missions
    FOR DELETE USING (auth.uid() = user_id);

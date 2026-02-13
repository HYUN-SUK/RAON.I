-- Enable DELETE for user_missions (Users can delete their own participation)
DROP POLICY IF EXISTS "Users can delete own mission participation" ON public.user_missions;

CREATE POLICY "Users can delete own mission participation"
    ON public.user_missions FOR DELETE
    USING (auth.uid() = user_id);

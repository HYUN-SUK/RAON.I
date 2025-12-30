-- Fix Reverse Cascade: Deleting Mission Comment -> Withdraws Mission
-- 2025-12-30

SET search_path = public, auth, extensions;

-- Function to handle the cascading logic
CREATE OR REPLACE FUNCTION handle_mission_comment_deletion()
RETURNS TRIGGER AS $$
DECLARE
    v_mission_id UUID;
BEGIN
    -- 1. Check if the comment's post is a 'Mission Community Post'
    SELECT id INTO v_mission_id
    FROM public.missions
    WHERE community_post_id = OLD.post_id;

    -- 2. If it is linked to a mission, we must cancel participation
    IF v_mission_id IS NOT NULL THEN
        -- A. Delete Point History (Remove Reward)
        DELETE FROM public.point_history 
        WHERE related_id = v_mission_id AND user_id = OLD.user_id;

        -- B. Delete Mission Likes (Cleanup)
        DELETE FROM public.mission_likes 
        WHERE user_mission_id IN (
            SELECT id FROM public.user_missions 
            WHERE mission_id = v_mission_id AND user_id = OLD.user_id
        );

        -- C. Delete User Mission (Withdraw Participation)
        DELETE FROM public.user_missions 
        WHERE mission_id = v_mission_id AND user_id = OLD.user_id;
        
        -- D. Decrement Post Comment Count (Safe to do here or relying on previous Fix logic)
        -- The previous fix handled manual decrement in RPC. 
        -- If user deletes via UI (direct delete), we still need to decrement count.
        -- Let's ensure the count is accurate.
        UPDATE public.posts
        SET comment_count = GREATEST(0, comment_count - 1)
        WHERE id = OLD.post_id;
        
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
DROP TRIGGER IF EXISTS on_mission_comment_delete ON public.comments;

CREATE TRIGGER on_mission_comment_delete
AFTER DELETE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION handle_mission_comment_deletion();

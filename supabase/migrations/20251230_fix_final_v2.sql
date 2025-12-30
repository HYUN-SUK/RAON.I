-- Final Fix for Mission Persistence and Comment Visibility
-- 2025-12-30

SET search_path = public, auth, extensions;

-- 1. FIX: Update withdraw_mission to completely clean up (Cascade Delete)
-- This ensures no foreign key constraints (like point_history) block the deletion.
CREATE OR REPLACE FUNCTION withdraw_mission(p_mission_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_community_post_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Get Community Post ID for this mission
    SELECT community_post_id INTO v_community_post_id
    FROM public.missions
    WHERE id = p_mission_id;
    
    -- A. Delete Point History (Rewards)
    -- Explicitly remove any reward history linked to this mission.
    DELETE FROM public.point_history
    WHERE related_id = p_mission_id AND user_id = v_user_id;

    -- A-2. Delete Mission Likes (Explicit Cleanup)
    -- Just in case CASCADE is missing or failing, we force delete likes.
    DELETE FROM public.mission_likes
    WHERE user_mission_id IN (
        SELECT id FROM public.user_missions 
        WHERE mission_id = p_mission_id AND user_id = v_user_id
    );

    -- B. Delete Comments (Community Interaction)
    IF v_community_post_id IS NOT NULL THEN
        -- Check if a comment exists to handle counter update
        IF EXISTS (SELECT 1 FROM public.comments WHERE post_id = v_community_post_id AND user_id = v_user_id) THEN
            DELETE FROM public.comments
            WHERE post_id = v_community_post_id AND user_id = v_user_id;

            -- Decrement comment count manually (since we don't have a trigger yet)
            UPDATE public.posts
            SET comment_count = GREATEST(0, comment_count - 1)
            WHERE id = v_community_post_id;
        END IF;
    END IF;

    -- C. Delete User Mission (Participation)
    DELETE FROM public.user_missions
    WHERE mission_id = p_mission_id AND user_id = v_user_id;
    
    RETURN FOUND;
END;
$$;

-- 2. FIX: Reset RLS on Comments to ensure Visibility
-- "Comments should be viewable by everyone" (Public Read)

-- Enable RLS (Just in case)
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Drop potentially conflicting or restrictive policies
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
DROP POLICY IF EXISTS "Users can view comments" ON public.comments;
DROP POLICY IF EXISTS "Public comments" ON public.comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.comments;

-- Re-create Policies

-- READ: Everyone can see all comments
CREATE POLICY "Comments are viewable by everyone" ON public.comments
    FOR SELECT USING (true);

-- CREATE: Authenticated users can create
CREATE POLICY "Users can create comments" ON public.comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own
CREATE POLICY "Users can update their own comments" ON public.comments
    FOR UPDATE USING (auth.uid() = user_id);

-- DELETE: Users can delete their own
CREATE POLICY "Users can delete their own comments" ON public.comments
    FOR DELETE USING (auth.uid() = user_id);

-- 3. Cleanup Duplicate 'ensure_mission_post' Permissions (Safety)
GRANT EXECUTE ON FUNCTION public.ensure_mission_post(UUID) TO authenticated, anon, service_role;

-- 4. FIX: Recalculate Comment Counts (Self-Healing)
-- Fixes any existing "Zombie Counts" caused by previous bugs (e.g., 10 counts shown, but 1 comment visible)
UPDATE public.posts p
SET comment_count = (
    SELECT count(*)
    FROM public.comments c
    WHERE c.post_id = p.id
);

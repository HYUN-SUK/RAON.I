-- Test Read Count RPC directly in DB
-- Run this in Supabase SQL Editor to verify the function works regardless of UI.

DO $$
DECLARE
    v_post_id uuid;
    v_old_count int;
    v_new_count int;
BEGIN
    -- 1. Pick a random post
    SELECT id, read_count INTO v_post_id, v_old_count FROM public.posts LIMIT 1;
    
    RAISE NOTICE 'Testing Post ID: %, Old Count: %', v_post_id, v_old_count;

    -- 2. Call the function
    PERFORM increment_read_count(v_post_id);

    -- 3. Check new count
    SELECT read_count INTO v_new_count FROM public.posts WHERE id = v_post_id;
    
    RAISE NOTICE 'New Count: %', v_new_count;

    IF v_new_count > v_old_count THEN
        RAISE NOTICE 'SUCCESS: Count incremented!';
    ELSE
        RAISE EXCEPTION 'FAILURE: Count did not increment!';
    END IF;
END $$;

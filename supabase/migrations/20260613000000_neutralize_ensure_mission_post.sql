-- Fix: Neutralize 'ensure_mission_post' RPC to prevent auto-generating weekly mission notice posts on the story board.

DROP FUNCTION IF EXISTS public.ensure_mission_post(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.ensure_mission_post(target_mission_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Neutralized: Returns NULL and performs no insert to prevent creating weekly mission posts in the community board.
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_mission_post(UUID) TO authenticated, anon, service_role;

-- Restore Admin Delete Post RPC
-- Date: 2025-12-31

SET search_path = public, auth, extensions;

-- Re-create admin_delete_post function
CREATE OR REPLACE FUNCTION admin_delete_post(p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete the post (Cascading deletes handles comments/likes usually, but let's be safe)
    DELETE FROM public.posts WHERE id = p_post_id;
    
    RETURN FOUND; -- Returns true if a row was deleted, false otherwise
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_post(UUID) TO authenticated, service_role;

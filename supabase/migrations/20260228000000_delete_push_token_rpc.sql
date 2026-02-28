-- Create a secure RPC for deleting push tokens by token string
-- This allows the Edge Function (using service_role) to prune tokens without complex RLS management
CREATE OR REPLACE FUNCTION delete_push_token(token_to_delete TEXT)
RETURNS VOID AS $$
BEGIN
    DELETE FROM push_tokens WHERE token = token_to_delete;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

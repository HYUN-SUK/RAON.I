-- Grant execute permissions to all roles (including anonymous users for first load)
GRANT EXECUTE ON FUNCTION public.ensure_mission_post(UUID) TO authenticated, anon, service_role;

-- Force refresh schema cache if needed (not a SQL command, just ensuring idempotency)
NOTIFY pgrst, 'reload config';

-- Create temporary RPC to inspect policies
CREATE OR REPLACE FUNCTION public.get_policies_for_tables()
RETURNS TABLE(schemaname text, tablename text, policyname text, roles name[], cmd text, qual text, with_check text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT schemaname::text, tablename::text, policyname::text, roles, cmd::text, qual::text, with_check::text
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public';
$$;

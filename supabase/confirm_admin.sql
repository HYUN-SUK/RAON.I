-- Execute this in Supabase SQL Editor to enable Admin Login
-- This confirms the email and grants 'admin' role to the specified user

UPDATE auth.users
SET 
  email_confirmed_at = now(),
  raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'
  )
WHERE email = 'admin@raon.ai';

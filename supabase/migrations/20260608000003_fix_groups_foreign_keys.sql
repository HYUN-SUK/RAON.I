-- Migration: Fix Groups Foreign Keys and Update Signup Eligibility Bypass
-- Date: 2026-06-08
-- Description: Drop invalid foreign key references pointing to public.users and redirect them to public.profiles, then update check_signup_eligibility to allow tootg@naver.com.

-- 1. Fix foreign keys for groups and group_members
ALTER TABLE public.group_members DROP CONSTRAINT IF EXISTS group_members_user_id_fkey;
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_owner_id_fkey;

ALTER TABLE public.group_members
    ADD CONSTRAINT group_members_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.profiles(id) 
    ON DELETE CASCADE;

ALTER TABLE public.groups
    ADD CONSTRAINT groups_owner_id_fkey 
    FOREIGN KEY (owner_id) 
    REFERENCES public.profiles(id) 
    ON DELETE SET NULL;


-- Recreate check_signup_eligibility with correct logic
CREATE OR REPLACE FUNCTION public.check_signup_eligibility(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_email_hash TEXT;
    v_is_withdrawn_recently BOOLEAN;
BEGIN
    -- toot@naver.com 및 tootg@naver.com 즉시 재가입 예외 적용
    IF p_email = 'toot@naver.com' OR p_email = 'tootg@naver.com' THEN
        RETURN TRUE;
    END IF;

    v_email_hash := encode(digest(p_email, 'sha256'), 'hex');
    
    SELECT EXISTS (
        SELECT 1 FROM public.withdrawn_user_records
        WHERE user_email_hash = v_email_hash
          AND withdrawn_at >= NOW() - INTERVAL '30 days'
    ) INTO v_is_withdrawn_recently;

    IF v_is_withdrawn_recently THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

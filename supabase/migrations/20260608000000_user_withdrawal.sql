-- Enable pgcrypto extension for SHA-256 hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create withdrawn_user_records Table
CREATE TABLE IF NOT EXISTS public.withdrawn_user_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    user_email_hash TEXT NOT NULL,
    withdrawn_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    raw_reservation_data JSONB DEFAULT '[]'::jsonb,
    raw_schedule_data JSONB DEFAULT '[]'::jsonb,
    retained_until TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexing for fast search and clean up
CREATE INDEX IF NOT EXISTS idx_withdrawn_user_email_hash ON public.withdrawn_user_records(user_email_hash);
CREATE INDEX IF NOT EXISTS idx_withdrawn_retained_until ON public.withdrawn_user_records(retained_until);

-- Enable RLS for archiving table
ALTER TABLE public.withdrawn_user_records ENABLE ROW LEVEL SECURITY;

-- Block public select/write, only allow authenticated service role
CREATE POLICY "Service role only access withdrawn records" 
    ON public.withdrawn_user_records 
    FOR ALL 
    USING (false);

-- 2. Create withdrawal RPC function (fn_withdraw_user)
CREATE OR REPLACE FUNCTION public.fn_withdraw_user(p_user_id UUID, p_email_hash TEXT)
RETURNS VOID AS $$
DECLARE
    v_has_active_reservation BOOLEAN;
    v_reservations JSONB;
    v_schedules JSONB;
BEGIN
    -- 1. Check for active reservations (check_in >= today and status in PENDING, CONFIRMED)
    SELECT EXISTS (
        SELECT 1 FROM public.reservations
        WHERE user_id = p_user_id 
          AND status IN ('PENDING', 'CONFIRMED')
          AND check_in_date >= CURRENT_DATE
    ) INTO v_has_active_reservation;

    IF v_has_active_reservation THEN
        RAISE EXCEPTION 'ACTIVE_RESERVATION_EXISTS';
    END IF;

    -- 2. Aggregate archiving data to JSONB
    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_reservations
    FROM public.reservations r
    WHERE r.user_id = p_user_id;

    SELECT COALESCE(jsonb_agg(s), '[]'::jsonb) INTO v_schedules
    FROM public.user_schedules s
    WHERE s.user_id = p_user_id;

    -- 3. Copy/Archive to separated storage
    INSERT INTO public.withdrawn_user_records (
        user_id,
        user_email_hash,
        raw_reservation_data,
        raw_schedule_data,
        retained_until
    ) VALUES (
        p_user_id,
        p_email_hash,
        v_reservations,
        v_schedules,
        NOW() + INTERVAL '5 years'
    );

    -- 4. Anonymize community posts and comments
    UPDATE public.posts
    SET author_id = NULL, author_name = '탈퇴한 사용자'
    WHERE author_id = p_user_id;

    UPDATE public.comments
    SET author_id = NULL, author_name = '탈퇴한 사용자'
    WHERE author_id = p_user_id;

    -- 5. Hard delete non-retention data
    DELETE FROM public.user_personas WHERE user_id = p_user_id;
    DELETE FROM public.user_campground_hearts WHERE user_id = p_user_id;
    DELETE FROM public.user_missions WHERE user_id = p_user_id;
    DELETE FROM public.point_history WHERE user_id = p_user_id;
    DELETE FROM public.notifications WHERE user_id = p_user_id;
    DELETE FROM public.reservations WHERE user_id = p_user_id;
    DELETE FROM public.user_schedules WHERE user_id = p_user_id;

    -- 6. Delete profile
    DELETE FROM public.profiles WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create signup eligibility checking function (check_signup_eligibility)
CREATE OR REPLACE FUNCTION public.check_signup_eligibility(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_email_hash TEXT;
    v_is_withdrawn_recently BOOLEAN;
BEGIN
    -- 1. Bypass check for developer test email
    IF p_email = 'toot@naver.com' THEN
        RETURN TRUE;
    END IF;

    -- 2. SHA-256 Hashing of email and check existence in past 30 days
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

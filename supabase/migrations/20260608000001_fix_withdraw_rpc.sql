-- Recreate the withdrawal RPC function with the correct reservations check_in_date column reference
CREATE OR REPLACE FUNCTION public.fn_withdraw_user(p_user_id UUID, p_email_hash TEXT)
RETURNS VOID AS $$
DECLARE
    v_has_active_reservation BOOLEAN;
    v_reservations JSONB;
    v_schedules JSONB;
BEGIN
    -- 1. Check for active reservations (check_in_date >= today and status in PENDING, CONFIRMED)
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

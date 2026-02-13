-- =====================================================
-- (comment)
-- 2026-01-12
-- 
-- (comment)
-- (comment)
-- =====================================================

-- (comment)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS refund_bank TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS refund_account TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS refund_holder TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS refund_rate INT DEFAULT 0;

-- (comment)
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
DO $$ BEGIN
    ALTER TABLE reservations ADD CONSTRAINT reservations_status_check 
    CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'COMPLETED'));
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN duplicate_table THEN null;
END $$;

-- (comment)
DROP FUNCTION IF EXISTS calculate_refund_rate(DATE) CASCADE;
CREATE OR REPLACE FUNCTION calculate_refund_rate(p_check_in_date DATE)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_days_until INT;
BEGIN
    v_days_until := p_check_in_date - CURRENT_DATE;
    
-- (comment)
-- (comment)
-- (comment)
-- (comment)
-- (comment)
-- (comment)
-- (comment)
-- (comment)
    
    IF v_days_until <= 1 THEN
        RETURN 0;
    ELSIF v_days_until = 2 THEN
        RETURN 20;
    ELSIF v_days_until = 3 THEN
        RETURN 30;
    ELSIF v_days_until = 4 THEN
        RETURN 40;
    ELSIF v_days_until = 5 THEN
        RETURN 50;
    ELSIF v_days_until = 6 THEN
        RETURN 90;
    ELSE
        RETURN 100;
    END IF;
END;
$$;

-- (comment)
DROP FUNCTION IF EXISTS request_reservation_cancel(UUID, TEXT, TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION request_reservation_cancel(
    p_reservation_id UUID,
    p_refund_bank TEXT,
    p_refund_account TEXT,
    p_refund_holder TEXT,
    p_cancel_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_status TEXT;
    v_check_in DATE;
    v_total_price NUMERIC;
    v_refund_rate INT;
    v_refund_amount NUMERIC;
BEGIN
-- (comment)
    SELECT user_id, status, check_in_date, total_price
    INTO v_user_id, v_status, v_check_in, v_total_price
    FROM reservations
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'NOT_FOUND',
            'message', '?ì½??ì°¾ì ???ìµ?ë¤.'
        );
    END IF;
    
-- (comment)
    IF v_user_id != auth.uid() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'ë³¸ì¸???ì½ë§?ì·¨ì?????ìµ?ë¤.'
        );
    END IF;
    
-- (comment)
    IF v_status NOT IN ('PENDING', 'CONFIRMED') THEN
        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_STATUS',
            'message', 'ì·¨ì?????ë ?ì½ ?í?ë??'
        );
    END IF;
    
-- (comment)
    v_refund_rate := calculate_refund_rate(v_check_in);
    v_refund_amount := ROUND(v_total_price * v_refund_rate / 100);
    
-- (comment)
    UPDATE reservations
    SET 
        status = 'REFUND_PENDING',
        refund_bank = p_refund_bank,
        refund_account = p_refund_account,
        refund_holder = p_refund_holder,
        cancel_reason = p_cancel_reason,
        refund_rate = v_refund_rate,
        refund_amount = v_refund_amount,
        cancelled_at = NOW(),
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    RETURN json_build_object(
        'success', true,
        'refund_rate', v_refund_rate,
        'refund_amount', v_refund_amount,
        'message', 'ì·¨ì ?ì²­???ë£?ì?µë?? ?ë¶? ?ì¸ ??ì²ë¦¬?©ë??'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'DB_ERROR',
        'message', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION request_reservation_cancel(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- (comment)
DROP FUNCTION IF EXISTS complete_reservation_refund(UUID) CASCADE;
CREATE OR REPLACE FUNCTION complete_reservation_refund(p_reservation_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status TEXT;
    v_email TEXT;
BEGIN
-- (comment)
    v_email := auth.jwt() ->> 'email';
    IF v_email != 'admin@raon.ai' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'ê´ë¦¬ì ê¶í???ì?©ë??'
        );
    END IF;
    
-- (comment)
    SELECT status INTO v_status FROM reservations WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'NOT_FOUND',
            'message', '?ì½??ì°¾ì ???ìµ?ë¤.'
        );
    END IF;
    
    IF v_status != 'REFUND_PENDING' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_STATUS',
            'message', '?ë¶?ê¸??í???ì½ë§?ì²ë¦¬?????ìµ?ë¤.'
        );
    END IF;
    
-- (comment)
    UPDATE reservations
    SET 
        status = 'REFUNDED',
        refunded_at = NOW(),
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    RETURN json_build_object(
        'success', true,
        'message', '?ë¶???ë£ ì²ë¦¬?ì?µë??'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'DB_ERROR',
        'message', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION complete_reservation_refund(UUID) TO authenticated;

-- (comment)
DROP FUNCTION IF EXISTS get_my_reservations() CASCADE;
CREATE OR REPLACE FUNCTION get_my_reservations()
RETURNS SETOF reservations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM reservations
    WHERE user_id = auth.uid()
    ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_reservations() TO authenticated;

-- (comment)
DROP POLICY IF EXISTS "Users can update own reservation for cancel" ON reservations;
CREATE POLICY "Users can update own reservation for cancel" ON reservations
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- (comment)
DO $$
BEGIN
    RAISE NOTICE 'Reservation cancellation system installed successfully';
    RAISE NOTICE '  - calculate_refund_rate: Refund rate calculation';
    RAISE NOTICE '  - request_reservation_cancel: User cancel request';
    RAISE NOTICE '  - complete_reservation_refund: Admin refund completion';
    RAISE NOTICE '  - get_my_reservations: User reservation list';
END $$;

-- ==========================================================
-- Push Notification Retry System & Dead-letter Isolation
-- ==========================================================

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'attempt_count') THEN
        ALTER TABLE public.notifications ADD COLUMN attempt_count INT DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'last_attempt_at') THEN
        ALTER TABLE public.notifications ADD COLUMN last_attempt_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'next_retry_at') THEN
        ALTER TABLE public.notifications ADD COLUMN next_retry_at TIMESTAMPTZ;
    END IF;
END $$;

-- Partial index for high-speed retry worker polling
CREATE INDEX IF NOT EXISTS idx_notifications_retry_queue 
ON public.notifications(status, next_retry_at) 
WHERE status = 'retry';

COMMENT ON COLUMN public.notifications.attempt_count IS 'FCM 발송 시도 횟수 (기본 1, 최대 3)';
COMMENT ON COLUMN public.notifications.last_attempt_at IS '최근 발송 시도 시각';
COMMENT ON COLUMN public.notifications.next_retry_at IS '다음 재시도 예정 시각';

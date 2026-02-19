-- ═══════════════════════════════════════════════════════════
-- 알림 시스템 고도화: 중복 발송 방지 및 레거시 트리거 정리
-- ═══════════════════════════════════════════════════════════

-- 1. notifications 테이블에 related_id 컬럼 추가 (Idempotency 지원)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'related_id') THEN
        ALTER TABLE public.notifications ADD COLUMN related_id TEXT;
    END IF;
END $$;

-- 2. in_app_badges 테이블의 related_id 컬럼 타입을 TEXT로 변경 (UUID 외 데이터 지원)
DO $$ 
BEGIN 
    IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'in_app_badges' AND column_name = 'related_id') = 'uuid' THEN
        ALTER TABLE public.in_app_badges ALTER COLUMN related_id TYPE TEXT;
    END IF;
END $$;

-- 3. 인덱스 추가 (중복 체크 최적화)
CREATE INDEX IF NOT EXISTS idx_notifications_related_type ON public.notifications(user_id, event_type, related_id);

-- 4. 레거시 트리거 정리 (on_notification_insert)
DROP TRIGGER IF EXISTS on_notification_insert ON public.notifications;

COMMENT ON COLUMN public.notifications.related_id IS '연관된 데이터 ID (예약 ID 등), 중복 발송 방지용';
COMMENT ON COLUMN public.in_app_badges.related_id IS '연관된 데이터 ID (TEXT로 변경하여 유연성 확보)';

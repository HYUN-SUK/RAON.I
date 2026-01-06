-- ================================================
-- Notifications 테이블 v2: 이벤트 기반 알림 시스템 확장
-- 작성일: 2026-01-06
-- 목적: notificationService.ts에서 사용하는 필드 추가
-- ================================================

-- 1. event_type 컬럼 추가 (알림 이벤트 타입)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS event_type text;

-- 2. data 컬럼 추가 (동적 데이터 JSON)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS data jsonb default '{}';

-- 3. quiet_hours_override 컬럼 추가 (조용시간 예외 플래그)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS quiet_hours_override boolean default false;

-- 4. sent_at 컬럼 추가 (실제 푸시 발송 시간)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone;

-- 5. 인덱스 추가: 대기 중인 알림 빠른 조회
CREATE INDEX IF NOT EXISTS idx_notifications_queued 
ON public.notifications(status, created_at) 
WHERE status = 'queued';

-- 6. 인덱스 추가: 사용자별 알림 조회
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON public.notifications(user_id, created_at DESC);

-- 7. 이벤트 타입별 인덱스
CREATE INDEX IF NOT EXISTS idx_notifications_event_type 
ON public.notifications(event_type);

-- ================================================
-- 알림 발송 트리거 함수 (Edge Function 호출용)
-- Supabase Edge Function을 직접 호출하는 대신
-- pg_notify를 사용하여 비동기 처리
-- ================================================
CREATE OR REPLACE FUNCTION notify_push_queue()
RETURNS TRIGGER AS $$
BEGIN
    -- 새 알림이 큐에 추가되면 채널에 알림
    PERFORM pg_notify('push_notifications', json_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'event_type', NEW.event_type,
        'title', NEW.title,
        'body', NEW.body
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS on_notification_insert ON public.notifications;

CREATE TRIGGER on_notification_insert
AFTER INSERT ON public.notifications
FOR EACH ROW
WHEN (NEW.status = 'queued')
EXECUTE FUNCTION notify_push_queue();

-- ================================================
-- 알림 발송 RPC 함수 (관리자/시스템 전용)
-- ================================================
CREATE OR REPLACE FUNCTION send_push_notification(
    p_user_id uuid,
    p_event_type text,
    p_title text,
    p_body text,
    p_data jsonb DEFAULT '{}',
    p_category text DEFAULT 'system'
)
RETURNS uuid AS $$
DECLARE
    v_notification_id uuid;
BEGIN
    INSERT INTO public.notifications (
        user_id,
        category,
        event_type,
        title,
        body,
        data,
        status
    ) VALUES (
        p_user_id,
        p_category,
        p_event_type,
        p_title,
        p_body,
        p_data,
        'queued'
    )
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 함수 권한 설정
GRANT EXECUTE ON FUNCTION send_push_notification TO authenticated;
GRANT EXECUTE ON FUNCTION send_push_notification TO service_role;

COMMENT ON FUNCTION send_push_notification IS 
'푸시 알림을 큐에 추가하는 RPC 함수. Edge Function이 처리.';

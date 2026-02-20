-- ==========================================================
-- RAON.I Notification & Schedule System Master Fix V2
-- ==========================================================

-- 1. [notifications] 중복 데이터 정리 및 유니크 제약 조건 추가
-- ----------------------------------------------------------

-- 기존 중복 데이터 삭제 (가장 최신 것만 남김)
DELETE FROM public.notifications n1
USING public.notifications n2
WHERE n1.created_at < n2.created_at
  AND n1.user_id = n2.user_id
  AND n1.event_type = n2.event_type
  AND n1.related_id = n2.related_id
  AND n1.related_id IS NOT NULL;

-- 기존 인덱스 삭제 후 유니크 인덱스로 변경 (강제 재생성)
DROP INDEX IF EXISTS idx_notifications_related_type;
DROP INDEX IF EXISTS idx_notifications_unique_related;
DROP INDEX IF EXISTS idx_notifications_unique_related_v2;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_related_v2 ON public.notifications(user_id, event_type, related_id) WHERE related_id IS NOT NULL;

-- 2. [user_schedules] 중복 데이터 정리 및 유니크 제약 조건 추가
-- ----------------------------------------------------------

-- 기존 중복 일정 삭제 (예약 번호 기준)
DELETE FROM public.user_schedules s1
USING public.user_schedules s2
WHERE s1.created_at < s2.created_at
  AND s1.reservation_id = s2.reservation_id
  AND s1.reservation_id IS NOT NULL;

-- 유니크 인덱스 추가 (예약당 일정은 하나만 - 강제 재생성)
DROP INDEX IF EXISTS idx_user_schedules_unique_reservation;
DROP INDEX IF EXISTS idx_user_schedules_unique_reservation_v2;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_schedules_unique_reservation_v2 ON public.user_schedules(reservation_id) WHERE reservation_id IS NOT NULL;

-- 3. [user_schedules] 상태 동기화 트리거 (취소 반영용)
-- ----------------------------------------------------------

-- 예약 상태가 CANCELLED로 변경될 때 일정도 자동으로 CANCELLED로 변경하도록 트리거 추가
CREATE OR REPLACE FUNCTION public.sync_reservation_to_schedule()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status != NEW.status) AND (NEW.status = 'CANCELLED' OR NEW.status = 'REFUNDED') THEN
        UPDATE public.user_schedules
        SET status = 'cancelled', updated_at = NOW()
        WHERE reservation_id = NEW.id;
    ELSIF (OLD.status != NEW.status) AND (NEW.status = 'CONFIRMED') THEN
        -- CONFIRMED 로 복구될 경우 (관리자 실수 등)
        UPDATE public.user_schedules
        SET status = 'scheduled', updated_at = NOW()
        WHERE reservation_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_reservation_status ON public.reservations;
CREATE TRIGGER trigger_sync_reservation_status
AFTER UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.sync_reservation_to_schedule();

-- 성공 메시지 기록
DO $$ BEGIN RAISE NOTICE 'RAON.I DB Master Fix V2 applied successfully.'; END $$;

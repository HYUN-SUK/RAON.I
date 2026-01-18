/**
 * 알림 이벤트 타입 및 정책 정의
 * SSOT 기반: "놓치면 안 되는 순간"에만 푸시, 나머지는 인앱 배지
 */

// ========================================
// 알림 이벤트 타입 Enum
// ========================================
export enum NotificationEventType {
    // 예약 관련 (푸시 허용, 조용시간 예외)
    RESERVATION_SUBMITTED = 'reservation_submitted',  // 예약 신청 완료 (입금 대기)
    RESERVATION_CONFIRMED = 'reservation_confirmed',  // 예약 확정 (입금 확인)
    RESERVATION_CANCELLED = 'reservation_cancelled',
    RESERVATION_CHANGED = 'reservation_changed',
    DEPOSIT_CONFIRMED = 'deposit_confirmed',
    UPCOMING_STAY_D1 = 'upcoming_stay_d1',
    UPCOMING_STAY_TODAY = 'upcoming_stay_today',

    // 빈자리 알림 (사용자 명시적 요청, 푸시 허용)
    WAITLIST_SLOT_OPENED = 'waitlist_slot_opened',

    // 시스템 필수 (푸시 허용)
    SYSTEM_MAINTENANCE = 'system_maintenance',
    SAFETY_NOTICE = 'safety_notice',
    POLICY_CHANGE = 'policy_change',

    // 커뮤니티 반응 (푸시 금지 → 배지만)
    COMMUNITY_LIKE = 'community_like',
    COMMUNITY_COMMENT = 'community_comment',

    // 미션 관련 (푸시 금지 → 배지만)
    MISSION_REMINDER = 'mission_reminder',
    MISSION_REWARD = 'mission_reward',

    // 마켓 관련 (푸시 금지 → 배지만)
    ORDER_STATUS_CHANGE = 'order_status_change',

    // 불씨 관련 (푸시 금지 → 배지만)
    EMBER_RECEIVED = 'ember_received',
}

// ========================================
// 배지 타겟 (하단 네비게이션 탭)
// ========================================
export type BadgeTarget = 'home' | 'reservation' | 'community' | 'myspace' | null;

// ========================================
// 알림 이벤트 설정 인터페이스
// ========================================
export interface NotificationEventConfig {
    type: NotificationEventType;
    requires_push: boolean;         // 푸시 발송 허용 여부
    quiet_hours_override: boolean;  // 조용시간(22:00~08:00)에도 푸시 허용
    fallback_badge: boolean;        // 푸시 불가 시 배지로 대체
    badge_target: BadgeTarget;      // 배지 표시 위치
    title_template: string;         // 제목 템플릿
    body_template: string;          // 본문 템플릿
}

// ========================================
// 전체 이벤트 설정 맵
// ========================================
export const NOTIFICATION_EVENT_CONFIGS: Record<NotificationEventType, NotificationEventConfig> = {
    // ===== 예약 관련 (푸시 O, 조용시간 예외 O) =====

    // 1. 예약 신청 완료 (입금 대기)
    [NotificationEventType.RESERVATION_SUBMITTED]: {
        type: NotificationEventType.RESERVATION_SUBMITTED,
        requires_push: true,
        quiet_hours_override: true,
        fallback_badge: true,
        badge_target: 'reservation',
        title_template: '예약 신청 완료',
        body_template: `입금이 확인되면 예약이 최종 확정됩니다.

▶ 입금 대기 중
입금 계좌: {{bankName}} {{bankAccount}}
예금주: {{bankHolder}}
입금 금액: {{totalPrice}}원
입금 기한: {{deadline}} 까지
* 기한 내 미입금 시 자동 취소됩니다.

일정: {{checkIn}} - {{checkOut}}
사이트: {{siteName}}`,
    },

    // 2. 예약 확정 (입금 확인 후)
    [NotificationEventType.RESERVATION_CONFIRMED]: {
        type: NotificationEventType.RESERVATION_CONFIRMED,
        requires_push: true,
        quiet_hours_override: true,
        fallback_badge: true,
        badge_target: 'reservation',
        title_template: '예약 확정',
        body_template: `예약이 확정되었습니다.

▶ 이용 안내
입실 시간: 14:00
퇴실 시간: 12:00
매너 타임: 22:00 ~ 07:00 (조용히 부탁드려요)

일정: {{checkIn}} - {{checkOut}}
사이트: {{siteName}}`,
    },

    // 3. 예약 취소
    [NotificationEventType.RESERVATION_CANCELLED]: {
        type: NotificationEventType.RESERVATION_CANCELLED,
        requires_push: true,
        quiet_hours_override: true,
        fallback_badge: true,
        badge_target: 'reservation',
        title_template: '예약 취소',
        body_template: `예약이 취소되었습니다.

취소 사유: {{reason}}

일정: {{checkIn}} - {{checkOut}}
사이트: {{siteName}}`,
    },

    // 4. 예약 변경
    [NotificationEventType.RESERVATION_CHANGED]: {
        type: NotificationEventType.RESERVATION_CHANGED,
        requires_push: true,
        quiet_hours_override: true,
        fallback_badge: true,
        badge_target: 'reservation',
        title_template: '예약 변경',
        body_template: `예약이 변경되었습니다.

▶ 기존
일정: {{oldCheckIn}} - {{oldCheckOut}}
사이트: {{oldSiteName}}

▶ 변경
일정: {{newCheckIn}} - {{newCheckOut}}
사이트: {{newSiteName}}
{{priceDiff}}`,
    },

    // 5. 입금 확인 (레거시 - RESERVATION_CONFIRMED와 동일)
    [NotificationEventType.DEPOSIT_CONFIRMED]: {
        type: NotificationEventType.DEPOSIT_CONFIRMED,
        requires_push: true,
        quiet_hours_override: true,
        fallback_badge: true,
        badge_target: 'reservation',
        title_template: '입금 확인',
        body_template: `입금이 확인되었습니다. 예약이 완료되었어요!

▶ 이용 안내
입실 시간: 14:00
퇴실 시간: 12:00
매너 타임: 22:00 ~ 07:00 (조용히 부탁드려요)

일정: {{checkIn}} - {{checkOut}}
사이트: {{siteName}}`,
    },
    [NotificationEventType.UPCOMING_STAY_D1]: {
        type: NotificationEventType.UPCOMING_STAY_D1,
        requires_push: true,
        quiet_hours_override: true,
        fallback_badge: true,
        badge_target: 'reservation',
        title_template: '내일 캠핑이에요!',
        body_template: '{{siteName}}에서의 캠핑이 내일입니다. 준비물을 확인해보세요.',
    },
    [NotificationEventType.UPCOMING_STAY_TODAY]: {
        type: NotificationEventType.UPCOMING_STAY_TODAY,
        requires_push: true,
        quiet_hours_override: true,
        fallback_badge: true,
        badge_target: 'reservation',
        title_template: '오늘 캠핑 날이에요!',
        body_template: '{{siteName}}에서 즐거운 시간 보내세요. 입실 시간은 {{checkInTime}}입니다.',
    },

    // ===== 빈자리 알림 (사용자 요청, 푸시 O) =====
    [NotificationEventType.WAITLIST_SLOT_OPENED]: {
        type: NotificationEventType.WAITLIST_SLOT_OPENED,
        requires_push: true,
        quiet_hours_override: false, // 빈자리는 조용시간에 배지로 대체
        fallback_badge: true,
        badge_target: 'reservation',
        title_template: '빈자리 알림',
        body_template: '요청하신 {{targetDate}}에 예약 가능한 자리가 생겼어요!',
    },

    // ===== 시스템 필수 (푸시 O) =====
    [NotificationEventType.SYSTEM_MAINTENANCE]: {
        type: NotificationEventType.SYSTEM_MAINTENANCE,
        requires_push: true,
        quiet_hours_override: false,
        fallback_badge: true,
        badge_target: 'home',
        title_template: '시스템 점검 안내',
        body_template: '{{message}}',
    },
    [NotificationEventType.SAFETY_NOTICE]: {
        type: NotificationEventType.SAFETY_NOTICE,
        requires_push: true,
        quiet_hours_override: true, // 안전 관련은 항상 푸시
        fallback_badge: true,
        badge_target: 'home',
        title_template: '안전 공지',
        body_template: '{{message}}',
    },
    [NotificationEventType.POLICY_CHANGE]: {
        type: NotificationEventType.POLICY_CHANGE,
        requires_push: true,
        quiet_hours_override: false,
        fallback_badge: true,
        badge_target: 'home',
        title_template: '정책 변경 안내',
        body_template: '{{message}}',
    },

    // ===== 커뮤니티 반응 (푸시 X → 배지만) =====
    [NotificationEventType.COMMUNITY_LIKE]: {
        type: NotificationEventType.COMMUNITY_LIKE,
        requires_push: false,
        quiet_hours_override: false,
        fallback_badge: true,
        badge_target: 'community',
        title_template: '공감을 받았어요',
        body_template: '{{userName}}님이 회원님의 글에 공감했습니다.',
    },
    [NotificationEventType.COMMUNITY_COMMENT]: {
        type: NotificationEventType.COMMUNITY_COMMENT,
        requires_push: false,
        quiet_hours_override: false,
        fallback_badge: true,
        badge_target: 'community',
        title_template: '새 댓글',
        body_template: '{{userName}}님이 댓글을 남겼습니다: "{{preview}}"',
    },

    // ===== 미션 관련 (푸시 X → 배지만) =====
    [NotificationEventType.MISSION_REMINDER]: {
        type: NotificationEventType.MISSION_REMINDER,
        requires_push: false,
        quiet_hours_override: false,
        fallback_badge: true,
        badge_target: 'myspace',
        title_template: '미션 알림',
        body_template: '이번 주 미션을 확인해보세요!',
    },
    [NotificationEventType.MISSION_REWARD]: {
        type: NotificationEventType.MISSION_REWARD,
        requires_push: false,
        quiet_hours_override: false,
        fallback_badge: true,
        badge_target: 'myspace',
        title_template: '보상 지급',
        body_template: '{{reward}} 포인트가 지급되었습니다!',
    },

    // ===== 마켓 관련 (푸시 X → 배지만) =====
    [NotificationEventType.ORDER_STATUS_CHANGE]: {
        type: NotificationEventType.ORDER_STATUS_CHANGE,
        requires_push: false,
        quiet_hours_override: false,
        fallback_badge: true,
        badge_target: 'myspace',
        title_template: '주문 상태 변경',
        body_template: '주문하신 상품이 {{status}} 상태로 변경되었습니다.',
    },

    // ===== 불씨 관련 (푸시 X → 배지만) =====
    [NotificationEventType.EMBER_RECEIVED]: {
        type: NotificationEventType.EMBER_RECEIVED,
        requires_push: false,
        quiet_hours_override: false,
        fallback_badge: true,
        badge_target: 'myspace',
        title_template: '🔥 따뜻한 불씨',
        body_template: '누군가 당신의 기록에 불씨를 남겼어요.',
    },
};

// ========================================
// 유틸리티 함수
// ========================================

/**
 * 템플릿 문자열에 데이터 바인딩
 */
export function renderTemplate(template: string, data: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
}

/**
 * 이벤트 타입으로 설정 조회
 */
export function getEventConfig(eventType: NotificationEventType): NotificationEventConfig {
    return NOTIFICATION_EVENT_CONFIGS[eventType];
}

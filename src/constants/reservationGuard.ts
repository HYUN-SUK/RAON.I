/**
 * 임시 예약 방어 스위치 설정
 * - true: 예약 방어 가동 (tootg@naver.com 및 admin만 허용, 그 외 8월 초 안내 팝업 후 홈 이동)
 * - false: 예약 방어 즉시 해제 (모든 사용자 정상 예약 가능)
 */
export const IS_RESERVATION_LOCKED = true;

// 허용 이메일 목록
export const ALLOWED_RESERVATION_EMAILS = [
    'tootg@naver.com'
];

// 차단 팝업 안내 메시지
export const RESERVATION_LOCK_MESSAGE = "8월 초에 입장이 가능합니다.";

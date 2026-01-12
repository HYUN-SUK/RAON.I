// 한국 주요 은행 목록 (환불 계좌 입력용)
export const KOREAN_BANKS = [
    { code: 'KAKAO', name: '카카오뱅크' },
    { code: 'TOSS', name: '토스뱅크' },
    { code: 'KB', name: 'KB국민은행' },
    { code: 'SHINHAN', name: '신한은행' },
    { code: 'WOORI', name: '우리은행' },
    { code: 'HANA', name: '하나은행' },
    { code: 'NH', name: 'NH농협은행' },
    { code: 'IBK', name: 'IBK기업은행' },
    { code: 'SC', name: 'SC제일은행' },
    { code: 'CITI', name: '씨티은행' },
    { code: 'KBANK', name: '케이뱅크' },
    { code: 'SAEMAUL', name: '새마을금고' },
    { code: 'SUHYUP', name: '수협은행' },
    { code: 'POST', name: '우체국' },
    { code: 'CREDIT', name: '신협' },
    { code: 'OTHER', name: '직접입력' },
] as const;

export type BankCode = typeof KOREAN_BANKS[number]['code'];

// 환불율 계산 함수 (프론트엔드 미리보기용 - 실제 계산은 DB RPC에서)
export function calculateRefundRate(checkInDate: Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkIn = new Date(checkInDate);
    checkIn.setHours(0, 0, 0, 0);

    const diffTime = checkIn.getTime() - today.getTime();
    const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // 환불 정책
    // 입실 당일(0), 1일전: 0%
    // 입실 2일전: 20%
    // 입실 3일전: 30%
    // 입실 4일전: 40%
    // 입실 5일전: 50%
    // 입실 6일전: 90%
    // 입실 7일전 이상: 100%

    if (daysUntil <= 1) return 0;
    if (daysUntil === 2) return 20;
    if (daysUntil === 3) return 30;
    if (daysUntil === 4) return 40;
    if (daysUntil === 5) return 50;
    if (daysUntil === 6) return 90;
    return 100;
}

// 환불금액 계산
export function calculateRefundAmount(totalPrice: number, checkInDate: Date): number {
    const rate = calculateRefundRate(checkInDate);
    return Math.round(totalPrice * rate / 100);
}

// 취소 사유 옵션
export const CANCEL_REASONS = [
    '개인 사정',
    '일정 변경',
    '날씨/기상 악화',
    '건강 문제',
    '기타',
] as const;

export type CancelReason = typeof CANCEL_REASONS[number];

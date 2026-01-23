/**
 * 날짜 관련 유틸리티 함수
 */

/**
 * Date 객체를 로컬 시간대 기준의 YYYY-MM-DD 문자열로 변환합니다.
 * toISOString()은 UTC 기준으로 변환하므로, 한국 시간(KST)에서 하루 전 날짜가 나오는 문제를 방지합니다.
 * 
 * 예: KST 1월 26일 00:00 -> UTC 1월 25일 15:00 -> "2025-01-25" (X)
 *     KST 1월 26일 00:00 -> "2025-01-26" (O)
 */
export const formatLocalDate = (date: Date | string): string => {
    if (!date) return '';

    const d = typeof date === 'string' ? new Date(date) : date;

    if (!(d instanceof Date) || isNaN(d.getTime())) {
        console.error('[formatLocalDate] Invalid date:', date);
        throw new Error(`날짜 형식이 올바르지 않습니다: ${date}`);
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

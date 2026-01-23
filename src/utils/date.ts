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

/**
 * YYYY-MM-DD 문자열을 로컬 타임존의 00:00:00 Date 객체로 변환합니다.
 * new Date("YYYY-MM-DD")는 UTC 00:00으로 파싱되어 타임존에 따라 전날/다음날로 밀릴 위험이 있습니다.
 * 이 함수는 브라우저의 로컬 날짜로 정확히 매핑합니다.
 */
export const parseSafeDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    // YYYY-MM-DD 형식이라고 가정
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 월은 0-indexed
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
    }
    return new Date(dateStr); // Fallback
};

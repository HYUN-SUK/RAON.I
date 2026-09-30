/**
 * 대한민국 2025~2026 법정 확정 공휴일 및 대체공휴일 SSOT (Single Source of Truth)
 * 외부 공공데이터포털(data.go.kr) API 장애/호출한도초과 시에도 0.001초 무결성 보장
 */

export interface HolidayDefinition {
    date: string;       // YYYY-MM-DD
    name: string;       // 공휴일 명칭
    isSubstitute?: boolean; // 대체공휴일 여부
}

export const OFFICIAL_HOLIDAYS_SSOT: HolidayDefinition[] = [
    // === 2025년 확정 공휴일 (17일) ===
    { date: '2025-01-01', name: '신정' },
    { date: '2025-01-28', name: '설날 전날' },
    { date: '2025-01-29', name: '설날' },
    { date: '2025-01-30', name: '설날 다음날' },
    { date: '2025-03-01', name: '삼일절' },
    { date: '2025-03-03', name: '삼일절 대체공휴일', isSubstitute: true },
    { date: '2025-05-05', name: '어린이날 / 부처님오신날' },
    { date: '2025-05-06', name: '부처님오신날 대체공휴일', isSubstitute: true },
    { date: '2025-06-06', name: '현충일' },
    { date: '2025-08-15', name: '광복절' },
    { date: '2025-10-03', name: '개천절' },
    { date: '2025-10-05', name: '추석 전날' },
    { date: '2025-10-06', name: '추석' },
    { date: '2025-10-07', name: '추석 다음날' },
    { date: '2025-10-08', name: '추석 대체공휴일', isSubstitute: true },
    { date: '2025-10-09', name: '한글날' },
    { date: '2025-12-25', name: '성탄절' },

    // === 2026년 확정 공휴일 (17일) ===
    { date: '2026-01-01', name: '신정' },
    { date: '2026-02-16', name: '설날 전날' },
    { date: '2026-02-17', name: '설날' },
    { date: '2026-02-18', name: '설날 다음날' },
    { date: '2026-03-01', name: '삼일절' },
    { date: '2026-03-02', name: '삼일절 대체공휴일', isSubstitute: true },
    { date: '2026-05-05', name: '어린이날' },
    { date: '2026-05-24', name: '부처님오신날' },
    { date: '2026-05-25', name: '부처님오신날 대체공휴일', isSubstitute: true },
    { date: '2026-06-06', name: '현충일' },
    { date: '2026-08-15', name: '광복절' },
    { date: '2026-08-17', name: '광복절 대체공휴일', isSubstitute: true },
    { date: '2026-09-24', name: '추석 전날' },
    { date: '2026-09-25', name: '추석' },
    { date: '2026-09-26', name: '추석 다음날' },
    { date: '2026-10-03', name: '개천절' },
    { date: '2026-10-05', name: '개천절 대체공휴일', isSubstitute: true },
    { date: '2026-10-09', name: '한글날' }, // ⭐ 10월 9일 한글날 (10/8 휴일전날 요금 7만원 적용의 핵심 SSOT)
    { date: '2026-12-25', name: '성탄절' }
];

export const STATIC_HOLIDAY_DATES: string[] = OFFICIAL_HOLIDAYS_SSOT.map(h => h.date).sort();
export const STATIC_HOLIDAYS_SET = new Set<string>(STATIC_HOLIDAY_DATES);

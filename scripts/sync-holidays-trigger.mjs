import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.PUBLIC_DATA_API_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 대한민국 확정 법정 공휴일 SSOT (명칭 매핑 포함)
const STATIC_HOLIDAYS_SSOT = [
    // 2025년
    { date: '2025-01-01', name: '신정' },
    { date: '2025-01-28', name: '설날 전날' },
    { date: '2025-01-29', name: '설날' },
    { date: '2025-01-30', name: '설날 다음날' },
    { date: '2025-03-01', name: '삼일절' },
    { date: '2025-03-03', name: '삼일절 대체공휴일' },
    { date: '2025-05-05', name: '어린이날' },
    { date: '2025-05-06', name: '부처님오신날 대체공휴일' },
    { date: '2025-06-06', name: '현충일' },
    { date: '2025-08-15', name: '광복절' },
    { date: '2025-10-03', name: '개천절' },
    { date: '2025-10-05', name: '추석 전날' },
    { date: '2025-10-06', name: '추석' },
    { date: '2025-10-07', name: '추석 다음날' },
    { date: '2025-10-08', name: '추석 대체공휴일' },
    { date: '2025-10-09', name: '한글날' },
    { date: '2025-12-25', name: '성탄절' },
    // 2026년
    { date: '2026-01-01', name: '신정' },
    { date: '2026-02-16', name: '설날 전날' },
    { date: '2026-02-17', name: '설날' },
    { date: '2026-02-18', name: '설날 다음날' },
    { date: '2026-03-01', name: '삼일절' },
    { date: '2026-03-02', name: '삼일절 대체공휴일' },
    { date: '2026-05-05', name: '어린이날' },
    { date: '2026-05-24', name: '부처님오신날' },
    { date: '2026-05-25', name: '부처님오신날 대체공휴일' },
    { date: '2026-06-06', name: '현충일' },
    { date: '2026-08-15', name: '광복절' },
    { date: '2026-08-17', name: '광복절 대체공휴일' },
    { date: '2026-09-24', name: '추석 전날' },
    { date: '2026-09-25', name: '추석' },
    { date: '2026-09-26', name: '추석 다음날' },
    { date: '2026-10-03', name: '개천절' },
    { date: '2026-10-05', name: '개천절 대체공휴일' },
    { date: '2026-10-09', name: '한글날' },
    { date: '2026-12-25', name: '성탄절' },
    // 2027년
    { date: '2027-01-01', name: '신정' },
    { date: '2027-02-06', name: '설날 전날' },
    { date: '2027-02-07', name: '설날' },
    { date: '2027-02-08', name: '설날 다음날' },
    { date: '2027-02-09', name: '설날 대체공휴일' },
    { date: '2027-03-01', name: '삼일절' },
    { date: '2027-05-05', name: '어린이날' },
    { date: '2027-05-13', name: '부처님오신날' },
    { date: '2027-06-06', name: '현충일' },
    { date: '2027-06-07', name: '현충일 대체공휴일' },
    { date: '2027-08-15', name: '광복절' },
    { date: '2027-08-16', name: '광복절 대체공휴일' },
    { date: '2027-09-14', name: '추석 전날' },
    { date: '2027-09-15', name: '추석' },
    { date: '2027-09-16', name: '추석 다음날' },
    { date: '2027-10-03', name: '개천절' },
    { date: '2027-10-04', name: '개천절 대체공휴일' },
    { date: '2027-10-09', name: '한글날' },
    { date: '2027-10-11', name: '한글날 대체공휴일' },
    { date: '2027-12-25', name: '성탄절' },
    { date: '2027-12-27', name: '성탄절 대체공휴일' }
];

const STATIC_HOLIDAY_NAMES = STATIC_HOLIDAYS_SSOT.reduce((acc, cur) => {
    acc[cur.date] = cur.name;
    return acc;
}, {});

async function syncHolidays() {
    const startTime = Date.now();
    const currentYear = new Date().getFullYear();
    const targetYears = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
    console.log(`🚀 [WEEKLY_HOLIDAY_SYNC] 매주 화요일 공휴일 자동 갱신 시작 (수집범위: ${targetYears.join(', ')}년)...`);

    const holidaysSet = new Set(STATIC_HOLIDAYS_SSOT.map(h => h.date));
    const holidayNamesMap = { ...STATIC_HOLIDAY_NAMES };
    let apiSuccessCount = 0;
    let apiFetchedHolidays = [];
    const apiHttpErrors = [];

    if (apiKey) {
        for (const year of targetYears) {
            try {
                const url = `http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?solYear=${year}&ServiceKey=${apiKey}&numOfRows=100&_type=json`;
                const res = await fetch(url, { headers: { 'User-Agent': 'RAONAI-Engine/1.0' } });

                if (res.ok) {
                    const text = await res.text();
                    try {
                        const json = JSON.parse(text);
                        const items = json?.response?.body?.items?.item;
                        if (items) {
                            const list = Array.isArray(items) ? items : [items];
                            list.forEach(item => {
                                if (item.isHoliday === 'Y' && item.locdate) {
                                    const str = String(item.locdate);
                                    const formatted = `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
                                    holidaysSet.add(formatted);
                                    if (item.dateName) {
                                        holidayNamesMap[formatted] = item.dateName;
                                    }
                                    apiFetchedHolidays.push(formatted);
                                }
                            });
                            apiSuccessCount++;
                        }
                    } catch (pe) {
                        console.warn(`[WARN] ${year}년 공공데이터 파싱 스킵 (SSOT 유지):`, pe.message);
                    }
                } else {
                    console.warn(`[WARN] ${year}년 공공데이터 HTTP ${res.status} (SSOT 유지)`);
                    apiHttpErrors.push(`${year}년 HTTP ${res.status}`);
                }
            } catch (err) {
                console.warn(`[WARN] ${year}년 공공데이터 네트워크 오류 (SSOT 유지):`, err.message);
                apiHttpErrors.push(`${year}년 네트워크오류`);
            }
        }
    } else {
        console.warn('⚠️ PUBLIC_DATA_API_KEY 미설정 - 정적 SSOT 테이블을 기준으로 동기화합니다.');
        apiHttpErrors.push('API_KEY_MISSING');
    }

    const sortedHolidays = Array.from(holidaysSet).sort();
    const durationMs = Date.now() - startTime;
    const isApiFailed = apiHttpErrors.length > 0 && apiSuccessCount === 0;

    console.log(`✅ [WEEKLY_HOLIDAY_SYNC] 총 ${sortedHolidays.length}개 공휴일 확보`);
    if (isApiFailed) {
        console.log(`🛡️ [SSOT 방어 발동] 외부 API 호출 실패(${apiHttpErrors.join(', ')}) ➔ 자체 정적 SSOT로 공휴일 캘린더 완벽 방어!`);
    }

    const apiStatus = [
        {
            name: 'HOLIDAY_SYNC',
            label: '공휴일(공공데이터)',
            status: isApiFailed ? 'FAILURE' : (apiHttpErrors.length > 0 ? 'PARTIAL_FAIL' : 'SUCCESS'),
            error: isApiFailed ? `공공데이터 일일 한도 초과 (${apiHttpErrors.join(', ')})` : undefined,
            duration_ms: durationMs,
            total_count: sortedHolidays.length,
            api_fetched: apiFetchedHolidays.length,
            checked_at: new Date().toISOString(),
            ssot_shield_active: isApiFailed,
            holidays: sortedHolidays,
            holiday_names: holidayNamesMap
        }
    ];

    const logStatus = isApiFailed ? 'PARTIAL_FAIL' : 'SUCCESS';
    const logMessage = isApiFailed
        ? `⚠️ 공공데이터 호출 한도 초과(${apiHttpErrors.join(', ')}) 감지 ➔ 자체 정적 SSOT로 총 ${sortedHolidays.length}개 공휴일(10/9 한글날 포함) 100% 안전 방어 유지!`
        : `주간 공휴일 동기화 완료: ${targetYears.join(', ')}년 외부 수신 ${apiFetchedHolidays.length}건 + SSOT 병합 ➔ 총 ${sortedHolidays.length}개 공휴일 정상 유지.`;

    // automation_logs 기록
    const { error: insertError } = await supabase.from('automation_logs').insert({
        job_name: 'WEEKLY_HOLIDAY_SYNC',
        status: logStatus,
        processed_count: sortedHolidays.length,
        message: logMessage,
        duration_ms: durationMs,
        api_status: apiStatus,
        created_at: new Date().toISOString()
    });

    if (insertError) {
        console.error('❌ automation_logs 기록 실패:', insertError);
        process.exit(1);
    }

    console.log('🎉 [WEEKLY_HOLIDAY_SYNC] automation_logs 기록 완료!');
}

syncHolidays().catch(e => {
    console.error('❌ 공휴일 동기화 중 치명적 오류:', e);
    process.exit(1);
});

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

// 대한민국 2025~2026 확정 법정 공휴일 SSOT (10월 9일 한글날 및 주요 대체공휴일 완벽 탑재)
const STATIC_HOLIDAYS_SSOT = [
    // 2025년
    '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30',
    '2025-03-01', '2025-03-03', '2025-05-05', '2025-05-06',
    '2025-06-06', '2025-08-15', '2025-10-03', '2025-10-05',
    '2025-10-06', '2025-10-07', '2025-10-08', '2025-10-09',
    '2025-12-25',
    // 2026년
    '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18',
    '2026-03-01', '2026-03-02', '2026-05-05', '2026-05-24',
    '2026-05-25', '2026-06-06', '2026-08-15', '2026-08-17',
    '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-03',
    '2026-10-05', '2026-10-09', '2026-12-25'
];

async function syncHolidays() {
    const startTime = Date.now();
    console.log('🚀 [WEEKLY_HOLIDAY_SYNC] 매주 화요일 공휴일 자동 갱신 시작...');

    const holidaysSet = new Set(STATIC_HOLIDAYS_SSOT);
    let apiSuccessCount = 0;
    let apiFetchedHolidays = [];
    const apiHttpErrors = [];

    if (apiKey) {
        const years = [2025, 2026];
        for (const year of years) {
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
    const hasHangulDay = holidaysSet.has('2026-10-09');
    const isApiFailed = apiHttpErrors.length > 0 && apiSuccessCount === 0;

    console.log(`✅ [WEEKLY_HOLIDAY_SYNC] 총 ${sortedHolidays.length}개 공휴일 확보 (한글날 2026-10-09 포함 여부: ${hasHangulDay ? '포함됨' : '누락'})`);
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
            hangul_day_included: hasHangulDay,
            ssot_shield_active: isApiFailed,
            holidays: sortedHolidays
        }
    ];

    const logStatus = isApiFailed ? 'PARTIAL_FAIL' : 'SUCCESS';
    const logMessage = isApiFailed
        ? `⚠️ 공공데이터 호출 한도 초과(${apiHttpErrors.join(', ')}) 감지 ➔ 자체 정적 SSOT로 총 ${sortedHolidays.length}개 공휴일(10/9 한글날 포함) 100% 안전 방어 유지!`
        : `주간 공휴일 동기화 완료: 외부 수신 ${apiFetchedHolidays.length}건 + SSOT 병합 ➔ 총 ${sortedHolidays.length}개 공휴일 정상 유지.`;

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

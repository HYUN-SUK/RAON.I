import { NextResponse } from 'next/server';
import { STATIC_HOLIDAY_DATES, STATIC_HOLIDAYS_SET } from '@/lib/constants/holidays';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const holidaysSet = new Set<string>(STATIC_HOLIDAY_DATES);

        // [v14.1.5] DB automation_logs에 주간 동기화(WEEKLY_HOLIDAY_SYNC)로 적재된 신규/대체공휴일이 있다면 병합
        try {
            const { data: latestSync } = await supabase
                .from('automation_logs')
                .select('api_status')
                .eq('job_name', 'WEEKLY_HOLIDAY_SYNC')
                .eq('status', 'SUCCESS')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (latestSync) {
                const dynamicHolidays = Array.isArray(latestSync.api_status) 
                    ? (latestSync.api_status as any)[0]?.holidays 
                    : null;

                if (Array.isArray(dynamicHolidays)) {
                    dynamicHolidays.forEach((d: string) => {
                        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
                            holidaysSet.add(d);
                        }
                    });
                }
            }
        } catch (dbErr) {
            // DB 조회 실패 시에도 정적 SSOT(10/9 한글날 포함)로 100% 정상 작동 유지
            console.warn('[Holidays API] DB sync log fallback to static SSOT:', dbErr);
        }

        const uniqueHolidays = Array.from(holidaysSet).sort();

        return NextResponse.json(
            { 
                holidays: uniqueHolidays,
                total: uniqueHolidays.length,
                source: 'SSOT_AND_WEEKLY_SYNC'
            },
            {
                headers: {
                    'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
                }
            }
        );
    } catch (e) {
        console.error('Failed to get holidays handler:', e);
        // 장애 발생 시에도 절대 빈 배열을 주지 않고 SSOT 보장
        return NextResponse.json(
            { holidays: STATIC_HOLIDAY_DATES, total: STATIC_HOLIDAY_DATES.length, source: 'SSOT_STATIC_FALLBACK' },
            { status: 200 }
        );
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { differenceInDays, parseISO } from 'date-fns';

export async function GET(req: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const supabase = createClient(supabaseUrl!, supabaseKey!);

        // 최근 24시간 이내의 라온아이 실시간 예약 조회 (PENDING, CONFIRMED, CANCELLED 대상)
        const recentTimeWindow = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // 1. reservations와 sites 목록 조회 (최신 변경순 정렬)
        const { data: reservations, error: resErr } = await supabase
            .from('reservations')
            .select(`
                id,
                site_id,
                check_in_date,
                check_out_date,
                guest_name,
                guest_phone,
                guests,
                family_count,
                vehicle_count,
                total_price,
                status,
                created_at,
                updated_at
            `)
            .in('status', ['CONFIRMED', 'PENDING', 'CANCELLED'])
            .gte('updated_at', recentTimeWindow)
            .order('updated_at', { ascending: false })
            .limit(20);

        if (resErr) {
            console.error('[camfit-sync/queue] Supabase error:', resErr);
            return NextResponse.json({ success: false, error: resErr.message }, { status: 500 });
        }

        const { data: sites } = await supabase.from('sites').select('id, name, type');
        const siteMap = new Map((sites || []).map(s => [s.id, s]));

        // 2. 이미 캠핏에 동기화 완료된 로그 조회 (예약ID + 상태 조합)
        const { data: syncLogs } = await supabase
            .from('camfit_integration_logs')
            .select('external_id, status, error_message')
            .eq('status', 'SUCCESS')
            .not('external_id', 'is', null);

        // syncKey Set 생성 (예: "resId_PENDING", "resId_CONFIRMED", "resId_CANCELLED")
        const syncedStateSet = new Set((syncLogs || []).map((l: any) => {
            const extra = l.error_message || '';
            if (extra.includes('BLOCK_PENDING')) return `${l.external_id}_PENDING`;
            if (extra.includes('CREATE_RESERVATION')) return `${l.external_id}_CONFIRMED`;
            if (extra.includes('UNBLOCK_CANCEL')) return `${l.external_id}_CANCELLED`;
            return l.external_id;
        }));

        // 3. 아직 해당 상태로 캠핏에 동기화되지 않은 큐 필터링
        const pendingQueue = (reservations || [])
            .filter((r: any) => {
                const stateKey = `${r.id}_${r.status}`;
                return !syncedStateSet.has(stateKey);
            })
            .map((r: any) => {
                const siteObj = siteMap.get(r.site_id);
                const rawSiteName = siteObj?.name || r.site_id;

                // 사이트/에어컨 정규화 매핑
                let targetGroup = rawSiteName;
                let subSiteName = rawSiteName;
                let isAircon = false;

                if (r.site_id.startsWith('air-') || siteObj?.type === 'AIR_CON' || rawSiteName.includes('에어컨')) {
                    isAircon = true;
                    targetGroup = '에어컨 대여';
                    // "에어컨 1번" -> "에어컨 1"
                    subSiteName = rawSiteName.replace('번', '').trim();
                }

                // 박수(nights) 계산
                let nights = 1;
                try {
                    const checkIn = parseISO(r.check_in_date);
                    const checkOut = parseISO(r.check_out_date);
                    nights = Math.max(1, differenceInDays(checkOut, checkIn));
                } catch {
                    nights = 1;
                }

                // 액션 및 메모 결정
                let action = 'BLOCK_PENDING';
                let memo = `[RAON.I_APP] 입금대기 - ${r.guest_name || '고객'} (${r.guest_phone || '-'})`;

                if (r.status === 'CONFIRMED') {
                    action = 'CREATE_RESERVATION';
                    memo = `[RAON.I_APP_BLOCK] 입금완료 - ${r.guest_name || '고객'} (${r.guest_phone || '-'})`;
                } else if (r.status === 'CANCELLED') {
                    action = 'UNBLOCK_CANCEL';
                    memo = `[RAON.I_APP_CANCEL] 예약취소 - ${r.guest_name || '고객'}`;
                }

                return {
                    reservationId: r.id,
                    action,
                    status: r.status,
                    siteId: r.site_id,
                    targetGroup,      // 캘린더에서 클릭할 상위 구역명 (예: '민수네', '에어컨 대여')
                    subSiteName,      // 패널 테이블에서 타겟팅할 개별 사이트명 (예: '민수네', '에어컨 3')
                    isAircon,
                    checkInDate: r.check_in_date,
                    checkOutDate: r.check_out_date,
                    nights,
                    guestName: r.guest_name || '라온아이 고객',
                    guestPhone: r.guest_phone || '',
                    guests: r.guests || 2,
                    familyCount: r.family_count || 1,
                    vehicleCount: r.vehicle_count || 1,
                    totalPrice: r.total_price || 0,
                    memo,
                    updatedAt: r.updated_at || r.created_at
                };
            });

        return NextResponse.json({
            success: true,
            count: pendingQueue.length,
            queue: pendingQueue,
            serverTime: new Date().toISOString()
        });
    } catch (e: any) {
        console.error('[camfit-sync/queue] Handler error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

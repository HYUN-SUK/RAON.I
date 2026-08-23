import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const supabase = createClient(supabaseUrl!, supabaseKey!);

        // 최근 7일 이내의 라온아이 예약 조회 (CANCELLED 제외, PENDING / CONFIRMED 대상)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data: reservations, error } = await supabase
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
                status,
                created_at,
                updated_at,
                sites ( id, name )
            `)
            .in('status', ['CONFIRMED', 'PENDING'])
            .gte('created_at', sevenDaysAgo)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[camfit-sync/queue] Supabase error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // 이미 캠핏에 동기화 완료된 예약 ID 조회
        const { data: syncLogs } = await supabase
            .from('camfit_integration_logs')
            .select('external_id')
            .eq('status', 'SUCCESS')
            .not('external_id', 'is', null);

        const syncedIds = new Set((syncLogs || []).map((l: any) => l.external_id));

        // 아직 캠핏에 동기화되지 않은 대기 큐 필터링
        const pendingQueue = (reservations || [])
            .filter((r: any) => !syncedIds.has(r.id))
            .map((r: any) => {
                const siteObj = Array.isArray(r.sites) ? r.sites[0] : r.sites;
                const siteName = siteObj?.name || r.site_id;

                return {
                    reservationId: r.id,
                    action: 'BLOCK',
                    siteId: r.site_id,
                    siteName: siteName,
                    checkInDate: r.check_in_date,
                    checkOutDate: r.check_out_date,
                    guestName: r.guest_name || '라온아이 고객',
                    guestPhone: r.guest_phone || '',
                    guests: r.guests || 2,
                    familyCount: r.family_count || 1,
                    vehicleCount: r.vehicle_count || 1,
                    status: r.status,
                    memo: `[라온아이 앱 예약] ${r.guest_name || '고객'} (${r.guest_phone || '-'}) ${r.family_count || 1}가족`,
                    createdAt: r.created_at
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

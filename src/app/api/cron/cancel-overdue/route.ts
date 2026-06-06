import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { updateReservationStatusAction } from '@/actions/reservation';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        // 1. Authorization Header 보안 검증
        const authHeader = request.headers.get('Authorization');
        const expectedHeader = `Bearer ${process.env.CRON_SECRET}`;
        
        if (!process.env.CRON_SECRET) {
            console.error('[Cron/CancelOverdue] CRON_SECRET env variable is not defined.');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        if (!authHeader || authHeader !== expectedHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createAdminClient();
        
        // 2. status가 PENDING인 모든 예약 조회
        const { data: pendingReservations, error: fetchError } = await supabase
            .from('reservations')
            .select('*')
            .eq('status', 'PENDING');

        if (fetchError) {
            console.error('[Cron/CancelOverdue] Fetch reservations error:', fetchError);
            return NextResponse.json({ error: 'Failed to fetch reservations', details: fetchError.message }, { status: 500 });
        }

        if (!pendingReservations || pendingReservations.length === 0) {
            return NextResponse.json({ message: 'No pending reservations found', cancelledCount: 0 });
        }

        // 3. 입금 마감 시간 연산 (DB 설정값 연동)
        let deadlineHours = 6;
        try {
            const { data: config } = await supabase
                .from('site_config')
                .select('deposit_deadline_hours')
                .eq('id', 1)
                .single() as any;
            if (config?.deposit_deadline_hours) {
                deadlineHours = config.deposit_deadline_hours;
            }
        } catch (configErr) {
            console.warn('[Cron/CancelOverdue] Failed to fetch deposit_deadline_hours from DB. Using default 6h.', configErr);
        }

        const now = new Date();
        const overdueIds: string[] = [];

        (pendingReservations as any[] || []).forEach((r: any) => {
            if (!r.created_at) return;

            const createdAt = new Date(r.created_at);
            const deadline = new Date(createdAt.getTime() + deadlineHours * 60 * 60 * 1000);

            // 아직 데드라인이 경과하지 않았으면 패스
            if (now < deadline) return;

            // 데드라인 경과 시 영업 시간 기준 유예 기간(Grace Period) 계산
            const graceTime = new Date(deadline);
            const hour = graceTime.getHours();

            if (hour < 9) {
                graceTime.setHours(9, 0, 0, 0);
            } else if (hour < 18) {
                graceTime.setHours(18, 0, 0, 0);
            } else {
                graceTime.setDate(graceTime.getDate() + 1);
                graceTime.setHours(9, 0, 0, 0);
            }

            if (now > graceTime) {
                overdueIds.push(r.id);
            }
        });

        if (overdueIds.length === 0) {
            return NextResponse.json({ message: 'No overdue reservations to cancel', cancelledCount: 0 });
        }

        console.log(`[Cron/CancelOverdue] Found ${overdueIds.length} overdue reservations to cancel:`, overdueIds);

        // 4. 개별 예약을 CANCELLED로 변경하고 알림 발송 (기존 Server Action 재활용)
        const results = await Promise.all(
            overdueIds.map(async (id) => {
                try {
                    const res = await updateReservationStatusAction(id, 'CANCELLED', '입금 기한(6시간) 경과로 인한 자동 취소');
                    return { id, success: res.success, error: res.error || null };
                } catch (err: any) {
                    console.error(`[Cron/CancelOverdue] Failed to cancel reservation ${id}:`, err);
                    return { id, success: false, error: err.message || 'Error occurred during cancellation' };
                }
            })
        );

        const successCount = results.filter(r => r.success).length;

        return NextResponse.json({
            message: `Processed overdue reservations`,
            totalFound: overdueIds.length,
            cancelledCount: successCount,
            results
        });

    } catch (e: any) {
        console.error('[Cron/CancelOverdue] Internal Server Error:', e);
        return NextResponse.json({ error: 'Internal Server Error', details: e.message }, { status: 500 });
    }
}

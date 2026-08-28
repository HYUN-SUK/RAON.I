import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { reservationId, action, siteName, checkInDate, checkOutDate, guestName, status, errorMessage } = body;

        if (!reservationId) {
            return NextResponse.json({ success: false, error: 'reservationId is required' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const supabase = createClient(supabaseUrl!, supabaseKey!);

        // 캠핏 연동 로그 적재 (액션별 명시)
        const actionLabel = action === 'CREATE_RESERVATION' ? '예약생성(초록)' : (action === 'UNBLOCK_CANCEL' ? '차단해제(취소)' : '입금대기차단(빨강)');
        const logMessage = `[라온아이 ➔ 캠핏 ${actionLabel}] ${siteName} (${checkInDate} ~ ${checkOutDate}) 예약자: ${guestName}`;

        const finalErrorMessage = errorMessage || `[${action || 'BLOCK_PENDING'}] 크롬 확장프로그램 자동 처리 완료`;

        const { error } = await supabase.from('camfit_integration_logs').insert({
            external_id: reservationId,
            message_raw: logMessage,
            status: status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
            error_message: finalErrorMessage,
            created_at: new Date().toISOString()
        });

        if (error) {
            console.error('[camfit-sync/ack] Supabase log insert error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            reservationId,
            status: status === 'SUCCESS' ? 'ACK_RECORDED' : 'FAILED_RECORDED',
            recordedAt: new Date().toISOString()
        });
    } catch (e: any) {
        console.error('[camfit-sync/ack] Handler error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

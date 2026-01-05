import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// 운영 액션 타입
type OperationAction =
    | 'MAINTENANCE_ON'
    | 'MAINTENANCE_OFF'
    | 'RESERVATION_STOP'
    | 'RESERVATION_START'
    | 'TODAY_CLOSE'
    | 'CLEAR_CACHE'
    | 'CLEAR_NOTIFICATIONS';

// GET: 시스템 상태 조회
export async function GET() {
    try {
        const supabase = await createClient();

        // 시스템 설정 조회
        const { data: config, error: configError } = await supabase
            .from('system_config')
            .select('*')
            .eq('id', 1)
            .single();

        if (configError && configError.code !== 'PGRST116') {
            console.error('[Operations] Config fetch error:', configError);
        }

        // 최근 조치 이력 5건
        const { data: logs, error: logsError } = await supabase
            .from('operation_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (logsError) {
            console.error('[Operations] Logs fetch error:', logsError);
        }

        // 통계: 알림 큐 대기 건수
        const { count: pendingNotifications } = await supabase
            .from('push_notification_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        // 통계: 오늘 예약 건수
        const today = new Date().toISOString().split('T')[0];
        const { count: todayReservations } = await supabase
            .from('blocked_dates')
            .select('*', { count: 'exact', head: true })
            .gte('start_date', today)
            .lte('start_date', today);

        // 통계: 캐시 건수
        const { count: cacheCount } = await supabase
            .from('weather_cache')
            .select('*', { count: 'exact', head: true });

        return NextResponse.json({
            config: config || {
                maintenance_mode: false,
                reservation_enabled: true,
                notification_enabled: true,
                maintenance_message: '시스템 점검 중입니다.'
            },
            logs: logs || [],
            stats: {
                pendingNotifications: pendingNotifications || 0,
                todayReservations: todayReservations || 0,
                cacheCount: cacheCount || 0
            }
        });
    } catch (error) {
        console.error('[Operations] GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch system status' }, { status: 500 });
    }
}

// POST: 즉시 조치 실행
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { action, message } = await request.json() as { action: OperationAction; message?: string };

        // 현재 설정 조회
        const { data: currentConfig } = await supabase
            .from('system_config')
            .select('*')
            .eq('id', 1)
            .single();

        const previousState = currentConfig || {};
        let newState = { ...previousState };
        let description = '';

        switch (action) {
            case 'MAINTENANCE_ON':
                newState = {
                    ...newState,
                    maintenance_mode: true,
                    maintenance_message: message || '시스템 점검 중입니다. 잠시 후 다시 이용해 주세요.'
                };
                description = '유지보수 모드 활성화';
                break;

            case 'MAINTENANCE_OFF':
                newState = { ...newState, maintenance_mode: false };
                description = '유지보수 모드 비활성화';
                break;

            case 'RESERVATION_STOP':
                newState = { ...newState, reservation_enabled: false };
                description = '예약 기능 중단';
                break;

            case 'RESERVATION_START':
                newState = { ...newState, reservation_enabled: true };
                description = '예약 기능 재개';
                break;

            case 'TODAY_CLOSE':
                // 오늘 날짜로 예약 마감 처리 (별도 로직 필요시 확장)
                description = '오늘 예약 강제 마감';
                break;

            case 'CLEAR_CACHE':
                // weather_cache 테이블 비우기
                await supabase.from('weather_cache').delete().neq('id', -1);
                description = '캐시 전체 초기화';
                break;

            case 'CLEAR_NOTIFICATIONS':
                // 대기 중인 알림 취소
                await supabase
                    .from('push_notification_queue')
                    .update({ status: 'cancelled' })
                    .eq('status', 'pending');
                description = '대기 알림 전체 취소';
                break;

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }

        // 시스템 설정 업데이트 (설정 변경 액션인 경우)
        if (['MAINTENANCE_ON', 'MAINTENANCE_OFF', 'RESERVATION_STOP', 'RESERVATION_START'].includes(action)) {
            await supabase
                .from('system_config')
                .upsert({
                    id: 1,
                    ...newState,
                    updated_at: new Date().toISOString(),
                    updated_by: 'admin'
                });
        }

        // 로그 기록
        await supabase.from('operation_logs').insert({
            action,
            previous_state: previousState,
            new_state: newState,
            description,
            actor: 'admin'
        });

        return NextResponse.json({
            success: true,
            action,
            description,
            newState
        });
    } catch (error) {
        console.error('[Operations] POST error:', error);
        return NextResponse.json({ error: 'Failed to execute action' }, { status: 500 });
    }
}

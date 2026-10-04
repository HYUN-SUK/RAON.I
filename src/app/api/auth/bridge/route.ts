import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

/**
 * [POST] 앱에서 소셜 로그인 시작 전 티켓 및 PKCE code_verifier 사전 등록
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ticket, verifier } = body;

        if (!ticket || typeof ticket !== 'string' || ticket.length < 8) {
            return NextResponse.json({ success: false, error: "INVALID_TICKET" }, { status: 400 });
        }

        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const jobName = 'auth_bridge_' + ticket;

        // 기존 동일 티켓 잔여물이 있으면 정리 후 삽입
        await adminClient.from('automation_logs').delete().eq('job_name', jobName);

        await adminClient.from('automation_logs').insert({
            job_name: jobName,
            status: 'init',
            api_status: { verifier: verifier || null },
            created_at: new Date().toISOString()
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[AuthBridge POST] Error registering ticket:', err);
        return NextResponse.json({ success: false, error: "SERVER_ERROR" }, { status: 500 });
    }
}

/**
 * [GET] 앱이 화면 복귀 시 세션 또는 인가 코드를 수령 (Burn on Read)
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const ticket = searchParams.get("ticket");

    if (!ticket || ticket.length < 8) {
        return NextResponse.json({ success: false, error: "INVALID_TICKET" }, { status: 400 });
    }

    try {
        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const jobName = 'auth_bridge_' + ticket;

        // 1. 티켓 조회
        const { data, error } = await adminClient
            .from('automation_logs')
            .select('status, api_status, created_at')
            .eq('job_name', jobName)
            .maybeSingle();

        if (error || !data) {
            return NextResponse.json({ success: false, pending: true });
        }

        // 아직 외부 브라우저 인증 대기 중인 상태
        if (data.status === 'init') {
            return NextResponse.json({ success: false, pending: true });
        }

        // 2. 3분 초과 여부 확인 (만료 처리)
        const createdAt = new Date(data.created_at).getTime();
        if (Date.now() - createdAt > 3 * 60 * 1000) {
            await adminClient.from('automation_logs').delete().eq('job_name', jobName);
            return NextResponse.json({ success: false, expired: true }, { status: 410 });
        }

        const payload = data.api_status;

        // 3. 보안 핵심: 토큰 수령 즉시 DB에서 영구 삭제 (Burn on Read)
        await adminClient.from('automation_logs').delete().eq('job_name', jobName);

        // 4. 비동기 찌꺼기 청소: 5분 이상 지난 구버전 티켓 일괄 삭제
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        adminClient
            .from('automation_logs')
            .delete()
            .like('job_name', 'auth_bridge_%')
            .lt('created_at', fiveMinutesAgo)
            .then(() => {});

        return NextResponse.json({
            success: true,
            session: payload?.access_token ? payload : null,
            auth_code: payload?.auth_code || null
        });
    } catch (err: any) {
        console.error('[AuthBridge GET] Error retrieving ticket session:', err);
        return NextResponse.json({ success: false, error: "SERVER_ERROR" }, { status: 500 });
    }
}

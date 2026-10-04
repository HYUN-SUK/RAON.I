import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const next = requestUrl.searchParams.get("next") ?? "/";
    const ticket = requestUrl.searchParams.get("ticket");
    const source = requestUrl.searchParams.get("source");

    // 1. 프로덕션 환경 HTTPS 보장 및 원본 오리진 식별 (Vercel 리버스 프록시 대응)
    const isLocal = process.env.NODE_ENV === 'development';
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';

    let redirectOrigin: string;
    if (isLocal) {
        redirectOrigin = requestUrl.origin;
    } else if (forwardedHost) {
        redirectOrigin = `https://${forwardedHost}`;
    } else {
        redirectOrigin = requestUrl.origin.replace(/^http:/, 'https:');
    }

    const errorParam = requestUrl.searchParams.get("error");
    const errorDescription = requestUrl.searchParams.get("error_description");

    const redirectUrl = new URL(next, redirectOrigin);
    if (!isLocal && redirectUrl.protocol === 'http:') {
        redirectUrl.protocol = 'https:';
    }

    // [보완 1] 소셜 로그인 제공자(카카오 등)에서 에러를 반환한 경우 로그인 페이지로 안전 복귀
    if (errorParam) {
        console.error('[AuthCallback] Provider returned error:', errorParam, errorDescription);
        const loginUrl = new URL("/login", redirectOrigin);
        loginUrl.searchParams.set("error", "oauth_failed");
        if (errorDescription) loginUrl.searchParams.set("details", errorDescription);
        return NextResponse.redirect(loginUrl);
    }

    // [보완 2] 인가 코드(code)가 누락된 경우 게스트 홈으로 튕기지 않고 로그인 페이지로 안전 복귀
    if (!code) {
        console.warn('[AuthCallback] No authorization code found in callback URL');
        const loginUrl = new URL("/login", redirectOrigin);
        loginUrl.searchParams.set("error", "no_code");
        return NextResponse.redirect(loginUrl);
    }

    // =========================================================================
    // [핵심 분기] 스마트폰 네이티브 앱(v1.0.7)에서 호출된 소셜 로그인인 경우
    // 외부 브라우저(삼성 인터넷) 쿠키 격리로 인한 세션 교환 실패를 원천 차단하고
    // 앱이 사전 등록한 PKCE verifier와 조합하여 직통 교환 후 앱으로 자동 복귀
    // =========================================================================
    if (source === 'native_app' && ticket) {
        try {
            const adminClient = createAdminClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY!
            );

            const jobName = 'auth_bridge_' + ticket;

            // 1. 앱에서 사전에 등록해둔 티켓 데이터 조회
            const { data: ticketRow } = await adminClient
                .from('automation_logs')
                .select('api_status')
                .eq('job_name', jobName)
                .maybeSingle();

            const verifier = ticketRow?.api_status?.verifier;
            let sessionData: any = null;

            if (verifier) {
                // 2. Supabase 토큰 엔드포인트와 직통 PKCE 세션 교환
                try {
                    const tokenRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                        },
                        body: JSON.stringify({
                            auth_code: code,
                            code_verifier: verifier,
                        }),
                    });

                    if (tokenRes.ok) {
                        sessionData = await tokenRes.json();
                    } else {
                        const errBody = await tokenRes.text();
                        console.warn('[AuthCallback Native] Direct PKCE exchange response:', errBody);
                    }
                } catch (tokenErr) {
                    console.error('[AuthCallback Native] Direct PKCE exchange network error:', tokenErr);
                }
            }

            if (sessionData && sessionData.access_token) {
                const user = sessionData.user;
                if (user) {
                    // 탈퇴 30일 재가입 제한 점검
                    const email = user.email || null;
                    if (email) {
                        const { data: isEligible } = await adminClient.rpc('check_signup_eligibility', { p_email: email });
                        if (isEligible === false) {
                            await adminClient.from('automation_logs').delete().eq('job_name', jobName);
                            const loginUrl = new URL("/login", redirectOrigin);
                            loginUrl.searchParams.set("error", "withdrawn");
                            return NextResponse.redirect(loginUrl);
                        }
                    }

                    // 프로필 자동 생성
                    const { data: existingProfile } = await adminClient
                        .from('profiles')
                        .select('id')
                        .eq('id', user.id)
                        .maybeSingle();

                    if (!existingProfile) {
                        const nickname = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.nickname || (email ? email.split('@')[0] : 'Camper');
                        const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;

                        await adminClient.from('profiles').insert({
                            id: user.id,
                            email: email,
                            nickname: nickname,
                            avatar_url: avatarUrl,
                            role: 'user',
                            created_at: new Date().toISOString(),
                        });
                    }
                }

                // 티켓에 정식 세션 저장 (ready)
                await adminClient.from('automation_logs').delete().eq('job_name', jobName);
                await adminClient.from('automation_logs').insert({
                    job_name: jobName,
                    status: 'ready',
                    api_status: {
                        access_token: sessionData.access_token,
                        refresh_token: sessionData.refresh_token,
                        user_id: sessionData.user?.id
                    },
                    created_at: new Date().toISOString()
                });
            } else {
                // 직통 교환이 불가했던 경우, auth_code를 티켓에 실어 앱 클라이언트가 직접 교환하도록 안전망 제공
                await adminClient.from('automation_logs').delete().eq('job_name', jobName);
                await adminClient.from('automation_logs').insert({
                    job_name: jobName,
                    status: 'ready',
                    api_status: {
                        auth_code: code
                    },
                    created_at: new Date().toISOString()
                });
            }
        } catch (bridgeErr) {
            console.error('[AuthCallback Native] Bridge error:', bridgeErr);
        }

        // 라온아이 앱으로 자동 복귀시키는 응답 HTML
        const deepLink = `raoni://auth?ticket=${encodeURIComponent(ticket)}`;
        const intentLink = `intent://auth?ticket=${encodeURIComponent(ticket)}#Intent;scheme=raoni;package=kr.co.raoni.app;end`;

        const html = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>로그인 완료 - 라온아이</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Pretendard", Roboto, sans-serif; background: #0F1713; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; padding: 24px; box-sizing: border-box; }
        .card { background: #1B2620; border-radius: 28px; padding: 36px 24px; max-width: 360px; width: 100%; border: 1px solid #2B3A31; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); }
        .icon-box { width: 72px; height: 72px; margin: 0 auto 20px; background: rgba(34, 197, 94, 0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; border: 1px solid rgba(34, 197, 94, 0.3); }
        h2 { margin: 0 0 10px; font-size: 21px; font-weight: 800; color: #F1F5F9; letter-spacing: -0.02em; }
        p { margin: 0 0 28px; font-size: 14px; color: #94A3B8; line-height: 1.6; }
        .btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 16px; background: #22C55E; color: #0F1713; text-decoration: none; border-radius: 18px; font-weight: 800; font-size: 16px; box-sizing: border-box; transition: transform 0.1s ease; box-shadow: 0 10px 25px -5px rgba(34, 197, 94, 0.4); cursor: pointer; }
        .btn:active { transform: scale(0.98); }
        .hint { margin-top: 14px; font-size: 12px; color: #64748B; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-box">🏕️</div>
        <h2>로그인이 완료되었습니다!</h2>
        <p>라온아이 앱으로 자동 전환됩니다.<br>잠시만 기다려 주세요.</p>
        <a id="appBtn" class="btn" href="${deepLink}">
            라온아이 앱으로 돌아가기
        </a>
        <div class="hint">자동으로 열리지 않으면 위 버튼을 눌러주세요</div>
    </div>
    <script>
        setTimeout(() => {
            window.location.href = "${deepLink}";
        }, 150);
        setTimeout(() => {
            window.location.href = "${intentLink}";
        }, 500);
    </script>
</body>
</html>`;

        return new NextResponse(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
            }
        });
    }

    // =========================================================================
    // [표준 웹 로그인] PC 또는 모바일 일반 브라우저에서 진행된 표준 OAuth 플로우
    // =========================================================================
    const redirectResponse = NextResponse.redirect(redirectUrl);

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        redirectResponse.cookies.set(name, value, {
                            ...options,
                            path: '/',
                            sameSite: 'lax',
                            secure: !isLocal,
                        });
                    });
                },
            },
        }
    );

    const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
        console.error('[AuthCallback Web] Code exchange failed:', error.message);
        const loginUrl = new URL("/login", redirectOrigin);
        loginUrl.searchParams.set("error", "oauth_failed");
        return NextResponse.redirect(loginUrl);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single();

        if (!existingProfile) {
            const email = user.email || null;
            if (email) {
                const { data: isEligible, error: checkError } = await supabase.rpc('check_signup_eligibility', { p_email: email });
                if (!checkError && isEligible === false) {
                    await supabase.auth.signOut();
                    const loginUrl = new URL("/login", redirectOrigin);
                    loginUrl.searchParams.set("error", "withdrawn");
                    const logoutResponse = NextResponse.redirect(loginUrl);
                    
                    redirectResponse.cookies.getAll().forEach((c) => {
                        logoutResponse.cookies.set(c.name, c.value, c as any);
                    });
                    return logoutResponse;
                }
            }

            const nickname = user.user_metadata.full_name || user.user_metadata.name || user.user_metadata.nickname || (email ? email.split('@')[0] : 'Camper');
            const avatarUrl = user.user_metadata.avatar_url || user.user_metadata.picture;

            await supabase.from('profiles').insert({
                id: user.id,
                email: email,
                nickname: nickname,
                avatar_url: avatarUrl,
                role: 'user',
                created_at: new Date().toISOString(),
            });
        }
    }

    return redirectResponse;
}

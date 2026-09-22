import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const next = requestUrl.searchParams.get("next") ?? "/";

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

    const redirectUrl = new URL(next, redirectOrigin);
    if (!isLocal && redirectUrl.protocol === 'http:') {
        redirectUrl.protocol = 'https:';
    }

    // 2. 최종 리다이렉트 응답 객체 생성 (쿠키 주입 대상)
    const redirectResponse = NextResponse.redirect(redirectUrl);

    if (code) {
        // 3. @supabase/ssr v0.8.0 표준 getAll/setAll 쿠키 관리자 (청킹 및 Secure 보장)
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

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            console.error('[AuthCallback] Code exchange failed:', error.message);
            const loginUrl = new URL("/login", redirectOrigin);
            loginUrl.searchParams.set("error", "oauth_failed");
            return NextResponse.redirect(loginUrl);
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            // 프로필 존재 여부 확인
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
    }

    return redirectResponse;
}

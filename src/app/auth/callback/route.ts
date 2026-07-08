import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const next = requestUrl.searchParams.get("next") ?? "/";

    // 리다이렉트 응답 객체를 미리 생성
    const response = NextResponse.redirect(new URL(next, request.url));

    if (code) {
        // Route Handler 전용 Supabase 클라이언트 생성 (요청/응답 쿠키 바인딩)
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return request.cookies.get(name)?.value;
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        request.cookies.set({ name, value, ...options });
                        response.cookies.set({ name, value, ...options });
                    },
                    remove(name: string, options: CookieOptions) {
                        request.cookies.set({ name, value: '', ...options });
                        response.cookies.set({ name, value: '', ...options });
                    },
                },
            }
        );

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
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
                            // 탈퇴한 지 30일 이내의 회원이면 로그아웃 후 에러 리다이렉션
                            await supabase.auth.signOut();
                            const loginUrl = new URL("/login", request.url);
                            loginUrl.searchParams.set("error", "withdrawn");
                            const logoutResponse = NextResponse.redirect(loginUrl);
                            response.cookies.getAll().forEach((cookie) => {
                                logoutResponse.cookies.set(cookie);
                            });
                            return logoutResponse;
                        }
                    }

                    // 새 프로필 생성
                    const nickname =
                        user.user_metadata.full_name ||
                        user.user_metadata.name ||
                        user.user_metadata.nickname ||
                        (email ? email.split('@')[0] : 'Camper');

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
    }

    return response;
}

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const next = requestUrl.searchParams.get("next") ?? "/";

    // 쿠키 임시 수집을 위한 배열 선언 (Vercel 빌드 제약 우회)
    const cookiesToSet: { name: string; value: string; options?: CookieOptions }[] = [];

    if (code) {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return request.cookies.get(name)?.value;
                    },
                    set(name: string, value: string, options?: CookieOptions) {
                        request.cookies.set({ name, value, ...options });
                        cookiesToSet.push({ name, value, options });
                    },
                    remove(name: string, options?: CookieOptions) {
                        request.cookies.set({ name, value: '', ...options });
                        cookiesToSet.push({ name, value: '', options });
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
                            await supabase.auth.signOut();
                            const loginUrl = new URL("/login", request.url);
                            loginUrl.searchParams.set("error", "withdrawn");
                            const logoutResponse = NextResponse.redirect(loginUrl);
                            
                            // 임시 쿠키 동기화 후 반환 (Null Guard 적용)
                            cookiesToSet.forEach(({ name, value, options }) => {
                                logoutResponse.cookies.set({
                                    name,
                                    value,
                                    ...(options || {}),
                                } as any);
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
    }

    // 2. 최종 리다이렉트 응답 생성
    const redirectResponse = NextResponse.redirect(new URL(next, request.url));

    // 3. 임시 배열에 수집된 세션 쿠키들을 최종 리다이렉트 응답 객체에 복사 (유실 차단 및 Null Guard 적용)
    cookiesToSet.forEach(({ name, value, options }) => {
        redirectResponse.cookies.set({
            name,
            value,
            ...(options || {}),
        } as any);
    });

    return redirectResponse;
}

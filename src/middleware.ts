import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 0. 관리자 경로가 아닌 일반 사용자 요청은 Edge 인증 지연 없이 즉시 초고속 통과
    const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
    if (!isAdminRoute) {
        return NextResponse.next();
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // 1. 관리자 경로 전용 인증 세션 확인
    const { data: { user } } = await supabase.auth.getUser();

    // 2. Protect /api/admin backend routes (Require Admin Session or CRON_SECRET)
    if (pathname.startsWith('/api/admin')) {
        const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
        const isCron = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
        const isAdmin = user && (
            user.email === 'admin@raon.ai' ||
            user.app_metadata?.role === 'admin' ||
            user.user_metadata?.role === 'admin'
        );

        if (!isCron && !isAdmin) {
            return NextResponse.json(
                { error: '401 Unauthorized: 관리자 세션 또는 유효한 인증 토큰이 필요합니다.' },
                { status: 401 }
            );
        }
        return response;
    }

    // 3. Protect /admin frontend pages
    if (pathname.startsWith('/admin')) {
        // Exception: Login page is public
        if (pathname === '/admin/login') {
            // If already logged in, redirect to dashboard
            if (user && (user.email === 'admin@raon.ai' || user.user_metadata?.role === 'admin')) {
                return NextResponse.redirect(new URL('/admin', request.url));
            }
            return response;
        }

        // Checking if user is not logged in
        if (!user) {
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }

        // Strict Admin Check (Middleware Level)
        const isAdmin =
            user.email === 'admin@raon.ai' ||
            user.app_metadata?.role === 'admin' ||
            user.user_metadata?.role === 'admin';

        if (!isAdmin) {
            // Redirect to home if not admin
            return NextResponse.redirect(new URL('/', request.url));
        }
    }

    return response;
}

export const config = {
    matcher: [
        '/admin/:path*',
        '/api/admin/:path*',
    ],
};

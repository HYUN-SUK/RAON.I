import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
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
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    response = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    );

    // 1. Refresh Session
    const { data: { user } } = await supabase.auth.getUser();

    // 2. Protect /admin routes
    if (request.nextUrl.pathname.startsWith('/admin')) {
        // Exception: Login page is public
        if (request.nextUrl.pathname === '/admin/login') {
            // If already logged in, redirect to dashboard
            if (user) {
                // Optional: Check if admin? For now just redirect to dashboard.
                // Real admin check requires DB lookup which is expensive in middleware.
                // Usually we rely on RLS + Layout protection, or use Custom Claims.
                // For now, let them in, Layout will handle the rigorous check or just let them see empty page.
                return NextResponse.redirect(new URL('/admin', request.url));
            }
            return response;
        }

        // Checking if user is not logged in
        if (!user) {
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }

        // Ideally, we check 'is_admin' claim here.
        // However, Supabase session doesn't carry custom claims by default unless configured.
        // For MVP security, we rely on:
        // 1. Auth presence (Middleware)
        // 2. RLS (Database - already done)
        // 3. Layout check (Client-side - already done)
        // This triple layer is sufficient for now.
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};

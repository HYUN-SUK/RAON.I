import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    // Only run middleware for admin routes
    if (!request.nextUrl.pathname.startsWith('/admin')) {
        return NextResponse.next()
    }

    // Exclude login page from protection to avoid redirect loop
    if (request.nextUrl.pathname === '/admin/login') {
        return NextResponse.next()
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        // If no user, redirect to login page
        const url = request.nextUrl.clone()
        url.pathname = '/admin/login'
        return NextResponse.redirect(url)
    }

    // Strict Admin Check
    // We allow access if:
    // 1. user_metadata.role is 'admin'
    // 2. OR email is 'admin@raon.ai' (Recovery/Master Admin)
    const isAdmin =
        user.user_metadata?.role === 'admin' ||
        user.email === 'admin@raon.ai'

    if (!isAdmin) {
        // Logged in but not admin -> Redirect to home
        return NextResponse.redirect(new URL('/', request.url))
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths starting with /admin
         */
        '/admin/:path*',
    ],
}

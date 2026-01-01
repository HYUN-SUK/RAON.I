import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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
    const path = request.nextUrl.pathname

    // 1. Admin Route Protection
    if (path.startsWith('/admin')) {
        if (path === '/admin/login') {
            // If already logged in as admin, redirect to admin dashboard
            if (user && (user.user_metadata?.role === 'admin' || user.email === 'admin@raon.ai')) {
                return NextResponse.redirect(new URL('/admin', request.url))
            }
            return NextResponse.next()
        }

        if (error || !user) {
            const url = request.nextUrl.clone()
            url.pathname = '/admin/login'
            return NextResponse.redirect(url)
        }

        const isAdmin =
            user.user_metadata?.role === 'admin' ||
            user.email === 'admin@raon.ai' ||
            user.email === 'raon_tester_01@gmail.com'

        if (!isAdmin) {
            return NextResponse.redirect(new URL('/', request.url))
        }
    }

    // 2. User Protected Routes (/myspace, /reservation)
    // Note: /reservation main page might be public, but let's assumes booking flow needs auth. 
    // Handing over based on roadmap: Reservation 3.1 logic implies user context needed for smart re-book etc.
    // However, if we want public access to view dates, we should refine.
    // For now, based on "Protected Routes: myspace, reservation" instruction.
    else if (path.startsWith('/myspace') || path.startsWith('/reservation')) {
        if (error || !user) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            url.searchParams.set('next', path)
            return NextResponse.redirect(url)
        }
    }

    return response
}


export const config = {
    matcher: [
        /*
         * Match all request paths starting with /admin, /myspace, /reservation
         */
        '/admin/:path*',
        '/myspace/:path*',
        '/reservation/:path*',
    ],
}

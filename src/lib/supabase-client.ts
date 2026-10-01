import { createBrowserClient } from '@supabase/ssr'

function createClientInternal() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                lock: async (_name, _acquireTimeout, fn) => {
                    return await fn();
                },
            },
        }
    )
}

let browserClient: ReturnType<typeof createClientInternal> | null = null

export function createClient() {
    if (typeof window === 'undefined') {
        return createClientInternal()
    }

    if (!browserClient) {
        browserClient = createClientInternal()
    }

    return browserClient
}



import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint is called by GitHub Actions cron job
// It proxies the request to the Supabase Edge Function to avoid exposing Supabase secrets in GitHub Actions

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const runtime = 'edge'; // Switch to Edge Runtime to use waitUntil

export async function POST(request: NextRequest, context: any) {
    // 1. Verify cron secret for security (Same as mission-ranking)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 2. Get the mode from query params (prefetch or dispatch)
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode') || 'dispatch';

        console.log(`[Cron Proxy] Invoking camping-reminder Edge Function in ${mode} mode...`);

        // 3. Edge Runtime waitUntil: Tell Vercel to keep the worker alive until this promise finishes
        // This prevents the runtime from being frozen as soon as NextResponse is returned.
        const edgePromise = fetch(`${supabaseUrl}/functions/v1/camping-reminder?mode=${mode}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json'
            },
            // Prevent Next.js from aggressively caching this fetch request
            cache: 'no-store'
        }).catch(err => console.error(`[Cron Proxy - Background Error] Edge Function fetch failed:`, err));

        // Use standard wait until API provided by Next.js Edge Runtime
        context.waitUntil(edgePromise);

        // 4. Return success immediately
        return NextResponse.json({
            success: true,
            proxy_status: 'ok',
            message: `Edge Function background task dispatched and guaranteed by waitUntil (${mode} mode)`
        });

    } catch (error) {
        console.error('[Cron Proxy] Error:', error);
        return NextResponse.json({
            error: 'Internal server error in Cron Proxy',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// GET for manual trigger / health check
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        endpoint: 'Camping Reminder Cron Proxy',
        description: 'Call POST with ?mode=prefetch or ?mode=dispatch to invoke the Edge Function'
    });
}

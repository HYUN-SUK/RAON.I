import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint is called by GitHub Actions cron job
// It proxies the request to the Supabase Edge Function to avoid exposing Supabase secrets in GitHub Actions

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
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

        // 3. Call the Edge Function using the secure service role key
        const response = await fetch(`${supabaseUrl}/functions/v1/camping-reminder?mode=${mode}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json'
            },
            // Prevent Next.js from aggressively caching this fetch request
            cache: 'no-store'
        });

        const status = response.status;
        const bodyText = await response.text();

        console.log(`[Cron Proxy] Edge Function returned status: ${status}`);

        let jsonBody;
        try {
            jsonBody = JSON.parse(bodyText);
        } catch {
            jsonBody = { raw_response: bodyText };
        }

        if (!response.ok) {
            console.error(`[Cron Proxy] Edge Function failed:`, jsonBody);
            return NextResponse.json({
                error: 'Edge Function invocation failed',
                status,
                details: jsonBody
            }, { status: 500 });
        }

        // 4. Return success
        return NextResponse.json({
            success: true,
            proxy_status: 'ok',
            edge_function_status: status,
            result: jsonBody
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

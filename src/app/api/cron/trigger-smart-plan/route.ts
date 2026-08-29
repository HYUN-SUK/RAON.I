import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

export async function GET(request: Request) {
    return handleTrigger(request);
}

export async function POST(request: Request) {
    return handleTrigger(request);
}

async function handleTrigger(request: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const githubToken = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Database credentials missing' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. 당일 1회 완료(SUCCESS) 여부 확인 (Idempotency Guard)
        const kstNow = new Date(Date.now() + 9 * 3600000);
        const todayKstStr = kstNow.toISOString().split('T')[0];
        const kstStartOfDayUtc = new Date(`${todayKstStr}T00:00:00+09:00`).toISOString();

        const { data: todayLogs } = await supabase
            .from('automation_logs')
            .select('id, status, created_at')
            .eq('job_name', 'SMART_PLAN_CACHING')
            .eq('status', 'SUCCESS')
            .gte('created_at', kstStartOfDayUtc)
            .limit(1);

        if (todayLogs && todayLogs.length > 0) {
            return NextResponse.json({
                status: 'SKIPPED',
                message: `Today's (${todayKstStr}) Smart Plan caching is already completed successfully at ${todayLogs[0].created_at}.`
            }, { status: 200 });
        }

        // 2. GitHub Actions workflow_dispatch 트리거 발송
        const repoOwner = 'HYUN-SUK';
        const repoName = 'RAON.I';
        const workflowFile = 'smart-plan-sync-cron.yml';

        if (githubToken) {
            const dispatchRes = await fetch(
                `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/${workflowFile}/dispatches`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'Authorization': `Bearer ${githubToken}`,
                        'User-Agent': 'RAONAI-CronJob-Trigger'
                    },
                    body: JSON.stringify({ ref: 'main' })
                }
            );

            if (dispatchRes.ok || dispatchRes.status === 204) {
                return NextResponse.json({
                    status: 'DISPATCHED',
                    message: `GitHub Actions [${workflowFile}] triggered successfully.`
                }, { status: 200 });
            } else {
                const errText = await dispatchRes.text();
                console.warn(`[Trigger Warn] GitHub dispatch returned ${dispatchRes.status}: ${errText}`);
            }
        }

        return NextResponse.json({
            status: 'ACCEPTED',
            message: `Smart Plan Caching trigger received for ${todayKstStr}.`
        }, { status: 200 });

    } catch (err: any) {
        console.error('[Trigger Error]', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}

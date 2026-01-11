import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint is called by GitHub Actions cron job
// Every Sunday at 21:00 KST (12:00 UTC)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Find missions that have ended but not yet processed
        const now = new Date().toISOString();
        const { data: endedMissions, error: fetchError } = await supabase
            .from('missions')
            .select('id, title, community_post_id')
            .eq('is_active', true)
            .eq('ranking_processed', false)
            .lte('end_date', now);

        if (fetchError) {
            console.error('Failed to fetch missions:', fetchError);
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        if (!endedMissions || endedMissions.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No missions to process',
                processed: 0
            });
        }

        const results = [];

        // 2. Process each ended mission
        for (const mission of endedMissions) {
            // Call the RPC function to process ranking
            const { data: rankingResult, error: rpcError } = await supabase
                .rpc('process_mission_ranking', { p_mission_id: mission.id });

            if (rpcError) {
                console.error(`Failed to process mission ${mission.id}:`, rpcError);
                results.push({ mission_id: mission.id, success: false, error: rpcError.message });
                continue;
            }

            // 3. Post announcement comment on community post
            if (mission.community_post_id) {
                // Fetch top 3 for announcement
                const { data: top3 } = await supabase
                    .from('mission_rewards')
                    .select(`
                        rank,
                        xp_awarded,
                        token_awarded,
                        user_id,
                        profiles:user_id (nickname)
                    `)
                    .eq('mission_id', mission.id)
                    .order('rank', { ascending: true })
                    .limit(3);

                if (top3 && top3.length > 0) {
                    const medals = ['🥇', '🥈', '🥉'];
                    let announcement = '🎉 **이번 주 미션 Top 3 발표!** 🎉\n\n';

                    top3.forEach((winner, idx) => {
                        const nickname = (winner.profiles as { nickname?: string })?.nickname || '익명';
                        announcement += `${medals[idx]} ${idx + 1}위: **${nickname}** (+${winner.xp_awarded} XP, +${winner.token_awarded} Token)\n`;
                    });

                    announcement += '\n축하드립니다! 다음 주 미션도 기대해주세요! 🚀';

                    // Insert announcement as comment
                    await supabase.from('comments').insert({
                        post_id: mission.community_post_id,
                        content: announcement,
                        author_name: '라온아이 운영자',
                        author_id: null // System comment
                    });
                }
            }

            results.push({
                mission_id: mission.id,
                title: mission.title,
                success: true,
                result: rankingResult
            });
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            results
        });

    } catch (error) {
        console.error('Mission ranking cron error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// GET for manual trigger / health check
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        endpoint: 'Mission Ranking Cron',
        description: 'Call POST to process ended missions and award Top 3'
    });
}

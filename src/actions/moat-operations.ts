'use server';

import { createAdminClient } from '@/lib/supabase-admin';
import { assertAdmin } from '@/lib/auth-guard';
import { revalidatePath } from 'next/cache';

const DEFAULT_PARTNER_ID = 'a0000000-0000-0000-0000-000000000001';

export interface MoatMetricsData {
    navIntentCount: number;
    planSwapCount: number;
    viewedNoSwapCount: number;
    verificationCount: number;
    groundTruthCount: number;
    appliedCount: number;
    rescuedPlacesCount: number;
    deactivatedPlacesCount: number;
    recentVerifications: Array<{
        id: number;
        placeName: string;
        source: string;
        factStatus: string;
        reporterWeight: number;
        reviewState: string;
        verifiedAt: string;
    }>;
}

/**
 * 1. 실시간 해자 데이터 수집 지표 및 최근 피드 조회 (관리자 전용)
 */
export async function getMoatMetrics(): Promise<{ success: boolean; data?: MoatMetricsData; error?: string }> {
    try {
        await assertAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = createAdminClient() as any;

        // 1) nav_intent_log 총 건수
        const { count: navIntentCount } = await supabase
            .from('nav_intent_log')
            .select('*', { count: 'exact', head: true });

        // 2) plan_swap_log (SWAPPED vs VIEWED_NO_SWAP)
        const { count: planSwapCount } = await supabase
            .from('plan_swap_log')
            .select('*', { count: 'exact', head: true })
            .eq('event', 'SWAPPED');

        const { count: viewedNoSwapCount } = await supabase
            .from('plan_swap_log')
            .select('*', { count: 'exact', head: true })
            .eq('event', 'VIEWED_NO_SWAP');

        // 3) place_verifications 전체 및 Ground Truth (1.0)
        const { count: verificationCount } = await supabase
            .from('place_verifications')
            .select('*', { count: 'exact', head: true });

        const { count: groundTruthCount } = await supabase
            .from('place_verifications')
            .select('*', { count: 'exact', head: true })
            .eq('reporter_weight', 1.0);

        const { count: appliedCount } = await supabase
            .from('place_verifications')
            .select('*', { count: 'exact', head: true })
            .eq('review_state', 'APPLIED');

        // 4) place_history 기준 구제 및 폐업 집계
        const { count: rescuedPlacesCount } = await supabase
            .from('place_history')
            .select('*', { count: 'exact', head: true })
            .eq('event', 'STRIKE_RESET');

        const { count: deactivatedPlacesCount } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', false);

        // 5) 최근 10개 검증 피드 (외래키 조인 에러 없는 안전한 2-Step 매핑)
        const { data: recentList } = await supabase
            .from('place_verifications')
            .select('id, place_id, source, fact_status, liked, reporter_weight, review_state, verified_at')
            .order('verified_at', { ascending: false })
            .limit(10);

        const placeIds = (recentList || []).map((r: any) => r.place_id).filter(Boolean);
        const { data: placeRows } = placeIds.length > 0
            ? await supabase.from('master_places').select('id, name').in('id', placeIds)
            : { data: [] };

        const placeNameMap = new Map<string, string>();
        (placeRows || []).forEach((p: any) => placeNameMap.set(p.id, p.name));

        const recentVerifications = (recentList || []).map((r: any) => {
            return {
                id: r.id,
                placeName: placeNameMap.get(r.place_id) || '장소명 미상',
                source: r.source,
                factStatus: r.liked ? '좋았어요 (OK)' : (r.fact_status || '확인됨'),
                reporterWeight: r.reporter_weight || 0,
                reviewState: r.review_state,
                verifiedAt: r.verified_at ? r.verified_at.split('T')[0] : '',
            };
        });

        return {
            success: true,
            data: {
                navIntentCount: navIntentCount || 0,
                planSwapCount: planSwapCount || 0,
                viewedNoSwapCount: viewedNoSwapCount || 0,
                verificationCount: verificationCount || 0,
                groundTruthCount: groundTruthCount || 0,
                appliedCount: appliedCount || 0,
                rescuedPlacesCount: rescuedPlacesCount || 0,
                deactivatedPlacesCount: deactivatedPlacesCount || 0,
                recentVerifications,
            }
        };
    } catch (e: any) {
        console.error('getMoatMetrics error:', e);
        return { success: false, error: e.message };
    }
}

/**
 * 2. 자동 폐업/구제 루프 실행 (원클릭 및 Cron 연동)
 */
export async function runMoatAutomatedLoop(): Promise<{
    success: boolean;
    deactivatedCount: number;
    rescuedCount: number;
    message?: string;
    error?: string;
}> {
    try {
        await assertAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = createAdminClient() as any;
        let deactivatedCount = 0;
        let rescuedCount = 0;

        // [루프 1] 사용자 신고 누적 가중치(합산 >= 1.5) 매장 자동 비활성화
        const { data: pendingReports } = await supabase
            .from('place_verifications')
            .select('id, place_id, reporter_weight, fact_status')
            .in('fact_status', ['GONE', 'TEMP_CLOSED', 'NOT_FOUND'])
            .eq('review_state', 'PENDING');

        if (pendingReports && pendingReports.length > 0) {
            const placeWeightMap = new Map<string, { weight: number; ids: number[] }>();
            pendingReports.forEach((r: any) => {
                const current = placeWeightMap.get(r.place_id) || { weight: 0, ids: [] };
                current.weight += (r.reporter_weight || 0.3);
                current.ids.push(r.id);
                placeWeightMap.set(r.place_id, current);
            });

            for (const [placeId, info] of placeWeightMap.entries()) {
                if (info.weight >= 1.5) {
                    // 자동 비활성화
                    await supabase
                        .from('master_places')
                        .update({ is_active: false, updated_at: new Date().toISOString() })
                        .eq('id', placeId);

                    // place_history 기록
                    await supabase.from('place_history').insert({
                        place_id: placeId,
                        event: 'DEACTIVATED',
                        reason: `CUMULATIVE_USER_REPORTS_WEIGHT_${info.weight.toFixed(1)}`,
                        source: 'AUTO_LOOP',
                        created_at: new Date().toISOString()
                    });

                    // 검증 레코드 APPLIED 처리
                    await supabase
                        .from('place_verifications')
                        .update({ review_state: 'APPLIED', applied_at: new Date().toISOString() })
                        .in('id', info.ids);

                    deactivatedCount++;
                }
            }
        }

        // [루프 2] 스트라이크(miss_count >= 1) 매장 중 최근 실활동 확인 건 자동 구제
        const { data: strikePlaces } = await supabase
            .from('master_places')
            .select('id, name, miss_count')
            .gte('miss_count', 1);

        if (strikePlaces && strikePlaces.length > 0) {
            const strikePlaceIds = strikePlaces.map((p: any) => p.id);

            // 최근 30일 이내 길안내 실행 확인
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const { data: activeNavs } = await supabase
                .from('nav_intent_log')
                .select('place_id')
                .in('place_id', strikePlaceIds)
                .gte('launched_at', thirtyDaysAgo);

            // 최근 30일 이내 긍정 검증 확인
            const { data: activeVerifs } = await supabase
                .from('place_verifications')
                .select('place_id')
                .in('place_id', strikePlaceIds)
                .eq('visited', true)
                .gte('verified_at', thirtyDaysAgo);

            const activeSet = new Set<string>();
            (activeNavs || []).forEach((n: any) => activeSet.add(n.place_id));
            (activeVerifs || []).forEach((v: any) => activeSet.add(v.place_id));

            for (const placeId of activeSet) {
                await supabase
                    .from('master_places')
                    .update({ miss_count: 0, updated_at: new Date().toISOString() })
                    .eq('id', placeId);

                await supabase.from('place_history').insert({
                    place_id: placeId,
                    event: 'STRIKE_RESET',
                    reason: 'AUTOMATED_ACTIVITY_RESCUE',
                    source: 'AUTO_LOOP',
                    created_at: new Date().toISOString()
                });

                rescuedCount++;
            }
        }

        revalidatePath('/admin/moat');
        revalidatePath('/admin/operations');

        return {
            success: true,
            deactivatedCount,
            rescuedCount,
            message: `자동화 루프 완료: 폐업 매장 ${deactivatedCount}곳 자동 격리, 공공 누락 매장 ${rescuedCount}곳 자동 구제 완료!`
        };
    } catch (e: any) {
        console.error('runMoatAutomatedLoop error:', e);
        return { success: false, deactivatedCount: 0, rescuedCount: 0, error: e.message };
    }
}

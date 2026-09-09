'use server';

import { createAdminClient } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase-server';

/**
 * 1. 즉시 여행계획 생성 로깅 (Server Action)
 * - 비로그인(user_id: null) 및 로그인 유저 모두 안전 기록
 * - Non-blocking Fail-Safe 보장
 */
export async function logInstantPlanGenerateAction(params: {
    mode: 'nearby' | 'destination';
    targetName: string;
    lat?: number;
    lng?: number;
}): Promise<{ success: boolean; logId?: string }> {
    try {
        const supabase = createAdminClient() as any;
        
        // 유저 세션 확인 (선택적)
        let userId: string | null = null;
        try {
            const serverClient = await createClient();
            const { data: { user } } = await serverClient.auth.getUser();
            if (user) userId = user.id;
        } catch {}

        const { data, error } = await supabase
            .from('user_action_log')
            .insert({
                user_id: userId,
                action_type: 'INSTANT_PLAN_GENERATE',
                entity_name: params.targetName || (params.mode === 'nearby' ? '내 주변 5km' : '목적지 여행'),
                raw_metadata: {
                    mode: params.mode,
                    lat: params.lat,
                    lng: params.lng,
                    isMember: !!userId,
                    generatedAt: new Date().toISOString(),
                },
            })
            .select('id')
            .single();

        if (error) {
            console.warn('[AnalyticsLogger] logInstantPlanGenerate warning:', error.message);
            return { success: false };
        }

        return { success: true, logId: data?.id };
    } catch (err: any) {
        console.warn('[AnalyticsLogger] logInstantPlanGenerate error (safe catch):', err.message);
        return { success: false };
    }
}

/**
 * 2. 즉시 여행계획 -> 내 일정 저장(전환) 로깅 (Server Action)
 * - 최종 DB 등록 성공 시 1:1 확정 기록
 */
export async function logInstantPlanConvertAction(params: {
    logId?: string;
    scheduleId: string;
    targetName?: string;
}): Promise<{ success: boolean }> {
    try {
        const supabase = createAdminClient() as any;

        let userId: string | null = null;
        try {
            const serverClient = await createClient();
            const { data: { user } } = await serverClient.auth.getUser();
            if (user) userId = user.id;
        } catch {}

        await supabase
            .from('user_action_log')
            .insert({
                user_id: userId,
                action_type: 'INSTANT_PLAN_CONVERT',
                entity_id: params.logId || params.scheduleId,
                entity_name: params.targetName || '내 일정 저장 완료',
                raw_metadata: {
                    originalLogId: params.logId || null,
                    scheduleId: params.scheduleId,
                    convertedAt: new Date().toISOString(),
                },
            });

        return { success: true };
    } catch (err: any) {
        console.warn('[AnalyticsLogger] logInstantPlanConvert error (safe catch):', err.message);
        return { success: false };
    }
}

/**
 * 3. 사이트 방문 카운팅 (PV / UV) (Server Action)
 * - 비로그인/로그인 방문자 모두 기록
 * - visitorKey(브라우저 고유키)를 통한 UV 판별
 */
export async function recordSiteVisitAction(params: {
    visitorKey: string;
    path?: string;
}): Promise<{ success: boolean }> {
    try {
        if (!params.visitorKey) return { success: false };

        const supabase = createAdminClient() as any;

        let userId: string | null = null;
        try {
            const serverClient = await createClient();
            const { data: { user } } = await serverClient.auth.getUser();
            if (user) userId = user.id;
        } catch {}

        await supabase
            .from('user_action_log')
            .insert({
                user_id: userId,
                action_type: 'SITE_VISIT',
                entity_id: params.visitorKey,
                entity_name: params.path || '/',
                raw_metadata: {
                    path: params.path || '/',
                    visitedAt: new Date().toISOString(),
                },
            });

        return { success: true };
    } catch (err: any) {
        console.warn('[AnalyticsLogger] recordSiteVisit error (safe catch):', err.message);
        return { success: false };
    }
}

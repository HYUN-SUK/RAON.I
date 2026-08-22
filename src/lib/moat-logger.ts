import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';


export interface NavIntentPayload {
    placeId?: string;
    scheduleId?: string;
    userId?: string;
    category?: string;
    stage?: 'GOING' | 'RETURNING' | 'DESTINATION' | string;
    navApp: 'kakao' | 'kakaonavi' | 'tmap' | 'naver';
    partnerId?: string;
}

export interface PlanSwapPayload {
    scheduleId?: string;
    userId?: string;
    event: 'SWAPPED' | 'VIEWED_NO_SWAP';
    stage?: 'GOING' | 'RETURNING' | 'DESTINATION' | string;
    category?: string;
    candidateCount?: number;
    fromPlaceId?: string;
    toPlaceId?: string;
    fromTrustScore?: number;
    toTrustScore?: number;
    fromDistance?: number;
    toDistance?: number;
    partnerId?: string;
}

const DEFAULT_PARTNER_ID = 'a0000000-0000-0000-0000-000000000001'; // 라온아이 캠핑장 기본 테넌트

/**
 * [A+D 해자 데이터] 1. 길안내 실행 로그 기록 (최강 신호)
 * - Fire-and-Forget: 백그라운드 비동기 실행으로 내비 앱 실행을 1ms도 지연시키지 않음
 * - 에러 발생 시에도 콘솔 로깅만 수행하고 상위 흐름을 중단하지 않음
 */
export function logNavIntent(payload: NavIntentPayload) {
    try {
        // 1. 사용자에게 가벼운 예고 토스트
        toast.info('다녀오신 후 어떠셨는지 알려주세요 🌿', {
            duration: 3500,
        });

        // 2. 비동기 백그라운드 DB 인서트
        (async () => {
            try {
                const supabase = createClient();
                const { error } = await supabase
                    .from('nav_intent_log')
                    .insert({
                        partner_id: payload.partnerId || DEFAULT_PARTNER_ID,
                        schedule_id: payload.scheduleId || null,
                        user_id: payload.userId || null,
                        place_id: payload.placeId || null,
                        category: payload.category || null,
                        stage: payload.stage || 'DESTINATION',
                        nav_app: payload.navApp,
                        launched_at: new Date().toISOString(),
                        followed_up: false,
                    });

                if (error) {
                    console.warn('[MoatLogger] nav_intent_log insert warning:', error.message);
                } else {
                    console.log(`[MoatLogger] ✅ nav_intent_log recorded: ${payload.navApp} -> ${payload.placeId || 'spot'}`);
                }
            } catch (err) {
                console.warn('[MoatLogger] nav_intent_log network error:', err);
            }
        })();
    } catch (e) {
        console.warn('[MoatLogger] logNavIntent unexpected error:', e);
    }
}

/**
 * [A+D 해자 데이터] 2. 스마트플랜 장소 교체 및 대안 유지 로그 기록 (D)
 */
export function logPlanSwap(payload: PlanSwapPayload) {
    try {
        (async () => {
            try {
                const supabase = createClient();
                const { error } = await supabase
                    .from('plan_swap_log')
                    .insert({
                        partner_id: payload.partnerId || DEFAULT_PARTNER_ID,
                        schedule_id: payload.scheduleId || null,
                        user_id: payload.userId || null,
                        event: payload.event,
                        stage: payload.stage || 'DESTINATION',
                        category: payload.category || null,
                        candidate_count: payload.candidateCount || null,
                        from_place_id: payload.fromPlaceId || null,
                        to_place_id: payload.toPlaceId || null,
                        from_trust_score: payload.fromTrustScore || null,
                        to_trust_score: payload.toTrustScore || null,
                        from_distance: payload.fromDistance || null,
                        to_distance: payload.toDistance || null,
                        occurred_at: new Date().toISOString(),
                    });

                if (error) {
                    console.warn('[MoatLogger] plan_swap_log insert warning:', error.message);
                } else {
                    console.log(`[MoatLogger] ✅ plan_swap_log recorded: ${payload.event} (${payload.category || 'spot'})`);
                }
            } catch (err) {
                console.warn('[MoatLogger] plan_swap_log network error:', err);
            }
        })();
    } catch (e) {
        console.warn('[MoatLogger] logPlanSwap unexpected error:', e);
    }
}


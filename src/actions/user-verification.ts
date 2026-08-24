'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

const DEFAULT_PARTNER_ID = 'a0000000-0000-0000-0000-000000000001';

export interface UserVerifyCardItem {
    id: string;
    name: string;
    category: string;
    categoryName: string;
    categoryIcon: string;
    stage: string;
    address?: string;
    distanceKm?: number;
    hasNavLaunched?: boolean;
    trustScore?: number;
}

const CATEGORY_NAMES: Record<string, string> = {
    'RESTAURANT': '맛집',
    'ROUTE_RESTAURANT': '가는 길 맛집',
    'ROUTE_CAFE': '카페',
    'SPOT': '명소',
    'ROUTE_SPOT': '명소',
    'FESTIVAL': '축제',
    'MART': '마트/장보기',
    'GAS_STATION': '주유소',
    'HOSPITAL': '응급의료',
};

const CATEGORY_ICONS: Record<string, string> = {
    'RESTAURANT': '🍽️',
    'ROUTE_RESTAURANT': '🍲',
    'ROUTE_CAFE': '☕',
    'SPOT': '🏞️',
    'ROUTE_SPOT': '📸',
    'FESTIVAL': '🎪',
    'MART': '🛒',
    'GAS_STATION': '⛽',
    'HOSPITAL': '🏥',
};

/**
 * 1. 화면 A용 8개 한정 검증 카드 목록 조회 (길안내 실행 장소 최상단 정렬)
 */
export async function getScheduleVerifyCards(scheduleId: string): Promise<{ success: boolean; data: UserVerifyCardItem[]; error?: string }> {
    try {
        const supabase = await createClient();

        // 1) user_schedules에서 스마트플랜 데이터 조회
        const { data: schedule, error: schedErr } = await supabase
            .from('user_schedules')
            .select('id, smart_plan_data')
            .eq('id', scheduleId)
            .single();

        if (schedErr || !schedule || !schedule.smart_plan_data) {
            return { success: false, data: [], error: '일정 플랜 데이터를 찾을 수 없습니다.' };
        }

        const rawData = schedule.smart_plan_data;
        const plan = rawData.wrapped ? (rawData.ai_plan || rawData) : rawData;


        // 2) 카테고리 필터링: 식당/카페/명소/축제 대상만 추출 (마트/주유소/병원은 화면 A에서 제외)
        const eligibleCards: Array<{ card: any; stage: string }> = [];

        // 목적지 주변 (itemListElement)
        (plan.itemListElement || []).forEach((c: any) => {
            if (['RESTAURANT', 'SPOT', 'FESTIVAL', 'ROUTE_CAFE'].includes(c.category)) {
                eligibleCards.push({ card: c, stage: 'DESTINATION' });
            }
        });

        // 가는 길 (routeListElement)
        (plan.routeListElement || []).forEach((c: any) => {
            if (['ROUTE_RESTAURANT', 'ROUTE_CAFE', 'ROUTE_SPOT', 'RESTAURANT', 'SPOT'].includes(c.category)) {
                eligibleCards.push({ card: c, stage: 'GOING' });
            }
        });

        // 귀갓길 (returnListElement)
        (plan.returnListElement || []).forEach((c: any) => {
            if (['ROUTE_RESTAURANT', 'ROUTE_CAFE', 'ROUTE_SPOT', 'RESTAURANT', 'SPOT'].includes(c.category)) {
                eligibleCards.push({ card: c, stage: 'RETURNING' });
            }
        });

        // 3) 길안내 실행 로그(nav_intent_log) 매칭 여부 확인
        const placeIds = eligibleCards.map(e => e.card.id).filter(Boolean);
        const { data: navLogs } = await supabase
            .from('nav_intent_log')
            .select('place_id')
            .eq('schedule_id', scheduleId)
            .in('place_id', placeIds);

        const navLaunchedSet = new Set((navLogs || []).map(n => n.place_id));

        // 4) 정렬: 1순위 길안내 실행 장소 ➔ 2순위 신뢰점수/거리 순
        const sorted = eligibleCards.sort((a, b) => {
            const aNav = navLaunchedSet.has(a.card.id) ? 1 : 0;
            const bNav = navLaunchedSet.has(b.card.id) ? 1 : 0;
            if (aNav !== bNav) return bNav - aNav;
            return (b.card.trustScore || 0) - (a.card.trustScore || 0);
        });

        // 5) 최대 8개 한정
        const top8 = sorted.slice(0, 8);

        const items: UserVerifyCardItem[] = top8.map(item => {
            const c = item.card;
            return {
                id: c.id,
                name: c.name,
                category: c.category,
                categoryName: CATEGORY_NAMES[c.category] || '추천 장소',
                categoryIcon: CATEGORY_ICONS[c.category] || '📍',
                stage: item.stage,
                address: c.metadata?.address || c.metadata?.addr || '',
                distanceKm: c.distanceKm || c.distance,
                hasNavLaunched: navLaunchedSet.has(c.id),
                trustScore: c.trustScore,
            };
        });

        return { success: true, data: items };
    } catch (e: any) {
        console.error('getScheduleVerifyCards error:', e);
        return { success: false, data: [], error: e.message };
    }
}

/**
 * 2. 화면 A: 좋았던 곳 내 지도에 담기 제출 (1-3탭 완료)
 */
export async function submitUserVerifyPicks(
    scheduleId: string,
    placeIds: string[],
    entryPoint: string = 'verify_flow'
): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // 1) 일정 정보 확인
        const { data: sched } = await supabase
            .from('user_schedules')
            .select('user_id, check_in_date')
            .eq('id', scheduleId)
            .single();

        const userId = user?.id || sched?.user_id || null;
        const observedDate = sched?.check_in_date || new Date().toISOString().split('T')[0];
        const observedDow = new Date(observedDate).getDay();

        if (placeIds.length === 0) {
            return { success: true, count: 0 };
        }

        // 2) 선택된 장소들에 대해 place_verifications (좋았어요 긍정 신호) 적재
        const verifInserts = placeIds.map(pid => ({
            partner_id: DEFAULT_PARTNER_ID,
            schedule_id: scheduleId,
            place_id: pid,
            user_id: userId,
            stage: 'DESTINATION',
            visited: true,
            liked: true,
            fact_status: 'OK',
            observed_at: observedDate,
            observed_dow: observedDow,
            source: 'APP_USER',
            entry_point: entryPoint,
            evidence: 'SCHEDULE_MATCH',
            reporter_weight: 0.5,
            review_state: 'APPLIED',
            verified_at: new Date().toISOString(),
        }));

        await supabase.from('place_verifications').insert(verifInserts);

        // 3) user_schedules의 record_written 플래그 갱신
        await supabase
            .from('user_schedules')
            .update({ record_written: true, updated_at: new Date().toISOString() })
            .eq('id', scheduleId);

        revalidatePath('/myspace');
        revalidatePath('/myspace/records');

        return { success: true, count: placeIds.length };
    } catch (e: any) {
        console.error('submitUserVerifyPicks error:', e);
        return { success: false, error: e.message };
    }
}

/**
 * 3. 화면 D: 여행 후 문 닫은 곳/정보 오류 신고 제출
 */
export async function submitUserVerifyReport(
    scheduleId: string,
    placeId: string,
    factStatus: string,
    note?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const { data: sched } = await supabase
            .from('user_schedules')
            .select('user_id, check_in_date')
            .eq('id', scheduleId)
            .single();

        const now = new Date();
        const observedDate = sched?.check_in_date || now.toISOString().split('T')[0];

        const { error } = await supabase
            .from('place_verifications')
            .insert({
                partner_id: DEFAULT_PARTNER_ID,
                schedule_id: scheduleId,
                place_id: placeId,
                user_id: user?.id || sched?.user_id || null,
                stage: 'DESTINATION',
                visited: true,
                liked: false,
                fact_status: factStatus,
                fact_note: note || null,
                observed_at: observedDate,
                observed_dow: new Date(observedDate).getDay(),
                source: 'APP_USER',
                entry_point: 'verify_flow_closed',
                evidence: 'SCHEDULE_MATCH',
                reporter_weight: 0.5,
                review_state: 'PENDING',
                verified_at: now.toISOString(),
            });

        if (error) {
            console.error('submitUserVerifyReport error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (e: any) {
        console.error('submitUserVerifyReport unexpected error:', e);
        return { success: false, error: e.message };
    }
}

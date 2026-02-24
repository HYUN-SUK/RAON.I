// ========================================================================================
// Smart Camping Plan Phase 2: Action-to-Tag System (Persona Extraction)
// ========================================================================================
import { createClient } from './supabase-client';

/**
 * 사용자 행동에서 추출된 태그와 가중치
 */
export interface TagWeight {
    tag: string;
    weight: number;
}

/**
 * 추출된 캠퍼 페르소나 컨텍스트
 */
export interface UserPersona {
    description: string;   // LLM에 주입될 요약 문장
    topTags: TagWeight[];  // 활동 기반 상위 태그
    guestDetails?: {       // 최신 예약 기반 인원 구성
        adults: number;
        kids: {
            preschool: number;
            elementary: number;
            teen: number;
        };
    };
}

/**
 * [Phase 2] 미리 정의된 액션과 해당 태그/가중치 매핑 세트 (Action-to-Tag Mapping v1.0)
 * 프론트엔드에서는 액션 키(예: 'RESERVATION_GLAMPING')만 넘기고,
 * 내부에서 태그와 가중치를 찾아 DB에 쏘도록 헬퍼 유틸리티로 묶습니다.
 */
export const ACTION_TAG_MAP: Record<string, { tags: string[], weight: number }> = {
    // 3.1 예약 및 외부 일정 등록
    'RESERVATION_GLAMPING_CARAVAN': { tags: ['#글램핑/카라반', '#최상급시설'], weight: 10.0 },
    'RESERVATION_NOJI_NATURE': { tags: ['#노지/차박', '#자연그대로'], weight: 10.0 },
    'RESERVATION_KIDS_INCLUDED': { tags: ['#영유아동반', '#키즈친화(놀이터)'], weight: 10.0 },
    'RESERVATION_PET_INCLUDED': { tags: ['#반려견동반'], weight: 10.0 },
    'RESERVATION_FAMILY_ADDED': { tags: ['#단체/떼캠', '#가족캠프'], weight: 8.0 },
    'RESERVATION_WEEKEND_PEAK': { tags: ['#가득찬일정', '#가족캠프'], weight: 5.0 },
    'RESERVATION_WEEKDAY_LEISURE': { tags: ['#여유로운/레이지', '#조용한/힐링'], weight: 8.0 },
    'RESERVATION_MULTIPLE_NIGHTS': { tags: ['#장비세팅매니아', '#여유로운/레이지'], weight: 5.0 },
    'RESERVATION_SOLO_CAMPER': { tags: ['#솔로캠퍼', '#독서/사색'], weight: 10.0 },
    'RESERVATION_CITY_NEARBY': { tags: ['#도심인접', '#매점/인프라중시'], weight: 5.0 },

    // 3.2 커뮤니티
    'FEED_POST_FIRE': { tags: ['#불멍매니아', '#감성소품/알전구'], weight: 5.0 },
    'FEED_POST_FOOD': { tags: ['#캠핑요리사', '#육식주의/바베큐'], weight: 5.0 },
    'FEED_POST_STAR': { tags: ['#밤하늘별빛', '#조용한/힐링'], weight: 8.0 },
    'FEED_POST_RAIN': { tags: ['#우중캠핑낭만', '#감성소품/알전구'], weight: 8.0 },
    'FEED_POST_SNOW': { tags: ['#설중캠핑', '#자연그대로'], weight: 8.0 },
    'FEED_DONATE_FOOD': { tags: ['#캠핑요리사', '#해산물러버'], weight: 3.0 },
    'FEED_DONATE_GEAR': { tags: ['#장비세팅매니아', '#소셜/이웃교류'], weight: 3.0 },
    'FEED_LIKE_GEAR': { tags: ['#장비세팅매니아', '#빈티지/레트로'], weight: 2.0 },
    'FEED_LIKE_MINIMAL': { tags: ['#미니멀리스트', '#차박/노지'], weight: 2.0 },
    'FEED_REPLY_SEAFOOD': { tags: ['#해산물러버', '#주류/안주매니아'], weight: 2.0 },
    'FEED_REPLY_VEGAN': { tags: ['#건강식/비건', '#미니멀리스트'], weight: 2.0 },
    'FEED_STAY_LONG': { tags: ['#사진/기록', '#소셜/이웃교류'], weight: 1.0 },
    'PROFILE_FOLLOWER_50': { tags: ['#소셜/이웃교류'], weight: 5.0 },
    'PROFILE_PIC_NATURE': { tags: ['#사진/기록', '#감성소품/알전구'], weight: 3.0 },
    'SEARCH_HASHTAG_EMOTION': { tags: ['#감성소품/알전구', '#여유로운/레이지'], weight: 2.0 },

    // 3.3 추천 큐레이션
    'HOME_CLICK_OCEAN': { tags: ['#오션뷰', '#탁트인시야'], weight: 2.0 },
    'HOME_CLICK_FOREST': { tags: ['#포레스트뷰', '#조용한/힐링'], weight: 2.0 },
    'HOME_CLICK_VALLEY': { tags: ['#호수/계곡', '#수상액티비티'], weight: 2.0 },
    'LBS_FESTIVAL_SEARCH': { tags: ['#로컬축제탐방', '#가득찬일정'], weight: 2.0 },
    'LBS_CAFE_CLICK': { tags: ['#분위기좋은카페', '#로컬베이커리/빵지순례'], weight: 2.0 },
    'LBS_MART_CLICK': { tags: ['#캠핑요리사', '#밀키트/간편조리'], weight: 2.0 },
    'LBS_RESTAURANT_CLICK': { tags: ['#현지맛집탐방', '#육식주의/바베큐'], weight: 2.0 },
    'LBS_TRAIL_CLICK': { tags: ['#하이킹/산책'], weight: 2.0 },
    'LBS_PARK_CLICK': { tags: ['#자연그대로', '#독서/사색'], weight: 2.0 },
    'LBS_WEATHER_CLICK': { tags: ['#가득찬일정', '#사진/기록'], weight: 1.0 },

    // 3.4 스마트 플랜 상호작용
    'PLAN_SWAP_MEALKIT': { tags: ['#밀키트/간편조리', '#여유로운/레이지'], weight: 4.0 },
    'PLAN_SWAP_FANCY_FOOD': { tags: ['#최상급시설', '#분위기좋은카페'], weight: 4.0 },
    'PLAN_SWAP_LOCAL_MART': { tags: ['#빈티지/레트로', '#노지/차박'], weight: 3.0 },
    'PLAN_SWAP_NATURE_WALK': { tags: ['#자연그대로', '#독서/사색'], weight: 4.0 },
    'PLAN_CLICK_NAVI': { tags: ['#가득찬일정', '#하이킹/산책'], weight: 3.0 },
    'PLAN_SHARE_SNS': { tags: ['#사진/기록', '#소셜/이웃교류'], weight: 5.0 },
    'PLAN_LIKE_ALCOHOL': { tags: ['#주류/안주매니아'], weight: 3.0 },
    'PLAN_LIKE_KIDS_ZONE': { tags: ['#키즈친화(놀이터)', '#영유아동반'], weight: 3.0 },
    'PLAN_FILTER_VIEW': { tags: ['#탁트인시야', '#오션뷰'], weight: 3.0 },
    'PLAN_FILTER_SHOWER': { tags: ['#개별화장실', '#최상급시설'], weight: 5.0 },

    // 3.5 마켓 및 미션
    'MARKET_CLICK_LANTERN': { tags: ['#감성소품/알전구', '#빈티지/레트로'], weight: 3.0 },
    'MARKET_CLICK_TENT': { tags: ['#장비세팅매니아', '#가족캠프'], weight: 3.0 },
    'MARKET_CLICK_MAT': { tags: ['#최상급시설', '#여유로운/레이지'], weight: 2.0 },
    'MISSION_LNT_START': { tags: ['#자연그대로', '#미니멀리스트'], weight: 5.0 },
    'MISSION_TENT_VETERAN': { tags: ['#장비세팅매니아'], weight: 4.0 },
};

/**
 * 프론트엔드에서 액션 키만으로 태그를 전송하는 래퍼 함수 
 */
export async function dispatchPersonaAction(userId: string, actionKey: keyof typeof ACTION_TAG_MAP) {
    const actionDef = ACTION_TAG_MAP[actionKey];
    if (!actionDef) {
        console.warn(`[Persona] Unknown action key: ${actionKey}`);
        return;
    }

    await logUserAction(userId, actionDef.tags, actionDef.weight);
}

/**
 * [Phase 2] 사용자 행동 태그 발송 (Frontend Dispatch)
 * 매뉴얼에 정의된 "핵심 액션" 발생 시 프론트엔드에서 이 함수를 호출하여 DB에 점수를 누적합니다.
 */
export async function logUserAction(userId: string, tags: string[], weight: number): Promise<void> {
    if (!userId || !tags.length || weight <= 0) return;

    try {
        const supabase = createClient();
        // Promise.all to dispatch multiple tags concurrently points to the upsert RPC
        const promises = tags.map(tag =>
            supabase.rpc('add_user_tag', {
                p_user_id: userId,
                p_tag: tag,
                p_weight: weight
            })
        );

        await Promise.all(promises);
        console.log(`[Persona] Action logged: ${tags.join(', ')} (+${weight})`);
    } catch (error) {
        console.error("[Persona] Failed to log user action:", error);
    }
}

/**
 * [Phase 2] DB에서 페르소나 컨텍스트 추출 (Extraction for Smart Plan Engine)
 * - 가장 높은 가중치를 가진 상위 N개 태그를 추출
 * - 최신 예약 내역의 인원 정보 병합
 */
export async function extractUserPersona(userId?: string, limit: number = 7): Promise<UserPersona> {
    // 1. 기본 Fallback 페르소나 (비로그인 또는 데이터 부족 시)
    const defaultPersona: UserPersona = {
        description: "새로운 캠핑 경험을 찾아 떠나는 호기심 많은 캠퍼",
        topTags: [
            { tag: "#감성캠핑", weight: 3.0 },
            { tag: "#휴식/힐링", weight: 2.5 }
        ],
        guestDetails: { adults: 2, kids: { preschool: 0, elementary: 0, teen: 0 } }
    };

    if (!userId) {
        return defaultPersona;
    }

    try {
        const supabase = createClient();
        // 2. DB에서 태그 지갑(JSONB) 가져오기
        const { data: personaData, error: personaError } = await supabase
            .from('user_personas')
            .select('tags')
            .eq('user_id', userId)
            .single();

        let topTags: TagWeight[] = defaultPersona.topTags;
        let description = defaultPersona.description;

        if (personaData && personaData.tags) {
            // JSONB 객체를 배열로 변환 후 점수 순 정렬
            const tagsRecord: Record<string, number> = personaData.tags;
            const sortedTags = Object.entries(tagsRecord)
                .map(([tag, weight]) => ({ tag, weight }))
                .sort((a, b) => b.weight - a.weight)
                .slice(0, limit);

            if (sortedTags.length > 0) {
                topTags = sortedTags;

                // 상위 3개 태그를 묶어서 자연스러운 설명서(Context) 문자열 생성
                const top3 = sortedTags.slice(0, 3).map(t => t.tag.replace('#', '')).join(', ');
                description = `해당 캠퍼는 평소 [${top3}] 스타일의 캠핑을 가장 선호하거나 최근 깊은 관심을 보이고 있습니다.`;
            }
        }

        // 3. 최근 예약에서 인원 정보(guestDetails) 가져오기
        const { data: recentRes } = await supabase
            .from('reservations')
            .select('guest_details')
            .eq('user_id', userId)
            .neq('status', 'CANCELLED')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        let guestDetails = defaultPersona.guestDetails;
        if (recentRes && recentRes.guest_details) {
            guestDetails = recentRes.guest_details as any;
        }

        // 4. 최종 융합본 (Persona) 리턴
        return {
            description,
            topTags,
            guestDetails
        };

    } catch (error) {
        console.error("[Persona] Failed to extract persona from DB:", error);
        return defaultPersona; // 안전망 (앱 크래시 방지)
    }
}

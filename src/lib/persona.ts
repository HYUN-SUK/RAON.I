// ========================================================================================
// Smart Camping Plan Phase 2: Action-to-Tag System (Persona Extraction)
// ========================================================================================
import { TagId, mapLegacyTagToId } from './tags';
import { createClient } from './supabase-client';

export interface TagWeight {
    tagId: TagId;
    weight: number;
    tag?: string; // Legacy support (Phase 1)
}

/**
 * 추출된 캠퍼 페르소나 컨텍스트
 */
export interface UserPersona {
    description: string;   // LLM에 주입될 요약 문장
    topTags: TagWeight[];  // 활동 기반 상위 태그
    guestDetails?: {       // 최신 예약 기반 인원 구성
        adults: number;
        seniors: number;   // 부모님/어르신 동반
        kids: {
            preschool: number;
            elementary: number;
            teen: number;
        };
        hasPet?: boolean;  // 반려견 동반 여부
    };
    tripContext?: any;     // 이번 여행 특수성 (Phase 1 추가)
}

/**
 * [Phase 2] 미리 정의된 액션과 해당 태그/가중치 매핑 세트 (Action-to-Tag Mapping v2.0)
 * Canonical TagId를 사용하여 정합성을 보장합니다.
 */
export const ACTION_TAG_MAP: Record<string, { tags: TagId[], weight: number }> = {
    // [4.1] 예약 및 외부 일정 (Strong Signals)
    'RESERVATION_GLAMPING_CARAVAN': { tags: ['FACILITY_GLAMP', 'FACILITY_LUXURY'], weight: 10.0 },
    'RESERVATION_NOJI_NATURE': { tags: ['FACILITY_OFFROAD', 'MOOD_NATURE'], weight: 10.0 },
    'RESERVATION_KIDS_INCLUDED': { tags: ['FAMILY_INFANT', 'FACILITY_KIDS'], weight: 15.0 },
    'RESERVATION_PET_INCLUDED': { tags: ['FAMILY_PET'], weight: 15.0 },
    'RESERVATION_FAMILY_ADDED': { tags: ['STYLE_GROUP', 'STYLE_FAMILY'], weight: 10.0 },
    'RESERVATION_WEEKEND_PEAK': { tags: ['ACTIVITY_BUSY', 'STYLE_FAMILY'], weight: 5.0 },
    'RESERVATION_WEEKDAY_LEISURE': { tags: ['MOOD_LAZY', 'MOOD_QUIET'], weight: 8.0 },
    'RESERVATION_MULTIPLE_NIGHTS': { tags: ['ACTIVITY_GEAR', 'MOOD_LAZY'], weight: 5.0 },
    'RESERVATION_SOLO_CAMPER': { tags: ['STYLE_SOLO', 'ACTIVITY_READ'], weight: 10.0 },
    'RESERVATION_URBAN_NEARBY': { tags: ['VIEW_CITY', 'FACILITY_STORE'], weight: 5.0 },
    
    // [4.2] 커뮤니티 및 소셜 (Medium Signals)
    'COMMUNITY_WRITE_FIRE': { tags: ['ACTIVITY_FIRE', 'MOOD_ACC'], weight: 5.0 },
    'COMMUNITY_WRITE_COOKING': { tags: ['FOOD_COOKING', 'FOOD_BBQ'], weight: 5.0 },
    'COMMUNITY_WRITE_STARRY': { tags: ['VIEW_STARRY', 'MOOD_QUIET'], weight: 8.0 },
    'COMMUNITY_WRITE_RAINY': { tags: ['MOOD_RAIN', 'MOOD_ACC'], weight: 8.0 },
    'COMMUNITY_WRITE_SNOWY': { tags: ['MOOD_SNOW', 'MOOD_NATURE'], weight: 8.0 },
    'COMMUNITY_EMBER_FOOD': { tags: ['FOOD_COOKING', 'FOOD_SEAFOOD'], weight: 3.0 },
    'COMMUNITY_EMBER_GEAR': { tags: ['ACTIVITY_GEAR', 'SOCIAL_ACTIVE'], weight: 3.0 },
    'COMMUNITY_LIKE_GEAR': { tags: ['ACTIVITY_GEAR', 'MOOD_VINTAGE'], weight: 2.0 },
    'COMMUNITY_LIKE_MINIMAL': { tags: ['ACTIVITY_MINIMAL', 'FACILITY_OFFROAD'], weight: 2.0 },
    'COMMUNITY_COMMENT_SEAFOOD': { tags: ['FOOD_SEAFOOD', 'FOOD_ALCOHOL'], weight: 3.0 },
    'COMMUNITY_COMMENT_VEGAN': { tags: ['FOOD_VEGAN', 'ACTIVITY_MINIMAL'], weight: 3.0 },
    'COMMUNITY_FEED_DWELL': { tags: ['ACTIVITY_PHOTO', 'SOCIAL_ACTIVE'], weight: 1.0 },
    'COMMUNITY_FOLLOWER_50': { tags: ['SOCIAL_ACTIVE'], weight: 10.0 },
    'COMMUNITY_PROFILE_CHANGE': { tags: ['ACTIVITY_PHOTO', 'MOOD_ACC'], weight: 5.0 },
    'COMMUNITY_FOLLOW_USER': { tags: ['SOCIAL_ACTIVE'], weight: 5.0 },

    // [4.3] LBS 및 주변 탐색 (Weak Signals)
    'LBS_CLICK_OCEAN_VIBE': { tags: ['VIEW_OCEAN', 'VIEW_OPEN'], weight: 2.0 },
    'LBS_CLICK_FOREST_VIBE': { tags: ['VIEW_FOREST', 'MOOD_QUIET'], weight: 2.0 },
    'LBS_CLICK_VALLEY_VIBE': { tags: ['VIEW_LAKE', 'ACTIVITY_WATER'], weight: 2.0 },
    'LBS_NEARBY_FESTIVAL': { tags: ['ACTIVITY_FESTIVAL', 'ACTIVITY_BUSY'], weight: 3.0 },
    'LBS_CLICK_CAFE': { tags: ['FOOD_CAFE', 'FOOD_BAKERY'], weight: 2.0 },
    'LBS_CLICK_MART': { tags: ['FOOD_COOKING', 'FOOD_MEALKIT'], weight: 2.0 },
    'LBS_CLICK_LOCALFOOD': { tags: ['FOOD_LOCAL', 'FOOD_BBQ'], weight: 2.0 },
    'LBS_CLICK_HIKE': { tags: ['ACTIVITY_HIKE'], weight: 2.0 },
    'LBS_CLICK_PARK': { tags: ['MOOD_NATURE', 'ACTIVITY_READ'], weight: 2.0 },
    'LBS_WEATHER_CLICK': { tags: ['ACTIVITY_BUSY', 'ACTIVITY_PHOTO'], weight: 1.0 },

    // [4.4] 스마트 플랜 상호작용 (Strong/Medium)
    'PLAN_SWAP_MEALKIT': { tags: ['FOOD_MEALKIT', 'MOOD_LAZY'], weight: 4.0 },
    'PLAN_SWAP_LUXURY': { tags: ['FACILITY_LUXURY', 'FOOD_CAFE'], weight: 4.0 },
    'PLAN_SWAP_VINTAGE': { tags: ['MOOD_VINTAGE', 'FACILITY_OFFROAD'], weight: 3.0 },
    'PLAN_SWAP_WALK': { tags: ['MOOD_NATURE', 'ACTIVITY_READ'], weight: 4.0 },
    'PLAN_CLICK_NAVI': { tags: ['ACTIVITY_BUSY', 'ACTIVITY_HIKE'], weight: 3.0 },
    'PLAN_SHARE_SNS': { tags: ['ACTIVITY_PHOTO', 'SOCIAL_ACTIVE'], weight: 5.0 },
    'PLAN_LIKE_ALCOHOL': { tags: ['FOOD_ALCOHOL'], weight: 3.0 },
    'PLAN_LIKE_KIDS_ZONE': { tags: ['FACILITY_KIDS', 'FAMILY_INFANT'], weight: 3.0 },
    'PLAN_FILTER_VIEW': { tags: ['VIEW_OPEN', 'VIEW_OCEAN'], weight: 3.0 },
    'PLAN_FILTER_PRIVATE': { tags: ['FACILITY_PRIVATE_BATH', 'FACILITY_LUXURY'], weight: 5.0 },

    // [4.5] 마켓 및 미션 (Medium Signals)
    'MARKET_CLICK_LANTERN': { tags: ['MOOD_ACC', 'MOOD_VINTAGE'], weight: 3.0 },
    'MARKET_CLICK_TENT': { tags: ['ACTIVITY_GEAR', 'STYLE_FAMILY'], weight: 3.0 },
    'MARKET_CLICK_MAT': { tags: ['FACILITY_LUXURY', 'MOOD_LAZY'], weight: 2.0 },
    'MISSION_LNT_PARTICIPATE': { tags: ['MOOD_NATURE', 'ACTIVITY_MINIMAL'], weight: 5.0 },
    'MISSION_BADGE_GEAR_MASTER': { tags: ['ACTIVITY_GEAR'], weight: 4.0 },

    // Profile Sync (Legacy Support)
    'PROFILE_SYNC_KIDS': { tags: ['FAMILY_INFANT'], weight: 8.0 },
    'PROFILE_SYNC_PET': { tags: ['FAMILY_PET'], weight: 8.0 },
};

/**
 * 프론트엔드/백엔드 공용 액션 래퍼
 */
export async function dispatchPersonaAction(
    userId: string, 
    actionKey: keyof typeof ACTION_TAG_MAP,
    customSupabase?: any
) {
    const actionDef = ACTION_TAG_MAP[actionKey];
    if (!actionDef) {
        console.warn(`[Persona] Unknown action key: ${actionKey}`);
        return;
    }

    await logUserAction(userId, actionDef.tags, actionDef.weight, { action_type: actionKey }, customSupabase);
}

/**
 * [Phase 1 v2.0] 사용자 행동 태그 발송 (Traceable Logic)
 * 원본 액션 로그와 태그 장부를 동시에 기록합니다.
 */
export async function logUserAction(
    userId: string, 
    tags: TagId[], 
    weight: number, 
    metadata: any = {},
    customSupabase?: any
): Promise<void> {
    if (!userId || !tags.length || weight <= 0) return;

    try {
        const supabase = customSupabase || createClient();
        
        // 1. Action Log 기록
        const { data: actionData, error: actionError } = await supabase
            .from('user_action_log')
            .insert({
                user_id: userId,
                action_type: metadata.action_type || 'SYSTEM_LOG',
                entity_id: metadata.entity_id,
                entity_name: metadata.entity_name,
                raw_metadata: metadata
            })
            .select('id')
            .single();

        if (actionError) throw actionError;

        // 2. Tag Ledger 기록
        const ledgerEntries = tags.map(tagId => ({
            user_id: userId,
            action_id: actionData.id,
            tag_id: tagId,
            delta_score: weight,
            reason: metadata.reason || `Action: ${metadata.action_type}`
        }));

        const { error: ledgerError } = await supabase
            .from('user_tag_ledger')
            .insert(ledgerEntries);

        if (ledgerError) throw ledgerError;

        // 3. Trip Snapshot 즉시 갱신 (Strong Signal인 경우에만)
        const STRONG_SIGNALS = ['RESERVATION', 'SCHEDULE_ADD', 'PROFILE_UPDATE'];
        if (STRONG_SIGNALS.includes(metadata.action_type) || metadata.action_type?.startsWith('RESERVATION_')) {
            await refreshTripSnapshot(userId, supabase);
        }

    } catch (error) {
        console.error("[Persona v2] Failed to log user action:", error);
    }
}

/**
 * [Phase 1 v2.0] 최근 행동(최대 7일)을 집계하여 Trip Snapshot을 즉시 갱신합니다.
 */
export async function refreshTripSnapshot(userId: string, customSupabase?: any): Promise<void> {
    try {
        const supabase = customSupabase || createClient();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // 1. 최근 Ledger 내역 가져오기
        const { data: recentLedger } = await supabase
            .from('user_tag_ledger')
            .select('tag_id, delta_score')
            .eq('user_id', userId)
            .gte('created_at', sevenDaysAgo.toISOString());

        if (!recentLedger || recentLedger.length === 0) return;

        // 2. 태그 합산
        const snapshotTags: Record<string, number> = {};
        recentLedger.forEach((entry: { tag_id: string; delta_score: number | string }) => {
            snapshotTags[entry.tag_id] = (snapshotTags[entry.tag_id] || 0) + Number(entry.delta_score);
        });

        // 3. 최근 예약에서 제약 조건 추출 (hasKids 등)
        const { data: recentRes } = await supabase
            .from('reservations')
            .select('guest_details')
            .eq('user_id', userId)
            .neq('status', 'CANCELLED')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // 4. 스냅샷 Upsert
        const { error } = await supabase
            .from('trip_persona_snapshots')
            .upsert({
                user_id: userId,
                tags: snapshotTags,
                constraints: recentRes?.guest_details || {},
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' }); // user_id가 PK인 1:1 관계 가정 (또는 trip_id 기준)

        if (error) throw error;

    } catch (error) {
        console.error("[Persona v2] Failed to refresh trip snapshot:", error);
    }
}

/**
 * [Phase 1 v2.0] DB에서 페르소나 컨텍스트 추출
 * - user_persona_snapshots (Global)와 trip_persona_snapshots (Trip)를 융합
 */
export async function extractUserPersona(userId?: string, limit: number = 7, customSupabase?: any): Promise<UserPersona> {
    const defaultPersona: UserPersona = {
        description: "새로운 캠핑 경험을 찾아 떠나는 호기심 많은 캠퍼",
        topTags: [
            { tagId: 'STYLE_COUPLE', weight: 3.0 },
            { tagId: 'MOOD_QUIET', weight: 2.5 }
        ],
        guestDetails: { adults: 2, seniors: 0, kids: { preschool: 0, elementary: 0, teen: 0 } }
    };

    if (!userId) return defaultPersona;

    try {
        const supabase = customSupabase || createClient();
        
        // 1. Global Persona Snapshot 가져오기
        const { data: globalSnapshot } = await supabase
            .from('user_persona_snapshots')
            .select('tags')
            .eq('user_id', userId)
            .single();

        // 2. Trip Persona Snapshot 가져오기 (가장 최근 것)
        const { data: tripSnapshot } = await supabase
            .from('trip_persona_snapshots')
            .select('tags, constraints')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        let mergedTagsMap: Record<string, number> = {};
        
        // Global 태그 반영
        if (globalSnapshot?.tags) {
            mergedTagsMap = { ...globalSnapshot.tags };
        }

        // Trip 태그 반영 (Trip 태그가 있는 경우 Global을 보정하거나 덮어씌움)
        if (tripSnapshot?.tags) {
            Object.entries(tripSnapshot.tags as Record<string, number>).forEach(([tagId, weight]) => {
                mergedTagsMap[tagId] = (mergedTagsMap[tagId] || 0) + weight;
            });
        }

        const topTags: TagWeight[] = Object.entries(mergedTagsMap)
            .map(([tagId, weight]) => ({ tagId: tagId as TagId, weight }))
            .sort((a, b) => b.weight - a.weight)
            .slice(0, limit);

        // 3. 인원 정보 (Trip Artifact에서 가져오거나 기존 예약에서 추출)
        let guestDetails = defaultPersona.guestDetails;
        if (tripSnapshot?.constraints) {
            guestDetails = tripSnapshot.constraints;
        } else {
            const { data: recentRes } = await supabase
                .from('reservations')
                .select('guest_details')
                .eq('user_id', userId)
                .neq('status', 'CANCELLED')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            if (recentRes?.guest_details) guestDetails = recentRes.guest_details as any;
        }

        return {
            description: topTags.length > 0 
                ? `해당 캠퍼는 ${topTags.slice(0, 3).map(t => t.tagId).join(', ')} 스타일을 선호하는 것으로 보입니다.`
                : defaultPersona.description,
            topTags,
            guestDetails,
            tripContext: tripSnapshot?.tags
        };

    } catch (error) {
        console.error("[Persona v2] Failed to extract persona:", error);
        return defaultPersona;
    }
}

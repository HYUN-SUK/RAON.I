'use server';

import { createClient } from '@/lib/supabase-server';

/**
 * 통합 캠핑 프로필 타입
 * 출발지 + 인원 구성 + 반려견 여부
 */
export interface CampingProfile {
    originLabel: string | null;
    originLat: number | null;
    originLng: number | null;
    adults: number;
    kidsPreschool: number;
    kidsElementary: number;
    kidsTeen: number;
    hasPet: boolean;
}

/**
 * 사용자 캠핑 프로필 조회
 * - 프로필이 없으면 null 반환 (첫 입력 필요)
 */
export async function getCampingProfile(): Promise<CampingProfile | null> {
    const supabase = await createClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    const { data, error } = await supabase
        .from('user_camping_profiles')
        .select('*')
        .eq('user_id', userData.user.id)
        .maybeSingle();

    if (error) {
        console.error('[CampingProfile] Fetch error:', error);
        return null;
    }

    if (!data) return null;

    return {
        originLabel: data.origin_label,
        originLat: data.origin_lat,
        originLng: data.origin_lng,
        adults: data.adults ?? 2,
        kidsPreschool: data.kids_preschool ?? 0,
        kidsElementary: data.kids_elementary ?? 0,
        kidsTeen: data.kids_teen ?? 0,
        hasPet: data.has_pet ?? false,
    };
}

/**
 * 사용자 캠핑 프로필 저장/수정 (Upsert)
 * - 첫 입력 시: INSERT
 * - 이후 수정 시: UPDATE (ON CONFLICT user_id)
 */
export async function saveCampingProfile(
    profile: CampingProfile
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
        return { success: false, error: '로그인이 필요합니다' };
    }

    const { error } = await supabase.rpc('upsert_camping_profile', {
        p_user_id: userData.user.id,
        p_origin_label: profile.originLabel,
        p_origin_lat: profile.originLat,
        p_origin_lng: profile.originLng,
        p_adults: profile.adults,
        p_kids_preschool: profile.kidsPreschool,
        p_kids_elementary: profile.kidsElementary,
        p_kids_teen: profile.kidsTeen,
        p_has_pet: profile.hasPet,
    });

    if (error) {
        console.error('[CampingProfile] Save error:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

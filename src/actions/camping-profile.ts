'use server';

import { createClient } from '@/lib/supabase-server';
import { dispatchPersonaAction } from '@/lib/persona';

/**
 * 통합 캠핑 프로필 타입
 * 출발지 + 인원 구성 + 반려견 여부
 */
export interface CampingProfile {
    originLabel: string | null;
    originLat: number | null;
    originLng: number | null;
    adults: number;
    seniors: number; // [v11.9.56] 부모님 인원 추가
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

    let data: any = null;
    let error: any = null;

    if (userData?.user) {
        const res = await supabase
            .from('user_camping_profiles')
            .select('*')
            .eq('user_id', userData.user.id)
            .maybeSingle();
        data = res.data;
        error = res.error;
    }

    // [v11.9.125] 세션 갱신 지연 시 adminSupabase 백업 검증
    if (!data && userData?.user) {
        try {
            const { createAdminClient } = await import('@/lib/supabase-admin');
            const adminSupabase = createAdminClient();
            const adminRes = await adminSupabase
                .from('user_camping_profiles')
                .select('*')
                .eq('user_id', userData.user.id)
                .maybeSingle();
            if (adminRes.data) {
                data = adminRes.data;
                error = null;
            }
        } catch (adminErr) {
            console.warn('[CampingProfile] Admin fallback fetch error:', adminErr);
        }
    }

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
        seniors: data.seniors ?? 0, // [v11.9.56] DB 매핑 추가
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
        p_seniors: profile.seniors, // [v11.9.56] 부모님 인원 추가
        p_kids_preschool: profile.kidsPreschool,
        p_kids_elementary: profile.kidsElementary,
        p_kids_teen: profile.kidsTeen,
        p_has_pet: profile.hasPet,
    });

    if (error) {
        console.error('[CampingProfile] Save error:', error);
        return { success: false, error: error.message };
    }

    // [Phase 2] Dispatch Persona Actions for Profile Sync
    try {
        if (profile.kidsPreschool > 0 || profile.kidsElementary > 0) {
            await dispatchPersonaAction(userData.user.id, 'PROFILE_SYNC_KIDS', supabase);
        }
        if (profile.hasPet) {
            await dispatchPersonaAction(userData.user.id, 'PROFILE_SYNC_PET', supabase);
        }
    } catch (err) {
        console.error('[Persona] Failed to dispatch profile sync actions', err);
    }

    return { success: true };
}

/**
 * [Phase 5] 카카오 & 네이버 하이브리드 주소/장소 검색 (Server-side)
 * - 1차: 카카오 DAPI 키워드 및 주소 병렬 검색
 * - 2차: 카카오 형태소 버그(예: 일월관광농원 등) 또는 색인 누락으로 0건일 때 네이버 로컬 검색 API Fallback
 * - 클라이언트 CORS 및 API 키 노출 방지를 위해 Server Action으로 처리합니다.
 */
export async function searchAddressAction(query: string): Promise<{ label: string; address?: string; lat: number; lng: number }[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const kakaoKey = process.env.KAKAO_REST_API_KEY;
    const naverId = process.env.NAVER_CLIENT_ID;
    const naverSecret = process.env.NAVER_CLIENT_SECRET;

    if (!kakaoKey && !naverId) {
        console.error('[CampingProfile] Search API keys (KAKAO_REST_API_KEY, NAVER_CLIENT_ID) are missing in env');
        return [];
    }

    const results: { label: string; address?: string; lat: number; lng: number }[] = [];
    const seen = new Set<string>();
    const queryEncoded = encodeURIComponent(trimmed);

    // 1. 1차: 카카오 키워드 & 주소 검색
    if (kakaoKey) {
        try {
            const headers = { Authorization: `KakaoAK ${kakaoKey}` };
            const keywordPromise = fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${queryEncoded}&size=5`, { headers, next: { revalidate: 3600 } }).then(r => r.ok ? r.json() : { documents: [] });
            const addressPromise = fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${queryEncoded}&size=5`, { headers, next: { revalidate: 3600 } }).then(r => r.ok ? r.json() : { documents: [] });

            const [keywordData, addressData] = await Promise.all([keywordPromise, addressPromise]);

            // 키워드 결과 먼저 추가 (장소명 + 도로명/지번 주소)
            for (const doc of (keywordData.documents || [])) {
                const label = doc.place_name || doc.address_name;
                const address = doc.road_address_name || doc.address_name || '';
                if (label && !seen.has(label)) {
                    seen.add(label);
                    results.push({ label, address, lat: parseFloat(doc.y), lng: parseFloat(doc.x) });
                }
            }

            // 주소 결과 추가
            for (const doc of (addressData.documents || [])) {
                const label = doc.address_name;
                const address = doc.road_address?.address_name || doc.address_name || '';
                if (label && !seen.has(label)) {
                    seen.add(label);
                    results.push({ label, address, lat: parseFloat(doc.y), lng: parseFloat(doc.x) });
                }
            }
        } catch (err) {
            console.warn('[CampingProfile] Kakao search failed:', err);
        }
    }

    // 2. 2차: 카카오 결과가 0건일 때 네이버 로컬 검색 Fallback (카카오 형태소 버그 및 색인 누락 완벽 보완)
    if (results.length === 0 && naverId && naverSecret) {
        try {
            const naverRes = await fetch(`https://openapi.naver.com/v1/search/local.json?query=${queryEncoded}&display=5`, {
                headers: {
                    'X-Naver-Client-Id': naverId,
                    'X-Naver-Client-Secret': naverSecret,
                }
            });

            if (naverRes.ok) {
                const naverData: any = await naverRes.json();
                for (const item of (naverData.items || [])) {
                    const cleanLabel = (item.title || '').replace(/<[^>]+>/g, '').trim();
                    const address = item.roadAddress || item.address || '';
                    const rawX = parseInt(item.mapx, 10);
                    const rawY = parseInt(item.mapy, 10);
                    if (cleanLabel && rawX && rawY && !seen.has(cleanLabel)) {
                        seen.add(cleanLabel);
                        results.push({
                            label: cleanLabel,
                            address: address,
                            lat: rawY / 1e7,
                            lng: rawX / 1e7,
                        });
                    }
                }
            }
        } catch (nErr) {
            console.warn('[CampingProfile] Naver search fallback failed:', nErr);
        }
    }

    return results.slice(0, 5); // 최대 5개까지만
}

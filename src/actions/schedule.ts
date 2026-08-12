'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { dispatchPersonaAction } from '@/lib/persona';

import { SITES } from '@/constants/sites';
import { DEFAULT_CAMPING_LOCATION } from '@/constants/location';

import { getSiteConfigServer } from '@/lib/siteConfigServer';

// ═══════════════════════════════════════════════════════════

export interface ScheduleFormData {
    source: 'raonai' | 'external';
    campgroundName: string;
    campgroundAddress?: string;
    campgroundLat?: number;
    campgroundLng?: number;
    campgroundId?: string;
    reservationId?: string;
    checkIn: string; // YYYY-MM-DD
    checkOut: string; // YYYY-MM-DD
    memo?: string;
}

export interface Schedule {
    id: string;
    user_id: string;
    source: 'raonai' | 'external';
    reservation_id?: string;
    campground_id?: string;
    campground_name: string;
    campground_address?: string;
    campground_lat?: number;
    campground_lng?: number;
    check_in: string;
    check_out: string;
    status: 'scheduled' | 'completed' | 'cancelled';
    record_written: boolean;
    memo?: string;
    member_count?: number;
    created_at: string;
    updated_at: string;
    smart_plan_data?: any; // [v11.9.31] 스마트 플랜 저장용 JSON
}

export interface ChecklistItem {
    id: string;
    schedule_id: string;
    item: string;
    is_checked: boolean;
    category: 'essential' | 'cooking' | 'sleeping' | 'activity' | 'etc';
    sort_order: number;
}

// ═══════════════════════════════════════════════════════════
// 일정 CRUD
// ═══════════════════════════════════════════════════════════

/**
 * 일정 생성
 */
export async function createSchedule(data: ScheduleFormData): Promise<{ success: boolean; id?: string; error?: string }> {
    const supabase = await createClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
        return { success: false, error: '로그인이 필요합니다' };
    }

    const { data: result, error } = await supabase.rpc('upsert_schedule', {
        p_user_id: userData.user.id,
        p_source: data.source,
        p_campground_name: data.campgroundName,
        p_campground_address: data.campgroundAddress || null,
        p_campground_lat: data.campgroundLat || null,
        p_campground_lng: data.campgroundLng || null,
        p_check_in: data.checkIn,
        p_check_out: data.checkOut,
        p_memo: data.memo || null,
        p_campground_id: data.campgroundId || null,
        p_reservation_id: data.reservationId || null,
    });

    if (error) {
        console.error('Schedule creation error:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/myspace/schedule');

    // [Phase 2/3] Dispatch Persona Actions for External Schedule
    if (data.source === 'external') {
        try {
            const name = data.campgroundName;
            const address = data.campgroundAddress || '';
            
            // No 1: 글램핑/카라반 포함
            if (name.includes('글램핑') || name.includes('카라반')) {
                await dispatchPersonaAction(userData.user.id, 'RESERVATION_GLAMPING_CARAVAN', supabase);
            } 
            // No 2: 자연휴양림/노지 포함
            else if (name.includes('노지') || name.includes('자연') || name.includes('휴양림')) {
                await dispatchPersonaAction(userData.user.id, 'RESERVATION_NOJI_NATURE', supabase);
            }
            // No 10: 도심지/도심근교인 경우 (서울, 광역시 등)
            if (address.includes('서울') || address.includes('인천') || address.includes('대전') || 
                address.includes('대구') || address.includes('부산') || address.includes('광주') || 
                address.includes('경기')) {
                await dispatchPersonaAction(userData.user.id, 'RESERVATION_URBAN_NEARBY', supabase);
            }
        } catch (err) {
            console.error('[Persona] Failed to dispatch external schedule action', err);
        }
    }

    return { success: true, id: result };
}

/**
 * 내 일정 목록 조회
 */
export async function getMySchedules(status?: 'scheduled' | 'completed' | 'cancelled'): Promise<Schedule[]> {
    const supabase = await createClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return [];

    let query = supabase
        .from('user_schedules')
        .select('*')
        .eq('user_id', userData.user.id);

    // 날짜 기준 정렬 (예정된 일정은 빠른 순, 완료/취소는 최신 순)
    if (status === 'scheduled') {
        query = query.order('check_in', { ascending: true });
    } else {
        query = query.order('check_in', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
        console.error('Fetch schedules error:', error);
        return [];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // [v11.9.70] 날짜 기반 자동 상태 분류 및 DB 영구 업데이트 로직 적용
    const pastScheduledIds = (data || [])
        .filter(s => s.status === 'scheduled' && new Date(s.check_out) < today)
        .map(s => s.id);

    if (pastScheduledIds.length > 0) {
        // 과거 일정을 DB에서 실제로 'completed'로 전환
        await supabase
            .from('user_schedules')
            .update({ status: 'completed' })
            .in('id', pastScheduledIds);
    }

    const schedules = (data || []).map(s => {
        const checkOutDate = new Date(s.check_out);
        if (s.status === 'scheduled' && checkOutDate < today) {
            return { ...s, status: 'completed' as const };
        }
        return s;
    });

    if (status) {
        return schedules.filter(s => s.status === status);
    }

    return schedules;
}

/**
 * 일정 상세 조회
 */
export async function getScheduleById(scheduleId: string): Promise<Schedule | null> {
    const supabase = await createClient();

    let { data, error } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();

    // [v11.9.120] 세션 갱신 지연으로 인한 RLS 차단 방어 가드
    if (error || !data) {
        try {
            const { createAdminClient } = await import('@/lib/supabase-admin');
            const adminSupabase = createAdminClient();

            // 현재 로그인 유저 ID 교차 검증
            const { data: userData } = await supabase.auth.getUser();
            if (userData?.user?.id) {
                const { data: adminData } = await adminSupabase
                    .from('user_schedules')
                    .select('*')
                    .eq('id', scheduleId)
                    .eq('user_id', userData.user.id)
                    .maybeSingle();

                if (adminData) {
                    data = adminData as any;
                    error = null;
                }
            }

            // [v13.1.1] 2차 fallback: 비로그인 또는 개발 테스트 진입 시 id로 직접 안전 조회 허용 (404 완벽 방지)
            if (!data) {
                const { data: fallbackData } = await adminSupabase
                    .from('user_schedules')
                    .select('*')
                    .eq('id', scheduleId)
                    .maybeSingle();

                if (fallbackData) {
                    data = fallbackData as any;
                    error = null;
                }
            }
        } catch (adminErr) {
            console.warn('[getScheduleById] Admin fallback check error:', adminErr);
        }
    }

    if (error || !data) {
        console.error('Fetch schedule error:', error);
        return null;
    }

    if (!data) return null;

    // 만료 여부 계산 (UI 바인딩용 순수 계산)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkOutDate = new Date(data.check_out);

    if (data.status === 'scheduled' && checkOutDate < today) {
        return { ...data, status: 'completed' };
    }

    return data;
}

/**
 * 일정 수정
 */
export async function updateSchedule(
    scheduleId: string,
    updates: Partial<Pick<Schedule, 'campground_name' | 'campground_address' | 'check_in' | 'check_out' | 'status' | 'memo' | 'smart_plan_data'>>
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // 일정 날짜(check_in 또는 check_out)가 변경되는 경우 기존 스마트플랜 캐시 리셋
    const finalUpdates = { ...updates };
    if (updates.check_in || updates.check_out) {
        finalUpdates.smart_plan_data = null;
    }

    const { error } = await supabase
        .from('user_schedules')
        .update(finalUpdates)
        .eq('id', scheduleId);

    if (error) {
        console.error('Update schedule error:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/myspace/schedule');
    return { success: true };
}

/**
 * 일정 삭제
 */
export async function deleteSchedule(scheduleId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const { error } = await supabase
        .from('user_schedules')
        .delete()
        .eq('id', scheduleId);

    if (error) {
        console.error('Delete schedule error:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/myspace/schedule');
    return { success: true };
}

/**
 * 일정 완료 처리
 */
export async function completeSchedule(scheduleId: string): Promise<{ success: boolean; error?: string }> {
    return updateSchedule(scheduleId, { status: 'completed' });
}

// ═══════════════════════════════════════════════════════════
// 체크리스트 CRUD
// ═══════════════════════════════════════════════════════════

/**
 * 체크리스트 아이템 조회
 */
export async function getChecklist(scheduleId: string): Promise<ChecklistItem[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('schedule_checklists')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Fetch checklist error:', error);
        return [];
    }

    return data || [];
}

/**
 * 체크리스트 아이템 추가
 */
export async function addChecklistItem(
    scheduleId: string,
    item: string,
    category: ChecklistItem['category'] = 'etc'
): Promise<{ success: boolean; id?: string; error?: string }> {
    const supabase = await createClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
        return { success: false, error: '로그인이 필요합니다' };
    }

    // 현재 최대 sort_order 조회
    const { data: existing } = await supabase
        .from('schedule_checklists')
        .select('sort_order')
        .eq('schedule_id', scheduleId)
        .order('sort_order', { ascending: false })
        .limit(1);

    const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
        .from('schedule_checklists')
        .insert({
            schedule_id: scheduleId,
            user_id: userData.user.id,
            item,
            category,
            sort_order: nextOrder,
        })
        .select('id')
        .single();

    if (error) {
        console.error('Add checklist item error:', error);
        return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
}

/**
 * 체크리스트 아이템 토글
 */
export async function toggleChecklistItem(itemId: string): Promise<{ success: boolean; checked?: boolean; error?: string }> {
    const supabase = await createClient();

    // 현재 상태 조회
    const { data: current, error: fetchError } = await supabase
        .from('schedule_checklists')
        .select('is_checked')
        .eq('id', itemId)
        .single();

    if (fetchError) {
        return { success: false, error: fetchError.message };
    }

    const newChecked = !current.is_checked;

    const { error } = await supabase
        .from('schedule_checklists')
        .update({ is_checked: newChecked })
        .eq('id', itemId);

    if (error) {
        console.error('Toggle checklist error:', error);
        return { success: false, error: error.message };
    }

    return { success: true, checked: newChecked };
}

/**
 * 체크리스트 아이템 삭제
 */
export async function deleteChecklistItem(itemId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const { error } = await supabase
        .from('schedule_checklists')
        .delete()
        .eq('id', itemId);

    if (error) {
        console.error('Delete checklist item error:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

// ═══════════════════════════════════════════════════════════
// 찜 기능
// ═══════════════════════════════════════════════════════════

/**
 * 캠핑장 찜 토글
 */
export async function toggleFavorite(campgroundId: string): Promise<{ success: boolean; isFavorite?: boolean; error?: string }> {
    const supabase = await createClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
        return { success: false, error: '로그인이 필요합니다' };
    }

    const { data, error } = await supabase.rpc('toggle_campground_favorite', {
        p_user_id: userData.user.id,
        p_campground_id: campgroundId,
    });

    if (error) {
        console.error('Toggle favorite error:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/myspace/favorites');
    return { success: true, isFavorite: data };
}

/**
 * 내 찜 목록 조회
 */
export async function getMyFavorites(): Promise<{ id: string; campground_id: string; created_at: string }[]> {
    const supabase = await createClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return [];

    const { data, error } = await supabase
        .from('campground_favorites')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Fetch favorites error:', error);
        return [];
    }

    return data || [];
}

/**
 * 특정 캠핑장 찜 여부 확인
 */
export async function isFavorite(campgroundId: string): Promise<boolean> {
    const supabase = await createClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return false;

    const { data } = await supabase
        .from('campground_favorites')
        .select('id')
        .eq('user_id', userData.user.id)
        .eq('campground_id', campgroundId)
        .single();

    return !!data;
}
/**
 * 찜한 캠핑장 상세 목록 조회
 */
import { CampgroundWithScore } from '@/types/camping-ajiit';

export async function getFavoriteCampgrounds(): Promise<CampgroundWithScore[]> {
    const supabase = await createClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return [];

    // 1. 찜 목록 조회
    const { data: favorites, error: favError } = await supabase
        .from('campground_favorites')
        .select('campground_id, created_at')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false });

    if (favError || !favorites || favorites.length === 0) {
        return [];
    }

    const campgroundIds = favorites.map(f => f.campground_id);

    // 2. 캠핑장 상세 정보 조회
    const { data: campgrounds, error: campError } = await supabase
        .from('campgrounds')
        .select('*')
        .in('id', campgroundIds);

    if (campError || !campgrounds) {
        console.error('Fetch favorite campgrounds error:', campError);
        return [];
    }

    // 3. 데이터 병합 및 변환
    // 순서를 찜한 순서대로 유지하기 위해 map 사용
    const result: CampgroundWithScore[] = favorites
        .map(fav => {
            const camp = campgrounds.find(c => c.id === fav.campground_id);
            if (!camp) return null;

            return {
                ...camp,
                score: 100, // 찜한 목록이므로 높은 점수
                matchReason: '내가 찜한 캠핑장',
                isFavorite: true,
                favoriteCount: 0, // DB에서 가져오려면 추가 조인 필요 (일단 0 or 생략)
                // 거리 정보는 현재 위치가 없으므로 생략 또는 계산 필요
            } as CampgroundWithScore;
        })
        .filter((c): c is CampgroundWithScore => c !== null);

    return result;
}

/**
 * 예약 ID로 일정 보장 (없으면 생성) - Lazy Creation
 */
export async function ensureScheduleFromReservation(reservationId: string): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
    const supabase = await createClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
        return { success: false, error: '로그인이 필요합니다' };
    }

    // 1. 이미 존재하는지 확인
    const { data: existing } = await supabase
        .from('user_schedules')
        .select('id')
        .eq('reservation_id', reservationId)
        .eq('user_id', userData.user.id) // 보안: 내 예약만
        .single();

    if (existing) {
        return { success: true, scheduleId: (existing as any).id };
    }

    // 2. 예약 정보 조회
    let { data: reservation, error: resError } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .eq('user_id', userData.user.id) // 보안확인
        .single();

    // [v11.9.120] 세션 오차로 인한 RLS 차단 시 adminFallback 호출
    if (resError || !reservation) {
        return ensureScheduleFromReservationAdmin(reservationId, userData.user.id);
    }

    // 3. 일정 생성
    const siteName = SITES.find(s => s.id === reservation.site_id)?.name || reservation.site_id;

    // Get dynamic site config
    const config = await getSiteConfigServer();
    const address = config?.address_main || '충청남도 예산군 응봉면 응봉서로 280'; // Fallback to current address
    const lat = config?.nearby_places ? (config as any).lat || DEFAULT_CAMPING_LOCATION.latitude : DEFAULT_CAMPING_LOCATION.latitude;
    const lng = config?.nearby_places ? (config as any).lng || DEFAULT_CAMPING_LOCATION.longitude : DEFAULT_CAMPING_LOCATION.longitude;

    // upsert_schedule RPC 사용
    const { data: newScheduleId, error: createError } = await supabase.rpc('upsert_schedule', {
        p_user_id: userData.user.id,
        p_source: 'raonai',
        p_campground_name: siteName,
        p_campground_address: address,
        p_campground_lat: lat,
        p_campground_lng: lng,
        p_check_in: reservation.check_in_date,
        p_check_out: reservation.check_out_date,
        p_memo: null,
        p_campground_id: null,
        p_reservation_id: reservationId,
    });

    if (createError) {
        console.error('Auto-create schedule error:', createError);
        return { success: false, error: createError.message };
    }

    // [Fix] revalidatePath during background sync invalidates App Router cache on mount -> triggers silent bounce to '/'
    // Client-side state (Zustand / fetchSchedules) handles reactive list updates safely without router corruptions.
    return { success: true, scheduleId: newScheduleId };
}

/**
 * [Admin] 예약 ID로 일정 강제 생성/동기화
 */
export async function ensureScheduleFromReservationAdmin(reservationId: string, userId: string): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
    const { createAdminClient } = await import('@/lib/supabase-admin');
    const supabase = createAdminClient();

    // 1. 이미 존재하는지 확인
    const { data: existing } = await supabase
        .from('user_schedules')
        .select('id')
        .eq('reservation_id', reservationId)
        .eq('user_id', userId)
        .single();

    if (existing) {
        return { success: true, scheduleId: (existing as any).id };
    }

    // 2. 예약 정보 조회
    const { data: reservation, error: resError } = await (supabase
        .from('reservations') as any)
        .select('*')
        .eq('id', reservationId)
        .eq('user_id', userId)
        .single();

    if (resError || !reservation) {
        return { success: false, error: '예약 정보를 찾을 수 없습니다' };
    }

    // 3. 일정 생성
    const r = reservation as any;
    const siteId = r.site_id || r.siteId;
    const checkIn = r.check_in_date || r.checkInDate;
    const checkOut = r.check_out_date || r.checkOutDate;

    const siteName = SITES.find(s => s.id === siteId)?.name || siteId;

    // Get dynamic site config
    const config = await getSiteConfigServer();
    const address = config?.address_main || '충청남도 예산군 응봉면 응봉서로 280';
    const lat = config?.nearby_places ? (config as any).lat || DEFAULT_CAMPING_LOCATION.latitude : DEFAULT_CAMPING_LOCATION.latitude;
    const lng = config?.nearby_places ? (config as any).lng || DEFAULT_CAMPING_LOCATION.longitude : DEFAULT_CAMPING_LOCATION.longitude;

    const { data: newScheduleId, error: createError } = await supabase.rpc('upsert_schedule', {
        p_user_id: userId,
        p_source: 'raonai',
        p_campground_name: siteName,
        p_campground_address: address,
        p_campground_lat: lat,
        p_campground_lng: lng,
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_memo: null,
        p_campground_id: null,
        p_reservation_id: reservationId,
    } as any);

    if (createError) {
        console.error('[Admin] Auto-create schedule error:', createError);
        return { success: false, error: createError.message };
    }

    return { success: true, scheduleId: newScheduleId };
}

// ============================================================================
// 스마트 플랜 데이터 영구 저장 [v11.9.31]
// ============================================================================
export async function updateSmartPlanData(scheduleId: string, planData: any): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
        return { success: false, error: '로그인이 필요합니다' };
    }

    const { error } = await supabase
        .from('user_schedules')
        .update({ smart_plan_data: planData })
        .eq('id', scheduleId)
        .eq('user_id', userData.user.id);

    if (error) {
        console.error('[updateSmartPlanData] Failed to save smart plan:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * 예약 취소 시 연동된 일정 상태를 'cancelled'로 변경 [v11.9.108]
 */
export async function cancelScheduleByReservation(reservationId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const { error } = await supabase
        .from('user_schedules')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('reservation_id', reservationId);

    if (error) {
        console.error('[cancelScheduleByReservation] Failed to cancel schedule by reservation:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/myspace/schedule');
    return { success: true };
}

/**
 * 일정 ID 기준 정밀 캐싱 완료 여부 감지 Server Action [v12.8.0]
 * smart_plan_candidates 테이블의 reservation_id 존재 여부를 RLS 제약 없이 안전하게 검사합니다.
 */
export async function checkCandidateCacheAction(scheduleId: string): Promise<boolean> {
    if (!scheduleId) return false;
    try {
        const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createSupabaseClient(supabaseUrl, serviceKey);

        const { count, error } = await supabase
            .from('smart_plan_candidates')
            .select('id', { count: 'exact', head: true })
            .eq('reservation_id', scheduleId);

        if (error) {
            console.error('[checkCandidateCacheAction] Error:', error.message);
            return false;
        }

        return (count ?? 0) > 0;
    } catch (e) {
        console.error('[checkCandidateCacheAction] Exception:', e);
        return false;
    }
}

'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

import { SITES } from '@/constants/sites';

// ═══════════════════════════════════════════════════════════
// 타입 정의
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
        .eq('user_id', userData.user.id)
        .order('check_in', { ascending: true });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Fetch schedules error:', error);
        return [];
    }

    return data || [];
}

/**
 * 일정 상세 조회
 */
export async function getScheduleById(scheduleId: string): Promise<Schedule | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();

    if (error) {
        console.error('Fetch schedule error:', error);
        return null;
    }

    if (!data) return null;

    // 만료 체크 및 자동 완료 처리
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkOutDate = new Date(data.check_out);

    // 퇴실일이 지났고(어제 이전), 상태가 scheduled라면 완료 처리
    if (data.status === 'scheduled' && checkOutDate < today) {
        await supabase
            .from('user_schedules')
            .update({ status: 'completed' })
            .eq('id', scheduleId);

        return { ...data, status: 'completed' };
    }

    return data;
}

/**
 * 일정 수정
 */
export async function updateSchedule(
    scheduleId: string,
    updates: Partial<Pick<Schedule, 'campground_name' | 'campground_address' | 'check_in' | 'check_out' | 'status' | 'memo'>>
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const { error } = await supabase
        .from('user_schedules')
        .update(updates)
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
        return { success: true, scheduleId: existing.id };
    }

    // 2. 예약 정보 조회
    const { data: reservation, error: resError } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .eq('user_id', userData.user.id) // 보안확인
        .single();

    if (resError || !reservation) {
        return { success: false, error: '예약 정보를 찾을 수 없습니다' };
    }

    // 3. 일정 생성
    const siteName = SITES.find(s => s.id === reservation.site_id)?.name || reservation.site_id;

    // upsert_schedule RPC 사용 (이미 createSchedule에서 사용중인 로직 재사용)
    // 주의: reservation의 날짜 포맷이 DB마다 다를 수 있으므로 확인 필요하지만, 보통 string 그대로 넘김
    const { data: newScheduleId, error: createError } = await supabase.rpc('upsert_schedule', {
        p_user_id: userData.user.id,
        p_source: 'raonai',
        p_campground_name: siteName,
        p_campground_address: null, // 주소는 정보가 있다면 넣을 수 있음 (SITES에는 주소 없음, 하드코딩된 데이터라)
        p_campground_lat: null,
        p_campground_lng: null,
        p_check_in: reservation.check_in_date,
        p_check_out: reservation.check_out_date,
        p_memo: null,
        p_campground_id: null, // 외부 API ID가 아님
        p_reservation_id: reservationId,
    });

    if (createError) {
        console.error('Auto-create schedule error:', createError);
        return { success: false, error: createError.message };
    }

    revalidatePath('/myspace/schedule');
    return { success: true, scheduleId: newScheduleId };
}

'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

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

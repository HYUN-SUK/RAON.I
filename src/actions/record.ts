'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

// ═══════════════════════════════════════════════════════════
// 타입 정의
// ═══════════════════════════════════════════════════════════

export interface CampingRecord {
    id: string;
    user_id: string;
    schedule_id?: string;
    content: string;
    photo_url?: string;
    tags: string[];
    is_public: boolean;
    campground_type: 'raonai' | 'external';
    campground_name?: string;
    campground_address?: string;
    latitude?: number;
    longitude?: number;
    created_at: string;
}

export interface CreateRecordInput {
    scheduleId?: string;
    content: string;
    photoUrl?: string;
    tags?: string[];
    isPublic?: boolean;
    campgroundType?: 'raonai' | 'external';
    campgroundName?: string;
    campgroundAddress?: string;
    latitude?: number;
    longitude?: number;
}

// ═══════════════════════════════════════════════════════════
// 1분 기록 CRUD
// ═══════════════════════════════════════════════════════════

// 기록 생성
export async function createRecord(input: CreateRecordInput): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: '로그인이 필요합니다' };
        }

        // 사용자 선택 태그 + 자동 추출 태그 병합
        const autoTags = extractTags(input.content);
        const allTags = [...new Set([...(input.tags || []), ...autoTags])];

        const { data, error } = await supabase
            .from('camping_records')
            .insert({
                user_id: user.id,
                schedule_id: input.scheduleId || null,
                content: input.content,
                photo_url: input.photoUrl || null,
                tags: allTags,
                is_public: input.isPublic ?? false,
                campground_type: input.campgroundType ?? 'external',
                campground_name: input.campgroundName || null,
                campground_address: input.campgroundAddress || null,
                latitude: input.latitude || null,
                longitude: input.longitude || null,
            })
            .select('id')
            .single();

        if (error) {
            console.error('Create record error:', error);
            return { success: false, error: '기록 저장에 실패했어요' };
        }

        revalidatePath('/myspace');
        revalidatePath('/myspace/records');
        return { success: true, id: data.id };
    } catch (error) {
        console.error('Create record error:', error);
        return { success: false, error: '오류가 발생했어요' };
    }
}

// 내 기록 목록 조회
export async function getMyRecords(limit = 20, offset = 0): Promise<CampingRecord[]> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return [];

        const { data, error } = await supabase
            .from('camping_records')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('Get records error:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Get records error:', error);
        return [];
    }
}

// 캠핑장 방문 횟수 조회 (URL Search Params like)
export async function getVisitCount(campgroundName: string): Promise<number> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user || !campgroundName) return 0;

        // 이름으로 시작하는 기록 검색 (예: "난지" -> "난지", "난지 (2)", "난지 (3)")
        const { count, error } = await supabase
            .from('camping_records')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .ilike('campground_name', `${campgroundName}%`);

        if (error) {
            console.error('Count error:', error);
            return 0;
        }

        return count || 0;
    } catch (error) {
        console.error('Count error:', error);
        return 0;
    }
}

// 기록 삭제
export async function deleteRecord(recordId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: '로그인이 필요합니다' };
        }

        const { error } = await supabase
            .from('camping_records')
            .delete()
            .eq('id', recordId)
            .eq('user_id', user.id);

        if (error) {
            console.error('Delete record error:', error);
            return { success: false, error: '삭제에 실패했어요' };
        }

        revalidatePath('/myspace');
        revalidatePath('/myspace/records');
        return { success: true };
    } catch (error) {
        console.error('Delete record error:', error);
        return { success: false, error: '오류가 발생했어요' };
    }
}

// ═══════════════════════════════════════════════════════════
// 헬퍼 함수
// ═══════════════════════════════════════════════════════════

// 간단한 태그 자동 추출 (키워드 기반)
function extractTags(content: string): string[] {
    const tags: string[] = [];
    const lowerContent = content.toLowerCase();

    // 날씨 관련
    if (lowerContent.includes('날씨') || lowerContent.includes('맑') || lowerContent.includes('비') || lowerContent.includes('흐림')) {
        tags.push('날씨');
    }
    // 음식 관련
    if (lowerContent.includes('음식') || lowerContent.includes('요리') || lowerContent.includes('바베큐') || lowerContent.includes('삼겹') || lowerContent.includes('고기')) {
        tags.push('음식');
    }
    // 활동 관련
    if (lowerContent.includes('하이킹') || lowerContent.includes('산책') || lowerContent.includes('놀이') || lowerContent.includes('물놀이')) {
        tags.push('활동');
    }
    // 풍경/자연 관련
    if (lowerContent.includes('풍경') || lowerContent.includes('노을') || lowerContent.includes('별') || lowerContent.includes('산') || lowerContent.includes('강')) {
        tags.push('풍경');
    }
    // 가족/친구 관련
    if (lowerContent.includes('가족') || lowerContent.includes('아이') || lowerContent.includes('친구') || lowerContent.includes('커플')) {
        tags.push('함께');
    }
    // 장비 관련
    if (lowerContent.includes('텐트') || lowerContent.includes('장비') || lowerContent.includes('의자') || lowerContent.includes('불멍')) {
        tags.push('장비');
    }

    return tags;
}

// 이미지 업로드
export async function uploadRecordImage(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: '로그인이 필요합니다' };
        }

        // 파일 이름 생성 (유니크)
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('records')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return { success: false, error: '이미지 업로드에 실패했어요' };
        }

        // Public URL 가져오기
        const { data: { publicUrl } } = supabase.storage
            .from('records')
            .getPublicUrl(fileName);

        return { success: true, url: publicUrl };
    } catch (error) {
        console.error('Upload error:', error);
        return { success: false, error: '오류가 발생했어요' };
    }
}

// ═══════════════════════════════════════════════════════════
// 후기게시판용 - 공개 기록 조회
// ═══════════════════════════════════════════════════════════

export async function getPublicRecords(
    campgroundType?: 'raonai' | 'external' | 'all',
    limit = 20,
    offset = 0
): Promise<CampingRecord[]> {
    try {
        const supabase = await createClient();

        let query = supabase
            .from('camping_records')
            .select('*')
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (campgroundType && campgroundType !== 'all') {
            query = query.eq('campground_type', campgroundType);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Get public records error:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Get public records error:', error);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════
// FAB 반짝임 판단용 - 미작성 일정 기록 확인
// ═══════════════════════════════════════════════════════════

export async function hasUnwrittenScheduleRecord(): Promise<{
    hasUnwritten: boolean;
    scheduleIds: string[];
}> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { hasUnwritten: false, scheduleIds: [] };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. 이용중 또는 완료된 일정 조회 (오늘 이전 또는 오늘 포함)
        const { data: schedules } = await supabase
            .from('user_schedules')
            .select('id, start_date, end_date')
            .eq('user_id', user.id)
            .lte('start_date', today.toISOString());

        if (!schedules || schedules.length === 0) {
            return { hasUnwritten: false, scheduleIds: [] };
        }

        // 2. 해당 일정들에 대해 작성된 기록 ID 조회
        const scheduleIds = schedules.map(s => s.id);
        const { data: existingRecords } = await supabase
            .from('camping_records')
            .select('schedule_id')
            .eq('user_id', user.id)
            .in('schedule_id', scheduleIds);

        const writtenScheduleIds = new Set(
            (existingRecords || []).map(r => r.schedule_id)
        );

        // 3. 미작성 일정 필터링
        const unwrittenScheduleIds = scheduleIds.filter(
            id => !writtenScheduleIds.has(id)
        );

        return {
            hasUnwritten: unwrittenScheduleIds.length > 0,
            scheduleIds: unwrittenScheduleIds,
        };
    } catch (error) {
        console.error('hasUnwrittenScheduleRecord error:', error);
        return { hasUnwritten: false, scheduleIds: [] };
    }
}

// 특정 일정의 상세 정보 가져오기 (캠핑장 정보 포함)
export async function getScheduleForRecord(scheduleId: string): Promise<{
    id: string;
    title: string;
    campgroundName?: string;
    campgroundAddress?: string;
    latitude?: number;
    longitude?: number;
    isRaonai: boolean;
    startDate: string;
    endDate: string;
} | null> {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('user_schedules')
            .select('*')
            .eq('id', scheduleId)
            .single();

        if (error || !data) {
            return null;
        }

        // RAONAI 캠핑장인지 판단 (source가 'raonai' 또는 이름에 '라온아이' 포함)
        const isRaonai = data.source === 'raonai' ||
            (data.title || '').toLowerCase().includes('라온아이');

        return {
            id: data.id,
            title: data.title || '',
            campgroundName: data.title || data.campground_name,
            campgroundAddress: data.address || data.campground_address,
            latitude: data.latitude,
            longitude: data.longitude,
            isRaonai,
            startDate: data.start_date,
            endDate: data.end_date,
        };
    } catch (error) {
        console.error('getScheduleForRecord error:', error);
        return null;
    }
}

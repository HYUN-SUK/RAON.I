'use server';

import { createAdminClient } from '@/lib/supabase-admin';

export interface PublicSmartPlanData {
    id: string;
    campground_name: string;
    campground_address?: string;
    campground_lat?: number;
    campground_lng?: number;
    check_in: string;
    check_out: string;
    smart_plan_data?: any;
}

export interface PublicRecordData {
    id: string;
    created_at: string;
    image_url?: string;
    healing_phrase?: string;
    content?: string;
    location_name?: string;
    user_nickname?: string;
}

/**
 * [퍼블릭 공유 뷰어 전용] 스마트플랜 데이터 조회
 * RLS 가드를 안전하게 우회하되 개인 메모, 체크리스트, 결제 정보 등 개인정보는 완전 배제하고
 * 스마트플랜 렌더링에 필요한 공개 정보만 정제하여 반환합니다.
 */
export async function getPublicSmartPlan(scheduleId: string): Promise<PublicSmartPlanData | null> {
    if (!scheduleId) return null;

    try {
        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from('user_schedules')
            .select('id, campground_name, campground_address, campground_lat, campground_lng, check_in, check_out, smart_plan_data')
            .eq('id', scheduleId)
            .maybeSingle();

        if (error || !data) {
            console.error('[ShareAction] getPublicSmartPlan error:', error);
            return null;
        }

        return data as PublicSmartPlanData;
    } catch (err) {
        console.error('[ShareAction] getPublicSmartPlan exception:', err);
        return null;
    }
}

/**
 * [퍼블릭 공유 뷰어 전용] 내 기록 / 10초 기록 데이터 조회
 */
export async function getPublicRecord(recordId: string): Promise<PublicRecordData | null> {
    if (!recordId) return null;

    try {
        const supabase = createAdminClient();
        
        // 1차: community_posts (기록 게시물) 조회
        const { data: postData, error: postError } = await supabase
            .from('community_posts')
            .select('id, created_at, content, images, author_nickname, location_name, metadata')
            .eq('id', recordId)
            .maybeSingle();

        if (postData && !postError) {
            const rawPost = postData as any;
            const images = rawPost.images || [];
            return {
                id: rawPost.id,
                created_at: rawPost.created_at,
                image_url: images.length > 0 ? images[0] : undefined,
                content: rawPost.content,
                healing_phrase: rawPost.metadata?.healing_phrase || rawPost.content,
                location_name: rawPost.location_name || '아지트 기록',
                user_nickname: rawPost.author_nickname || '라온아이 캠퍼'
            };
        }

        // 2차: user_records (아지트 핀 기록) 조회
        const { data: recordData, error: recordError } = await supabase
            .from('user_records')
            .select('id, created_at, photo_url, healing_phrase, memo, location_name')
            .eq('id', recordId)
            .maybeSingle();

        if (recordData && !recordError) {
            const rawRecord = recordData as any;
            return {
                id: rawRecord.id,
                created_at: rawRecord.created_at,
                image_url: rawRecord.photo_url,
                healing_phrase: rawRecord.healing_phrase || rawRecord.memo,
                content: rawRecord.memo,
                location_name: rawRecord.location_name || '나의 아지트'
            };
        }

        return null;
    } catch (err) {
        console.error('[ShareAction] getPublicRecord exception:', err);
        return null;
    }
}

'use server';

import { generateInstantSmartPlan, StandardizedPlanJSON } from '@/lib/smartPlan';
import { createSchedule, updateSmartPlanData } from '@/actions/schedule';
import { saveCampingProfile, CampingProfile } from '@/actions/camping-profile';
import { createClient } from '@/lib/supabase-server';

/**
 * 내 주변 5km 실시간 맛집·명소 데이터 조회 (Server Action)
 */
export async function getNearbyPlacesAction(params: {
    lat: number;
    lng: number;
    radiusKm?: number;
}): Promise<{ success: boolean; data?: StandardizedPlanJSON; error?: string }> {
    try {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const plan = await generateInstantSmartPlan(
            { lat: params.lat, lng: params.lng },
            today,
            tomorrow
        );

        return { success: true, data: plan };
    } catch (err: any) {
        console.error('[getNearbyPlacesAction] Error:', err);
        return { success: false, error: err.message || '장소를 조회하는데 실패했습니다.' };
    }
}

/**
 * 즉시 여행계획 생성 (Server Action)
 */
export async function generateInstantPlanAction(params: {
    targetLat: number;
    targetLng: number;
    targetName: string;
    targetDate?: string;
    stayDays?: number;
}): Promise<{ success: boolean; data?: StandardizedPlanJSON; error?: string }> {
    try {
        const startDate = params.targetDate ? new Date(params.targetDate) : new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (params.stayDays || 1));

        const plan = await generateInstantSmartPlan(
            { lat: params.targetLat, lng: params.targetLng },
            startDate,
            endDate
        );

        return { success: true, data: plan };
    } catch (err: any) {
        console.error('[generateInstantPlanAction] Error:', err);
        return { success: false, error: err.message || '즉시 여행계획을 생성하는데 실패했습니다.' };
    }
}

/**
 * 즉시 여행계획을 내 일정으로 저장 (Server Action)
 * - 사용자 로그인 확인
 * - 프로필(출발지/인원) 저장 및 갱신
 * - user_schedules 등록
 * - smart_plan_data 저장
 */
export async function saveInstantPlanToScheduleAction(params: {
    campgroundName: string;
    campgroundAddress?: string;
    campgroundLat: number;
    campgroundLng: number;
    checkIn: string; // YYYY-MM-DD
    checkOut: string; // YYYY-MM-DD
    planData: StandardizedPlanJSON;
    profile?: Partial<CampingProfile>;
}): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { success: false, error: '일정을 저장하려면 로그인이 필요합니다.' };
        }

        // 1. 프로필 정보가 전달된 경우 저장/갱신
        if (params.profile) {
            await saveCampingProfile({
                originLabel: params.profile.originLabel || null,
                originLat: params.profile.originLat ?? null,
                originLng: params.profile.originLng ?? null,
                adults: params.profile.adults ?? 2,
                seniors: params.profile.seniors ?? 0,
                kidsPreschool: params.profile.kidsPreschool ?? 0,
                kidsElementary: params.profile.kidsElementary ?? 0,
                kidsTeen: params.profile.kidsTeen ?? 0,
                hasPet: params.profile.hasPet ?? false,
            });
        }

        // 2. 일정 생성 (외부/독립 일정으로 생성)
        const schedRes = await createSchedule({
            source: 'external',
            campgroundName: params.campgroundName,
            campgroundAddress: params.campgroundAddress,
            campgroundLat: params.campgroundLat,
            campgroundLng: params.campgroundLng,
            checkIn: params.checkIn,
            checkOut: params.checkOut,
            memo: '⚡ 즉시 여행계획으로 등록된 일정입니다.',
        });

        if (!schedRes.success || !schedRes.id) {
            return { success: false, error: schedRes.error || '일정 생성에 실패했습니다.' };
        }

        // 3. 생성된 일정에 스마트플랜 데이터 연동
        await updateSmartPlanData(schedRes.id, params.planData);

        return { success: true, scheduleId: schedRes.id };
    } catch (err: any) {
        console.error('[saveInstantPlanToScheduleAction] Error:', err);
        return { success: false, error: err.message || '일정 저장 중 오류가 발생했습니다.' };
    }
}

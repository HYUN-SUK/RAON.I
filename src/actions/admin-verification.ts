'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

const DEFAULT_PARTNER_ID = 'a0000000-0000-0000-0000-000000000001';

export interface VerificationScheduleItem {
    id: string;
    userId: string;
    userName?: string;
    userPhone?: string;
    title: string;
    checkInDate: string;
    checkOutDate: string;
    siteName?: string;
    hasPlan: boolean;
    verificationCount: number;
}

export interface FactCardForVerification {
    id: string;
    name: string;
    category: string;
    stage: 'GOING' | 'RETURNING' | 'DESTINATION' | string;
    stageName: string;
    address?: string;
    distanceKm?: number;
    trustScore?: number;
    missCount?: number;
    isActive?: boolean;
    description?: string;
    hours?: string;
    // 기존에 검증된 데이터가 있는 경우
    existingVerification?: {
        visited?: boolean;
        factStatus?: string;
        skipReason?: string;
        factNote?: string;
    };
}

export interface VerificationInputItem {
    placeId: string;
    stage: string;
    visited?: boolean;
    liked?: boolean;
    factStatus?: 'OK' | 'TEMP_CLOSED' | 'GONE' | 'HOURS_WRONG' | 'NOT_FOUND' | null;
    skipReason?: 'TOO_FAR' | 'NOT_INTERESTED' | 'ALREADY_KNOWN' | 'WEATHER' | 'NO_TIME' | 'OTHER' | null;
    factNote?: string;
    distanceKm?: number;
}

/**
 * 1. 팩트 검증 대상 일정 목록 조회 (최근 60일 이내 완료 및 이용 중 일정)
 */
export async function getSchedulesForVerification(): Promise<{ success: boolean; data: VerificationScheduleItem[]; error?: string }> {
    try {
        const supabase = await createClient();

        // 1) 최근 일정 조회
        const { data: schedules, error: schedErr } = await supabase
            .from('user_schedules')
            .select(`
                id,
                user_id,
                title,
                check_in_date,
                check_out_date,
                status,
                smart_plan_data,
                profiles:user_id ( full_name, phone_number ),
                reservations:reservation_id ( site_name )
            `)
            .order('check_in_date', { ascending: false })
            .limit(50);

        if (schedErr) {
            console.error('getSchedulesForVerification error:', schedErr);
            return { success: false, data: [], error: schedErr.message };
        }

        const scheduleIds = (schedules || []).map(s => s.id);

        // 2) 기존 검증 건수 확인
        const { data: verifList } = await supabase
            .from('place_verifications')
            .select('schedule_id')
            .in('schedule_id', scheduleIds);

        const verifCountMap = new Map<string, number>();
        (verifList || []).forEach(v => {
            if (v.schedule_id) {
                verifCountMap.set(v.schedule_id, (verifCountMap.get(v.schedule_id) || 0) + 1);
            }
        });

        const items: VerificationScheduleItem[] = (schedules || []).map(s => {
            const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
            const resv = Array.isArray(s.reservations) ? s.reservations[0] : s.reservations;

            return {
                id: s.id,
                userId: s.user_id,
                userName: profile?.full_name || '익명 캠퍼',
                userPhone: profile?.phone_number || '',
                title: s.title || `${s.check_in_date} 캠핑 일정`,
                checkInDate: s.check_in_date,
                checkOutDate: s.check_out_date,
                siteName: resv?.site_name || '',
                hasPlan: !!s.smart_plan_data,
                verificationCount: verifCountMap.get(s.id) || 0,
            };
        });

        return { success: true, data: items };
    } catch (e: any) {
        console.error('getSchedulesForVerification unexpected error:', e);
        return { success: false, data: [], error: e.message };
    }
}

/**
 * 2. 특정 일정의 활성 카드 11개 추출 및 마스터 데이터 결합
 */
export async function getScheduleFactCards(scheduleId: string): Promise<{ success: boolean; data: FactCardForVerification[]; error?: string }> {
    try {
        const supabase = await createClient();

        // 1) user_schedules에서 스마트플랜 데이터 조회
        const { data: schedule, error: schedErr } = await supabase
            .from('user_schedules')
            .select('id, smart_plan_data')
            .eq('id', scheduleId)
            .single();

        if (schedErr || !schedule || !schedule.smart_plan_data) {
            return { success: false, data: [], error: '스마트플랜 데이터가 존재하지 않습니다.' };
        }

        const rawData = schedule.smart_plan_data;
        const plan = rawData.wrapped ? (rawData.ai_plan || rawData) : rawData;


        // 2) 11개 활성 카드 수집 (목적지 5개 + 가는길 3개 + 귀갓길 3개)
        const extracted: Array<{ card: any; stage: string; stageName: string }> = [];

        // 가는 길 (Track B / Stage 2) - 3개
        if (plan.routeListElement && Array.isArray(plan.routeListElement)) {
            plan.routeListElement.forEach((c: any) => {
                extracted.push({ card: c, stage: 'GOING', stageName: 'Stage 2. 가는 길' });
            });
        }

        // 목적지 주변 (Track A / Stage 3) - 5개
        if (plan.itemListElement && Array.isArray(plan.itemListElement)) {
            plan.itemListElement.forEach((c: any) => {
                extracted.push({ card: c, stage: 'DESTINATION', stageName: 'Stage 3. 목적지 주변' });
            });
        }

        // 귀갓길 (Stage 5) - 3개
        if (plan.returnListElement && Array.isArray(plan.returnListElement)) {
            plan.returnListElement.forEach((c: any) => {
                extracted.push({ card: c, stage: 'RETURNING', stageName: 'Stage 5. 귀갓길' });
            });
        }

        // 3) master_places에서 실시간 miss_count, is_active, 설명, 영업시간 등 조회
        const placeIds = extracted.map(item => item.card.id).filter(Boolean);
        const { data: masterList } = await supabase
            .from('master_places')
            .select('id, miss_count, is_active, description, business_hours, address_road, address_jibun')
            .in('id', placeIds);

        const masterMap = new Map<string, any>();
        (masterList || []).forEach(m => masterMap.set(m.id, m));

        // 4) 기존 입력된 검증 데이터 조회
        const { data: existingVerifs } = await supabase
            .from('place_verifications')
            .select('place_id, stage, visited, fact_status, skip_reason, fact_note')
            .eq('schedule_id', scheduleId);

        const verifMap = new Map<string, any>();
        (existingVerifs || []).forEach(v => verifMap.set(`${v.place_id}_${v.stage}`, v));

        // 5) 최종 카드 목록 매핑
        const result: FactCardForVerification[] = extracted.map(item => {
            const c = item.card;
            const m = masterMap.get(c.id);
            const v = verifMap.get(`${c.id}_${item.stage}`);

            return {
                id: c.id,
                name: c.name,
                category: c.category,
                stage: item.stage,
                stageName: item.stageName,
                address: m?.address_road || m?.address_jibun || c.metadata?.address || c.metadata?.addr || '',
                distanceKm: c.distanceKm || c.distance,
                trustScore: c.trustScore,
                missCount: m?.miss_count ?? 0,
                isActive: m?.is_active ?? true,
                description: m?.description || c.description || '',
                hours: m?.business_hours || c.metadata?.hours || '',
                existingVerification: v ? {
                    visited: v.visited,
                    factStatus: v.fact_status,
                    skipReason: v.skip_reason,
                    factNote: v.fact_note,
                } : undefined,
            };
        });

        return { success: true, data: result };
    } catch (e: any) {
        console.error('getScheduleFactCards unexpected error:', e);
        return { success: false, data: [], error: e.message };
    }
}

/**
 * 3. 사업주 대면 팩트 검증 데이터 제출 및 실시간 master_places 동기화 (1.0 가중치)
 */
export async function submitOwnerVerifications(
    scheduleId: string,
    verifications: VerificationInputItem[]
): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const supabase = await createClient();

        // 1) 일정 정보 확인 (관측 일자 및 요일 추출)
        const { data: schedule } = await supabase
            .from('user_schedules')
            .select('id, user_id, check_in_date, check_out_date')
            .eq('id', scheduleId)
            .single();

        const observedDate = schedule?.check_in_date || new Date().toISOString().split('T')[0];
        const observedDow = new Date(observedDate).getDay(); // 0:일 ~ 6:토
        const userId = schedule?.user_id || null;

        const recordsToInsert = [];
        const placesToDeactivate: string[] = [];
        const placesToResetStrike: string[] = [];

        for (const item of verifications) {
            // 아무런 선택도 하지 않은 카드는 건너뜀 (NULL 유지 원칙)
            if (item.visited === undefined && !item.factStatus && !item.skipReason && !item.factNote) {
                continue;
            }

            const record = {
                partner_id: DEFAULT_PARTNER_ID,
                schedule_id: scheduleId,
                place_id: item.placeId,
                user_id: userId,
                stage: item.stage,
                visited: item.visited ?? null,
                liked: item.liked ?? (item.visited === true && item.factStatus === 'OK' ? true : false),
                skip_reason: item.visited === false ? (item.skipReason || null) : null,
                fact_status: item.visited === true ? (item.factStatus || 'OK') : null,
                fact_note: item.factNote || null,
                observed_at: observedDate,
                observed_dow: observedDow,
                distance_km: item.distanceKm || null,
                source: 'OWNER_INTERVIEW',
                entry_point: 'admin_interview',
                evidence: 'OWNER_INTERVIEW',
                reporter_weight: 1.0,
                review_state: 'APPLIED',
                applied_at: new Date().toISOString(),
                verified_at: new Date().toISOString(),
            };

            recordsToInsert.push(record);

            // [루프 동기화 1] 사업주가 GONE(폐업/간판없음) 확인 시 즉시 비활성화
            if (item.factStatus === 'GONE') {
                placesToDeactivate.push(item.placeId);
            }
            // [루프 동기화 2] 사업주가 방문 확인(OK) 또는 정상 영업 확인 시 miss_count 리셋
            else if (item.factStatus === 'OK' || (item.visited === true && !item.factStatus)) {
                placesToResetStrike.push(item.placeId);
            }
        }

        if (recordsToInsert.length === 0) {
            return { success: false, error: '저장할 검증 항목이 선택되지 않았습니다.' };
        }

        // 2) 기존 해당 일정의 검증 데이터 정리 후 재인서트
        await supabase
            .from('place_verifications')
            .delete()
            .eq('schedule_id', scheduleId)
            .eq('source', 'OWNER_INTERVIEW');

        const { error: insertErr } = await supabase
            .from('place_verifications')
            .insert(recordsToInsert);

        if (insertErr) {
            console.error('submitOwnerVerifications insert error:', insertErr);
            return { success: false, error: insertErr.message };
        }

        // 3) master_places 폐업(is_active=false) 및 place_history 반영
        if (placesToDeactivate.length > 0) {
            await supabase
                .from('master_places')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .in('id', placesToDeactivate);

            // place_history 기록
            const historyInserts = placesToDeactivate.map(pid => ({
                place_id: pid,
                event: 'DEACTIVATED',
                reason: 'OWNER_INTERVIEW_REPORTED_GONE',
                source: 'OWNER_INTERVIEW',
                created_at: new Date().toISOString()
            }));
            const { error: histErr1 } = await supabase.from('place_history').insert(historyInserts);
            if (histErr1) console.warn('place_history deactivate error:', histErr1.message);
        }

        // 4) master_places 스트라이크 리셋(miss_count=0) 및 place_history 반영
        if (placesToResetStrike.length > 0) {
            await supabase
                .from('master_places')
                .update({ miss_count: 0, updated_at: new Date().toISOString() })
                .in('id', placesToResetStrike);

            const resetInserts = placesToResetStrike.map(pid => ({
                place_id: pid,
                event: 'STRIKE_RESET',
                reason: 'OWNER_INTERVIEW_VERIFIED_ACTIVE',
                source: 'OWNER_INTERVIEW',
                created_at: new Date().toISOString()
            }));
            const { error: histErr2 } = await supabase.from('place_history').insert(resetInserts);
            if (histErr2) console.warn('place_history strike reset error:', histErr2.message);
        }


        revalidatePath('/admin/verifications');
        revalidatePath('/admin/recommendations');

        return {
            success: true,
            message: `총 ${recordsToInsert.length}건의 팩트 검증이 1.0 가중치 정답 데이터로 즉시 반영되었습니다.`
        };
    } catch (e: any) {
        console.error('submitOwnerVerifications unexpected error:', e);
        return { success: false, error: e.message };
    }
}

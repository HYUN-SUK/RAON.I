'use server';

import { createAdminClient } from '@/lib/supabase-admin';

/**
 * DB에서 개별 에어컨 기기 목록 조회 (air-group 제외)
 */
export async function fetchAirconUnits() {
    try {
        const supabase = createAdminClient() as any;
        const { data, error } = await supabase
            .from('sites')
            .select('*')
            .like('id', 'air-%')
            .order('id', { ascending: true });

        if (error) {
            console.error('[fetchAirconUnits] Supabase error:', error);
            return { success: false, error: error.message };
        }

        // air-group 대표 카드는 제외하고 반환
        const filtered = (data || []).filter((s: any) => s.id !== 'air-group');
        return { success: true, data: filtered };
    } catch (err: any) {
        console.error('[fetchAirconUnits] Exception:', err);
        return { success: false, error: err.message };
    }
}

/**
 * 새 개별 에어컨 기기를 자동으로 순차 번호 부여하여 추가
 */
export async function addAirconUnit() {
    try {
        const supabase = createAdminClient() as any;
        
        // 1. 현재 등록된 에어컨 목록 조회하여 다음 번호 계산
        const { data: list, error: readError } = await fetchAirconUnits();
        if (readError) return { success: false, error: readError };

        let nextNum = 1;
        if (list && list.length > 0) {
            const nums = list
                .map((s: any) => {
                    const match = s.id.match(/^air-(\d+)$/);
                    return match ? parseInt(match[1], 10) : 0;
                })
                .filter((n: number) => n > 0);
            
            if (nums.length > 0) {
                nextNum = Math.max(...nums) + 1;
            }
        }

        const newId = `air-${nextNum}`;
        const newName = `에어컨 ${nextNum}번`;

        // 2. 신규 행 적재
        const { data, error } = await supabase
            .from('sites')
            .insert({
                id: newId,
                name: newName,
                type: 'AIR_CON',
                max_occupancy: 1,
                base_price: 10000,
                price: 10000,
                description: '여름 한시 에어컨 대여 서비스입니다.',
                features: ['에어컨 대여', '하루 1만원'],
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select();

        if (error) {
            console.error('[addAirconUnit] Supabase error:', error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    } catch (err: any) {
        console.error('[addAirconUnit] Exception:', err);
        return { success: false, error: err.message };
    }
}

/**
 * 개별 에어컨 기기 삭제
 */
export async function deleteAirconUnit(id: string) {
    try {
        const supabase = createAdminClient() as any;
        const { data, error } = await supabase
            .from('sites')
            .delete()
            .eq('id', id)
            .select();

        if (error) {
            console.error('[deleteAirconUnit] Supabase error:', error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    } catch (err: any) {
        console.error('[deleteAirconUnit] Exception:', err);
        return { success: false, error: err.message };
    }
}

/**
 * 개별 에어컨 기기 운영 상태 토글
 */
export async function updateAirconUnitStatus(id: string, isActive: boolean) {
    try {
        const supabase = createAdminClient() as any;
        const { data, error } = await supabase
            .from('sites')
            .update({
                is_active: isActive,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select();

        if (error) {
            console.error('[updateAirconUnitStatus] Supabase error:', error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    } catch (err: any) {
        console.error('[updateAirconUnitStatus] Exception:', err);
        return { success: false, error: err.message };
    }
}

/**
 * 개별 에어컨 기기의 이름 및 가격정보 정밀 수정
 */
export async function updateAirconUnitDetails(id: string, name: string, price: number) {
    try {
        const supabase = createAdminClient() as any;
        const { data, error } = await supabase
            .from('sites')
            .update({
                name: name,
                price: Number(price),
                base_price: Number(price), // 대여료는 단일 가격이므로 base_price도 일치시킴
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select();

        if (error) {
            console.error('[updateAirconUnitDetails] Supabase error:', error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    } catch (err: any) {
        console.error('[updateAirconUnitDetails] Exception:', err);
        return { success: false, error: err.message };
    }
}

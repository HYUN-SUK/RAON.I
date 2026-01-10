'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function deleteMissionAction(id: string) {
    // Determine the service role key. 
    // Usually it's SUPABASE_SERVICE_ROLE_KEY.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!serviceRoleKey) {
        throw new Error('서버 설정 오류: Service Role Key가 없습니다.')
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
    )

    const { error } = await supabase
        .from('missions')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Delete mission error:', error)
        throw new Error('미션 삭제에 실패했습니다: ' + error.message)
    }

    revalidatePath('/admin/mission')
}

export interface BulkMissionInput {
    title: string;
    description: string;
    mission_type: 'PHOTO' | 'CHECKIN' | 'COMMUNITY'; // Use literal type matching MissionType
    week_offset?: number;
    start_date?: string;
    end_date?: string;
    reward_xp: number;
    reward_point: number;
    is_active?: boolean;
}

export async function createBulkMissionsAction(inputs: BulkMissionInput[]) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!serviceRoleKey) {
        throw new Error('서버 설정 오류: Service Role Key가 없습니다.')
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
    )

    const missions = inputs.map(input => {
        let start = input.start_date;
        let end = input.end_date;

        // If dates are not provided, calculate based on week_offset
        if (!start || !end) {
            const today = new Date();
            const targetMonday = new Date(today);
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);

            // Default to offset 0 if undefined
            const offset = input.week_offset ?? 0;

            targetMonday.setDate(diff + (offset * 7));
            targetMonday.setHours(9, 0, 0, 0);

            const targetSunday = new Date(targetMonday);
            targetSunday.setDate(targetMonday.getDate() + 6);
            targetSunday.setHours(22, 0, 0, 0);

            start = targetMonday.toISOString();
            end = targetSunday.toISOString();
        }

        return {
            title: input.title,
            description: input.description,
            mission_type: input.mission_type,
            reward_xp: input.reward_xp,
            reward_point: input.reward_point,
            start_date: start,
            end_date: end,
            is_active: input.is_active ?? true
        };
    });

    const { data, error } = await supabase
        .from('missions')
        .insert(missions)
        .select()

    if (error) {
        console.error('Bulk create mission error:', error)
        throw new Error('미션 일괄 등록에 실패했습니다: ' + error.message)
    }

    revalidatePath('/admin/mission')
    return data
}

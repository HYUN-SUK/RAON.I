import { createClient } from '@/lib/supabase-client';
import { Mission, MissionType } from '@/types/mission';

const supabase = createClient();

export interface AdminMissionInput {
    title: string;
    description: string;
    mission_type: MissionType;
    start_date: string;
    end_date: string;
    reward_xp: number;
    reward_point: number;
    is_active: boolean;
}

export const adminMissionService = {
    // List all missions (for admin table)
    async getAllMissions() {
        const { data, error } = await supabase
            .from('missions')
            .select('*')
            .order('start_date', { ascending: false });

        if (error) {
            console.error('Error fetching admin missions:', error);
            throw error;
        }
        return data as Mission[];
    },

    // Get single mission by ID
    async getMissionById(id: string) {
        const { data, error } = await supabase
            .from('missions')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Mission;
    },

    // Create new mission
    async createMission(mission: AdminMissionInput) {
        const { data, error } = await supabase
            .from('missions')
            .insert(mission)
            .select()
            .single();

        if (error) {
            console.error('Error creating mission:', error);
            throw error;
        }
        return data as Mission;
    },

    // Update existing mission
    async updateMission(id: string, updates: Partial<AdminMissionInput>) {
        const { data, error } = await supabase
            .from('missions')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating mission:', error);
            throw error;
        }
        return data as Mission;
    },

    // Delete mission (Hard delete for now)
    async deleteMission(id: string) {
        const { error } = await supabase
            .from('missions')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting mission:', error);
            throw error;
        }
    },

    // Bulk Create Missions (AI Import)
    async createBulkMissions(inputs: BulkMissionInput[]) {
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
                is_active: input.is_active ?? true // Default to true if not specified
            };
        });

        const { data, error } = await supabase
            .from('missions')
            .insert(missions)
            .select();

        if (error) {
            console.error('Error bulk creating missions:', error);
            throw error;
        }
        return data as Mission[];
    },

    // Process Ranking (Manual Trigger)
    async processRanking(missionId: string) {
        const { data, error } = await supabase.rpc('process_mission_ranking', {
            p_mission_id: missionId
        });

        if (error) throw error;
        return data;
    },

    // Get Participants
    async getParticipants(missionId: string) {
        // Ideally join with profiles, but for now getting raw user_missions. 
        // Admin might need to see user IDs or join manually.
        // Let's try to join with profiles if it exists, otherwise just return ID.
        const { data, error } = await supabase
            .from('user_missions')
            .select('*')
            .eq('mission_id', missionId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    // Admin Withdraw Participation
    async withdrawParticipation(userId: string, missionId: string) {
        const { error } = await supabase.rpc('admin_withdraw_mission_participation', {
            p_target_user_id: userId,
            p_mission_id: missionId
        });

        if (error) throw error;
    }
};

export interface BulkMissionInput {
    title: string;
    description: string;
    mission_type: MissionType;
    week_offset?: number; // Optional if explicit dates are provided
    start_date?: string;  // Optional explicit date
    end_date?: string;    // Optional explicit date
    reward_xp: number;
    reward_point: number;
    is_active?: boolean;
}

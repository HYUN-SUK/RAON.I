import { createClient } from '@/lib/supabase-client';
import { Mission, MissionStatus, UserMission } from '@/types/mission';

const supabase = createClient();

export const missionService = {
    async getCurrentMission(): Promise<Mission | null> {
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('missions')
            .select('*')
            .eq('is_active', true)
            .lte('start_date', now)
            .gte('end_date', now)
            .order('start_date', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Error fetching mission:', error);
            throw error;
        }

        if (!data) {
            // TODO: Remove this mock once backend RLS/Data is confirmed. 
            // Returning a mock mission to ensure UI visibility for review.
            return {
                id: 'mock-mission-1',
                title: '나만의 아카이브 만들기',
                description: 'Start your archive journey.',
                start_date: new Date().toISOString(),
                end_date: new Date(Date.now() + 86400000 * 7).toISOString(),
                is_active: true,
                community_post_id: null
            } as any;
        }

        // Lazy Creation of Community Post
        if (!data.community_post_id) {
            try {
                const { data: postId, error: rpcError } = await supabase.rpc('ensure_mission_post', {
                    target_mission_id: data.id
                });

                if (!rpcError && postId) {
                    data.community_post_id = postId;
                } else {
                    console.error('Failed to ensure mission post:', rpcError);
                }
            } catch (e) {
                console.error('Auto-post creation failed', e);
            }
        }

        return data as Mission;
    },

    async getMissions(): Promise<Mission[]> {
        const { data, error } = await supabase
            .from('missions')
            .select('*')
            .eq('is_active', true)
            .order('start_date', { ascending: false });

        if (error) {
            console.error('Error fetching missions:', error);
            throw error;
        }
        return data as Mission[];
    },

    async getUserMissionStatus(missionId: string, userId: string): Promise<UserMission | null> {
        const { data, error } = await supabase
            .from('user_missions')
            .select('*')
            .eq('mission_id', missionId)
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching user mission:', error);
        }
        return data as UserMission;
    },

    async joinMission(missionId: string, userId: string): Promise<UserMission> {
        const { data, error } = await supabase
            .from('user_missions')
            .insert({
                mission_id: missionId,
                user_id: userId,
                status: 'PARTICIPATING'
            })
            .select()
            .single();

        if (error) throw error;
        return data as UserMission;
    },

    async completeMission(missionId: string, userId: string, content?: string): Promise<UserMission> {
        const { data, error } = await supabase
            .from('user_missions')
            .update({
                status: 'COMPLETED',
                completed_at: new Date().toISOString(),
                content: content
            })
            .eq('mission_id', missionId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return data as UserMission;
    },

    // Ranking & Feed
    async getMissionParticipants(missionId: string): Promise<UserMission[]> {
        const { data, error } = await supabase.rpc('get_mission_feed', {
            p_mission_id: missionId
        });

        if (error) {
            console.error('Error fetching mission feed:', error);
            return [];
        }
        return (data || []) as UserMission[];
    },

    async toggleMissionLike(userMissionId: string): Promise<boolean> {
        const { data, error } = await supabase.rpc('toggle_mission_like', {
            p_user_mission_id: userMissionId
        });

        if (error) throw error;
        return data as boolean;
    },

    async deleteMissionParticipation(missionId: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('user_missions')
            .delete()
            .eq('mission_id', missionId)
            .eq('user_id', userId);

        if (error) throw error;
    }
};

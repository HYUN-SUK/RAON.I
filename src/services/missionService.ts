import { createClient } from '@/lib/supabase-client';
import { Mission, MissionStatus, UserMission } from '@/types/mission';
import { communityService } from './communityService';
import { pointService } from '@/services/pointService';

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

        if (!data) return null;

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

    async getTrendingMissions(): Promise<Mission[]> {
        // RPC calls get_trending_missions which returns missions sorted by score
        const { data, error } = await supabase.rpc('get_trending_missions');

        if (error) {
            console.error('Error fetching trending missions:', error);
            throw error;
        }
        return (data || []) as Mission[];
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

    async completeMission(missionId: string, userId: string, content?: string, imageUrl?: string): Promise<UserMission> {
        // 1. Update User Mission Status
        const { data, error } = await supabase
            .from('user_missions')
            .update({
                status: 'COMPLETED',
                completed_at: new Date().toISOString(),
                content: content,
                image_url: imageUrl
            })
            .eq('mission_id', missionId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;

        // 2. Fetch Mission Reward Info
        const { data: mission } = await supabase
            .from('missions')
            .select('reward_xp, reward_point, community_post_id')
            .eq('id', missionId)
            .single();

        // 3. Grant Reward
        if (mission) {
            try {
                // 3.1 Mission Completion Reward
                await pointService.grantReward(
                    userId,
                    mission.reward_xp || 0,
                    mission.reward_point || 0,
                    0, // gold
                    'MISSION_COMPLETE',
                    missionId // related_id
                );

                // 3.2 Photo Upload Reward (if image exists)
                if (imageUrl) {
                    await pointService.grantAction(userId, 'UPLOAD_PHOTO', missionId);
                }
            } catch (e) {
                console.error("Reward grant failed", e);
            }

            // 4. Auto-Comment on Community Post (Integration)
            if (mission.community_post_id) {
                try {
                    const { data: profile } = await supabase.from('profiles').select('nickname').eq('id', userId).single();
                    const nickname = profile?.nickname || '익명의 캠퍼';

                    await communityService.createComment(
                        mission.community_post_id,
                        content || "미션 인증합니다! 🚀",
                        nickname,
                        userId,
                        imageUrl
                    );
                } catch (e) {
                    console.error("Auto comment failed", e);
                }
            }
        }

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
        // Use RPC to bypass RLS issues and ensure clean deletion
        const { error, data } = await supabase.rpc('withdraw_mission', {
            p_mission_id: missionId
        });

        if (error) {
            console.error('[Delete] Supabase Error:', error);
            throw error;
        }
    }
};

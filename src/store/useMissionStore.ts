import { create } from 'zustand';
import { missionService } from '@/services/missionService';
import { Mission, UserMission } from '@/types/mission';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';

const supabase = createClient();

interface MissionStore {
    currentMission: Mission | null;
    missions: Mission[];
    userMission: UserMission | null;
    isLoading: boolean;
    error: string | null;

    fetchCurrentMission: () => Promise<void>;
    fetchMissions: () => Promise<void>;
    joinMission: () => Promise<void>;
    completeMission: (content?: string) => Promise<void>;

    participants: UserMission[];
    fetchParticipants: () => Promise<void>;
    toggleLike: (userMissionId: string) => Promise<void>;
    deleteParticipation: () => Promise<void>;
}

export const useMissionStore = create<MissionStore>((set, get) => ({
    currentMission: null,
    missions: [],
    userMission: null,
    participants: [],
    isLoading: false,
    error: null,

    fetchCurrentMission: async () => {
        set({ isLoading: true, error: null });
        try {
            // 1. Get User
            const { data: { user } } = await supabase.auth.getUser();

            // 2. Get Mission
            const mission = await missionService.getCurrentMission();
            set({ currentMission: mission });

            // 3. Get User Status if logged in and mission exists
            if (user && mission) {
                const userMission = await missionService.getUserMissionStatus(mission.id, user.id);
                set({ userMission });

                // 4. Get Participants (Feed)
                const participants = await missionService.getMissionParticipants(mission.id);
                set({ participants });
            }
        } catch (error: any) {
            set({ error: error.message });
        } finally {
            set({ isLoading: false });
        }
    },

    fetchMissions: async () => {
        set({ isLoading: true, error: null });
        try {
            const missions = await missionService.getMissions();
            set({ missions });
        } catch (error: any) {
            set({ error: error.message });
        } finally {
            set({ isLoading: false });
        }
    },

    fetchParticipants: async () => {
        const { currentMission } = get();
        if (!currentMission) return;

        try {
            const participants = await missionService.getMissionParticipants(currentMission.id);
            set({ participants });
        } catch (error) {
            console.error(error);
        }
    },

    joinMission: async () => {
        const { currentMission } = get();
        if (!currentMission) return;

        set({ isLoading: true });
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('로그인이 필요합니다.');

            const userMission = await missionService.joinMission(currentMission.id, user.id);
            set({ userMission });
        } catch (error: any) {
            set({ error: error.message });
        } finally {
            set({ isLoading: false });
        }
    },

    completeMission: async (content?: string) => {
        const { currentMission, userMission } = get();
        if (!currentMission || !userMission) return;

        set({ isLoading: true });
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('로그인이 필요합니다.');

            const updated = await missionService.completeMission(currentMission.id, user.id, content);
            set({ userMission: updated });

            // Refresh participants to show my new post
            await get().fetchParticipants();
        } catch (error: any) {
            set({ error: error.message });
        } finally {
            set({ isLoading: false });
        }
    },

    toggleLike: async (userMissionId: string) => {
        const { participants } = get();
        // Optimistic Update
        const updatedParticipants = participants.map(p => {
            if (p.id === userMissionId) {
                const isLiked = p.is_liked_by_me;
                return {
                    ...p,
                    is_liked_by_me: !isLiked,
                    likes_count: (p.likes_count || 0) + (isLiked ? -1 : 1)
                };
            }
            return p;
        });
        set({ participants: updatedParticipants });

        try {
            await missionService.toggleMissionLike(userMissionId);
        } catch (error) {
            // Revert on error
            set({ participants });
            throw error;
        }
    },

    deleteParticipation: async () => {
        const { currentMission } = get();
        if (!currentMission) {
            return;
        }

        if (!window.confirm('정말 미션 참여 기록을 삭제하시겠습니까?')) return;

        set({ isLoading: true });
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('로그인이 필요합니다.');

            await missionService.deleteMissionParticipation(currentMission.id, user.id);

            // Reset state
            set({ userMission: null });
            await get().fetchParticipants(); // Refresh feed
            toast.success('참여 기록이 삭제되었습니다.');
        } catch (error: any) {
            set({ error: error.message });
            toast.error('삭제 실패: ' + error.message);
        } finally {
            set({ isLoading: false });
        }
    }
}));

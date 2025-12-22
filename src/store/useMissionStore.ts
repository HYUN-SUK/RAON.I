import { create } from 'zustand';
import { missionService } from '@/services/missionService';
import { Mission, UserMission } from '@/types/mission';
import { createClient } from '@/lib/supabase-client';

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
}

export const useMissionStore = create<MissionStore>((set, get) => ({
    currentMission: null,
    missions: [],
    userMission: null,
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
        } catch (error: any) {
            set({ error: error.message });
        } finally {
            set({ isLoading: false });
        }
    }
}));

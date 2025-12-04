import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MySpaceState {
    isNightMode: boolean;
    isFireOn: boolean;
    isStarOn: boolean;
    toggleNightMode: () => void;
    toggleFire: () => void;
    toggleStar: () => void;
    setNightMode: (isNight: boolean) => void;
    xp: number;
    level: number;
    points: number;
    addXp: (amount: number) => void;
    addPoints: (amount: number) => void;
}

export const useMySpaceStore = create<MySpaceState>()(
    persist(
        (set) => ({
            isNightMode: false,
            isFireOn: false,
            isStarOn: false,
            toggleNightMode: () => set((state) => ({ isNightMode: !state.isNightMode })),
            toggleFire: () => set((state) => ({ isFireOn: !state.isFireOn })),
            toggleStar: () => set((state) => ({ isStarOn: !state.isStarOn })),
            setNightMode: (isNight) => set({ isNightMode: isNight }),
            xp: 0,
            level: 1,
            points: 0,
            addXp: (amount) => set((state) => {
                const newXp = state.xp + amount;
                const newLevel = Math.floor(newXp / 100) + 1;
                return { xp: newXp, level: newLevel };
            }),
            addPoints: (amount) => set((state) => ({ points: state.points + amount })),
        }),
        {
            name: 'myspace-storage',
        }
    )
);

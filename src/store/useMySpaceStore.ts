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
        }),
        {
            name: 'myspace-storage',
        }
    )
);

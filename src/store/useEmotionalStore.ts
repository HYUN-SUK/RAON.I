import { create } from 'zustand';

interface EmotionalState {
    isFireActive: boolean;
    isStarActive: boolean;
    toggleFire: () => void;
    toggleStar: () => void;
}

export const useEmotionalStore = create<EmotionalState>((set) => ({
    isFireActive: false,
    isStarActive: false,
    toggleFire: () => set((state) => ({ isFireActive: !state.isFireActive })),
    toggleStar: () => set((state) => ({ isStarActive: !state.isStarActive })),
}));

import { create } from 'zustand';
import { Reservation, Site } from '@/types/reservation';

interface ReservationState {
    selectedDateRange: {
        from: Date | undefined;
        to: Date | undefined;
    };
    selectedSite: Site | null;
    reservations: Reservation[];

    // Actions
    setDateRange: (range: { from: Date | undefined; to: Date | undefined }) => void;
    setSelectedSite: (site: Site | null) => void;
    addReservation: (reservation: Reservation) => void;
    reset: () => void;
}

export const useReservationStore = create<ReservationState>((set) => ({
    selectedDateRange: { from: undefined, to: undefined },
    selectedSite: null,
    reservations: [],

    setDateRange: (range) => set({ selectedDateRange: range }),
    setSelectedSite: (site) => set({ selectedSite: site }),
    addReservation: (reservation) =>
        set((state) => ({ reservations: [...state.reservations, reservation] })),
    reset: () => set({ selectedDateRange: { from: undefined, to: undefined }, selectedSite: null }),
}));

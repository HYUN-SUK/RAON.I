import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

    // Helper to calculate price
    calculateTotalPrice: (site: Site, nights: number, familyCount: number, visitorCount: number) => number;
}

export const useReservationStore = create<ReservationState>()(
    persist(
        (set, get) => ({
            selectedDateRange: { from: undefined, to: undefined },
            selectedSite: null,
            reservations: [],

            setDateRange: (range) => set({ selectedDateRange: range }),
            setSelectedSite: (site) => set({ selectedSite: site }),
            addReservation: (reservation) =>
                set((state) => ({ reservations: [...state.reservations, reservation] })),
            reset: () => set({ selectedDateRange: { from: undefined, to: undefined }, selectedSite: null }),

            calculateTotalPrice: (site, nights, familyCount, visitorCount) => {
                // SSOT 6.1 Pricing Rules
                // Base Price (includes 1 family)
                const basePrice = site.basePrice * nights;

                // Extra Family: 35,000 KRW per family per night
                const extraFamilyCost = (familyCount - 1) * 35000 * nights;

                // Visitor: 10,000 KRW per person (one-time fee, not per night based on SSOT context, but usually per entry. Assuming per visit for now based on "10,000")
                // SSOT 6.1.3 says "Visitor fee: 10,000 KRW per adult". Doesn't explicitly say per night, but usually visitors are day-use.
                const visitorCost = visitorCount * 10000;

                return basePrice + Math.max(0, extraFamilyCost) + visitorCost;
            },
        }),
        {
            name: 'reservation-storage',
        }
    )
);

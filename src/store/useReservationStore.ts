import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Reservation, Site } from '@/types/reservation';
import { calculatePrice } from '@/utils/pricing';

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
    calculatePrice: (site: Site, checkIn: Date, checkOut: Date, familyCount: number, visitorCount: number) => PriceBreakdown;
}

export interface PriceBreakdown {
    basePrice: number;
    options: {
        extraFamily: number;
        visitor: number;
    };
    discount: {
        consecutive: number;
        package: number;
    };
    totalPrice: number;
    nights: number;
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

            calculatePrice: (site, checkIn, checkOut, familyCount, visitorCount) => {
                return calculatePrice(site, checkIn, checkOut, familyCount, visitorCount);
            },
        }),
        {
            name: 'reservation-storage',
        }
    )
);

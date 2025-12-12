import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Reservation, Site, ReservationStatus } from '@/types/reservation';
import { calculatePrice } from '@/utils/pricing';
import { SITES } from '@/constants/sites';

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
    updateReservationStatus: (id: string, status: ReservationStatus) => void;
    reset: () => void;

    // Helper to calculate price
    calculatePrice: (site: Site, checkIn: Date, checkOut: Date, familyCount: number, visitorCount: number) => PriceBreakdown;

    // Deposit Deadline Management
    deadlineHours: number; // 3, 6, 9, 12
    setDeadlineHours: (hours: number) => void;
    getOverdueReservations: () => { overdue: Reservation[], warning: Reservation[] };
    cancelOverdueReservations: () => void;
    prefillBooking: (siteId: string) => void;
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
            deadlineHours: 6, // Default 6h
            setDateRange: (range) => set({ selectedDateRange: range }),
            setSelectedSite: (site) => set({ selectedSite: site }),
            setDeadlineHours: (hours) => set({ deadlineHours: hours }),
            addReservation: (reservation) => {
                const { reservations } = get();
                const newCheckIn = new Date(reservation.checkInDate);
                const newCheckOut = new Date(reservation.checkOutDate);

                const hasOverlap = reservations.some(r => {
                    if (r.siteId !== reservation.siteId || r.status === 'CANCELLED') return false;
                    const rCheckIn = new Date(r.checkInDate);
                    const rCheckOut = new Date(r.checkOutDate);
                    return rCheckIn < newCheckOut && rCheckOut > newCheckIn;
                });

                if (hasOverlap) {
                    throw new Error('이미 예약이 완료된 날짜입니다');
                }

                set((state) => ({ reservations: [...state.reservations, reservation] }));
            },
            updateReservationStatus: (id, status) =>
                set((state) => ({
                    reservations: state.reservations.map((res) =>
                        res.id === id ? { ...res, status } : res
                    ),
                })),
            reset: () => set({ selectedDateRange: { from: undefined, to: undefined }, selectedSite: null }),

            calculatePrice: (site, checkIn, checkOut, familyCount, visitorCount) => {
                return calculatePrice(site, checkIn, checkOut, familyCount, visitorCount);
            },

            getOverdueReservations: () => {
                const { reservations, deadlineHours } = get();
                const now = new Date();

                const overdue: Reservation[] = [];
                const warning: Reservation[] = [];

                reservations.forEach((r) => {
                    if (r.status !== 'PENDING') return;
                    if (!r.createdAt) return;

                    const createdAt = new Date(r.createdAt);
                    const deadline = new Date(createdAt.getTime() + deadlineHours * 60 * 60 * 1000);

                    // If deadline hasn't passed, it's fine
                    if (now < deadline) return;

                    // Deadline passed. Check Grace Period.
                    // Grace Period: Until next 9 AM or 6 PM
                    const graceTime = new Date(deadline);
                    const hour = graceTime.getHours();

                    if (hour < 9) {
                        graceTime.setHours(9, 0, 0, 0);
                    } else if (hour < 18) {
                        graceTime.setHours(18, 0, 0, 0);
                    } else {
                        // Next day 9 AM
                        graceTime.setDate(graceTime.getDate() + 1);
                        graceTime.setHours(9, 0, 0, 0);
                    }

                    if (now > graceTime) {
                        overdue.push(r);
                    } else {
                        warning.push(r);
                    }
                });

                return { overdue, warning };
            },

            cancelOverdueReservations: () => {
                const { getOverdueReservations } = get();
                const { overdue } = getOverdueReservations();
                if (overdue.length === 0) return;

                set((state) => ({
                    reservations: state.reservations.map((res) =>
                        overdue.some((o) => o.id === res.id) ? { ...res, status: 'CANCELLED' } : res
                    ),
                }));
            },
            prefillBooking: (siteId) => {
                const site = SITES.find(s => s.id === siteId);
                if (site) {
                    set({ selectedSite: site });
                }
            },
        }),
        {
            name: 'reservation-storage',
            storage: {
                getItem: (name) => {
                    const str = localStorage.getItem(name);
                    if (!str) return null;
                    return JSON.parse(str, (key, value) => {
                        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
                            return new Date(value);
                        }
                        return value;
                    });
                },
                setItem: (name, value) => {
                    localStorage.setItem(name, JSON.stringify(value));
                },
                removeItem: (name) => localStorage.removeItem(name),
            },
        }
    )
);

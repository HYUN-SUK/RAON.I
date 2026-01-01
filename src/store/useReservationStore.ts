import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Reservation, Site, ReservationStatus, PricingConfig, BlockedDate } from '@/types/reservation';
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
    validateReservation: (siteId: string, checkIn: Date, checkOut: Date) => string | null;
    initRebook: (siteId: string) => void;

    // Admin Config
    priceConfig: PricingConfig;
    blockedDates: BlockedDate[];

    // Config Actions
    setPriceConfig: (config: PricingConfig) => void;
    addBlockDate: (block: BlockedDate) => void;
    removeBlockDate: (id: string) => void;

    // Open Day Rule (Dynamic)
    openDayRule: {
        id: string;
        seasonName: string | null;
        openAt: Date;
        closeAt: Date;
        isActive: boolean;
        repeat_rule?: 'NONE' | 'MONTHLY'; // Added
    } | null;
    fetchOpenDayRule: () => Promise<void>;
}



export interface PriceBreakdown {
    basePrice: number;
    options: {
        extraFamily: number;
        visitor: number;
    };
    discount: {
        consecutive: number;
        pkg: number;
    };
    totalPrice: number;
    nights: number;
}

const DEFAULT_PRICE_CONFIG: PricingConfig = {
    weekday: 40000,
    weekend: 70000,
    peakWeekday: 50000,
    peakWeekend: 70000,
    extraFamily: 35000,
    visitor: 10000,
    longStayDiscount: 10000,
    seasons: [
        { name: 'Summer Peak', startMonth: 6, startDay: 1, endMonth: 7, endDay: 31 } // July 1 - Aug 31
    ]
};

export const useReservationStore = create<ReservationState>()(
    persist(
        (set, get) => ({
            selectedDateRange: { from: undefined, to: undefined },
            selectedSite: null,
            reservations: [],
            deadlineHours: 6, // Default 6h

            // Initial Admin State
            priceConfig: DEFAULT_PRICE_CONFIG,
            blockedDates: [],

            setDateRange: (range) => set({ selectedDateRange: range }),
            setSelectedSite: (site) => set({ selectedSite: site }),
            setDeadlineHours: (hours) => set({ deadlineHours: hours }),

            setPriceConfig: (config) => set({ priceConfig: config }),
            addBlockDate: (block) => set((state) => ({ blockedDates: [...state.blockedDates, block] })),
            removeBlockDate: (id) => set((state) => ({ blockedDates: state.blockedDates.filter(b => b.id !== id) })),

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
                const { priceConfig } = get();
                return calculatePrice(site, checkIn, checkOut, familyCount, visitorCount, priceConfig);
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
            validateReservation: (siteId, checkIn, checkOut) => {
                const { reservations } = get();
                const startDay = checkIn.getDay(); // 0=Sun, 5=Fri, 6=Sat
                const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

                // Rule 1: Weekend 2-night Rule (Fri, Sat Check-in)
                if (startDay === 5 || startDay === 6) { // Friday or Saturday
                    if (nights < 2) {
                        // Exception: Friday 1-night End-cap
                        if (startDay === 5) {
                            // Check if Saturday is already booked for this site
                            const saturdayDate = new Date(checkIn);
                            saturdayDate.setDate(saturdayDate.getDate() + 1); // This is Saturday

                            const isSaturdayBooked = reservations.some(r => {
                                if (r.status === 'CANCELLED' || r.siteId !== siteId) return false;
                                const rCheckIn = new Date(r.checkInDate);
                                return rCheckIn.getTime() === saturdayDate.getTime();
                            });

                            if (isSaturdayBooked) {
                                return null; // Allowed (End-cap)
                            }

                            // Exception: D-N (Imminent Booking)
                            const D_N_DAYS = 7;
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const checkInDay = new Date(checkIn);
                            checkInDay.setHours(0, 0, 0, 0);
                            const diffDays = Math.ceil((checkInDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                            if (diffDays <= D_N_DAYS) {
                                return null; // Allowed (D-N)
                            }

                            return '금요일 입실 시 2박 이상 예약 가능합니다. (잔여석 또는 임박 예약만 1박 가능)';
                        }
                        return '주말(토요일) 입실 시 2박 이상 예약해야 합니다.';
                    }
                }
                return null; // Valid
            },

            initRebook: (siteId) => {
                const site = SITES.find(s => s.id === siteId);
                if (site) {
                    set({ selectedSite: site });
                }
            },

            // Open Day Rule
            openDayRule: null,
            fetchOpenDayRule: async () => {
                const { createClient } = await import('@/lib/supabase-client');
                const { addMonths, endOfMonth, setDate, setHours, setMinutes, isBefore } = await import('date-fns');
                const supabase = createClient();
                const { data } = await supabase
                    .from('open_day_rules')
                    .select('*')
                    .eq('is_active', true)
                    .maybeSingle();

                if (data) {
                    let calculatedCloseAt = new Date(data.close_at);
                    const now = new Date();

                    // Logic for Monthly Automation
                    if (data.repeat_rule === 'MONTHLY' && data.automation_config) {
                        const config = data.automation_config; // { triggerDay, monthsToAdd, targetDay }

                        // 1. Determine the "Trigger Moment" for THIS month
                        // Trigger is usually 1st day of month at 09:00
                        const currentTrigger = new Date();
                        currentTrigger.setDate(config.triggerDay || 1);
                        currentTrigger.setHours(9, 0, 0, 0);

                        // 2. Base Date Calculation
                        // If Now < Trigger (e.g. 1st 08:59), we use "Last Month" as base (Pre-open state)
                        // If Now >= Trigger (e.g. 1st 09:01), we use "This Month" as base (Open state)
                        const baseDate = new Date();
                        if (isBefore(now, currentTrigger)) {
                            // Before trigger: Effectively we are still in "Previous Month's cycle"
                            // But actually, we want to know "What is the max open date?"
                            // If I set "2 months ahead", and today is Jan 1st 08:00 (Before trigger).
                            // The window should be until Feb End (calculated from Dec).
                            // If Jan 1st 09:00 passes, window extends to Mar End.
                            baseDate.setMonth(baseDate.getMonth() - 1);
                        }

                        // 3. Calculate Target Month
                        const targetMonthDate = addMonths(baseDate, config.monthsToAdd);

                        // 4. Calculate Target Date
                        if (config.targetDay === 'END') {
                            calculatedCloseAt = endOfMonth(targetMonthDate);
                            calculatedCloseAt.setHours(23, 59, 59, 999);
                        } else {
                            calculatedCloseAt = new Date(targetMonthDate);
                            calculatedCloseAt.setDate(config.targetDay);
                            calculatedCloseAt.setHours(23, 59, 59, 999);
                        }
                    }

                    set({
                        openDayRule: {
                            id: data.id,
                            seasonName: data.season_name,
                            openAt: new Date(data.open_at),
                            closeAt: calculatedCloseAt,
                            isActive: data.is_active,
                            repeat_rule: data.repeat_rule // Added mapping
                        }
                    });
                } else {
                    set({ openDayRule: null });
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

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Reservation, Site, SiteType, ReservationStatus, PricingConfig, BlockedDate, SiteConfig } from '@/types/reservation';
import { calculatePrice } from '@/utils/pricing';
import { SITES as DEFAULT_SITES } from '@/constants/sites';
import { Database } from '@/types/supabase';

// DB row types
type DbSite = Database['public']['Tables']['sites']['Row'];
type DbBlockedDate = Database['public']['Tables']['blocked_dates']['Row'];
// Note: reservations table not in current supabase.ts schema

interface ReservationState {
    selectedDateRange: {
        from: Date | undefined;
        to: Date | undefined;
    };
    selectedSite: Site | null;
    reservations: Reservation[];

    // Dynamic Data
    sites: Site[];
    siteConfig: SiteConfig | null;

    // Actions
    setDateRange: (range: { from: Date | undefined; to: Date | undefined }) => void;
    setSelectedSite: (site: Site | null) => void;
    addReservation: (reservation: Reservation) => void;
    updateReservationStatus: (id: string, status: ReservationStatus) => void;
    updateReservation: (id: string, updates: {
        checkInDate?: Date;
        checkOutDate?: Date;
        siteId?: string;
        familyCount?: number;
        visitorCount?: number;
    }) => { success: boolean; oldPrice: number; newPrice: number; diff: number; error?: string };
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
    // Async Actions
    fetchSites: () => Promise<void>;
    fetchSiteConfig: () => Promise<void>;
    fetchBlockedDates: () => Promise<void>;
    addBlockDate: (block: BlockedDate) => Promise<void>;
    removeBlockDate: (id: string) => Promise<void>;
    toggleBlockPaid: (id: string) => Promise<void>;
    getUserHistory: (query: string) => Promise<Reservation[]>;

    // Open Day Rule (Dynamic)
    openDayRule: {
        id: string;
        seasonName: string | null;
        openAt: Date;
        closeAt: Date;
        isActive: boolean;
        repeat_rule?: 'NONE' | 'MONTHLY';
    } | null;
    fetchOpenDayRule: () => Promise<void>;

    // Dynamic Holidays
    holidays: Set<string>;
    fetchHolidays: () => Promise<void>;
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

            sites: DEFAULT_SITES, // Initialize with default constant for immediate render
            siteConfig: null,

            // Initial Admin State
            priceConfig: DEFAULT_PRICE_CONFIG,
            blockedDates: [],

            setDateRange: (range) => set({ selectedDateRange: range }),
            setSelectedSite: (site) => set({ selectedSite: site }),
            setDeadlineHours: (hours) => set({ deadlineHours: hours }),

            setPriceConfig: (config) => set({ priceConfig: config }),

            // --- New Async: Fetch Sites & Config ---
            fetchSites: async () => {
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();
                const { data, error } = await supabase.from('sites').select('*').order('id');

                if (data) {
                    const mappedSites: Site[] = data.map((s: DbSite) => ({
                        id: String(s.id),
                        name: s.name,
                        type: (s.type as SiteType) || 'TENT',
                        description: s.description || '',
                        price: s.price || s.base_price,
                        basePrice: s.base_price,
                        maxOccupancy: s.max_occupancy || s.capacity,
                        imageUrl: s.image_url || '',
                        features: (Array.isArray(s.features) ? s.features : []) as string[]
                    }));
                    set({ sites: mappedSites });
                }
            },

            fetchSiteConfig: async () => {
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();
                const { data } = await supabase.from('site_config').select('*').eq('id', 1).single();

                if (data) {
                    set({
                        siteConfig: {
                            campName: data.camp_name,
                            bankName: data.bank_name,
                            bankAccount: data.bank_account,
                            bankHolder: data.bank_holder,
                            heroImageUrl: data.hero_image_url,
                            layoutImageUrl: data.layout_image_url
                        }
                    });
                }
            },


            // Async Block Actions
            fetchBlockedDates: async () => {
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();
                const { data, error } = await supabase.from('blocked_dates').select('*');
                if (data) {
                    const mapped: BlockedDate[] = data.map(d => ({
                        id: d.id,
                        siteId: d.site_id,
                        startDate: new Date(d.start_date),
                        endDate: new Date(d.end_date),
                        memo: d.memo || undefined,
                        isPaid: d.is_paid,
                        guestName: d.guest_name || undefined,
                        contact: d.contact || undefined
                    }));
                    set({ blockedDates: mapped });
                }
            },

            addBlockDate: async (block) => {
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();

                const { data, error } = await supabase.from('blocked_dates').insert({
                    site_id: block.siteId,
                    start_date: block.startDate.toISOString(),
                    end_date: block.endDate.toISOString(),
                    memo: block.memo,
                    is_paid: block.isPaid,
                    guest_name: block.guestName,
                    contact: block.contact
                }).select().single();

                if (data) {
                    const newBlock: BlockedDate = {
                        id: data.id,
                        siteId: data.site_id,
                        startDate: new Date(data.start_date),
                        endDate: new Date(data.end_date),
                        memo: data.memo || undefined,
                        isPaid: data.is_paid,
                        guestName: data.guest_name || undefined,
                        contact: data.contact || undefined
                    };
                    set((state) => ({ blockedDates: [...state.blockedDates, newBlock] }));
                }
            },

            removeBlockDate: async (id: string) => {
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();
                await supabase.from('blocked_dates').delete().eq('id', id);
                set((state) => ({ blockedDates: state.blockedDates.filter(b => b.id !== id) }));
            },

            toggleBlockPaid: async (id: string) => {
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();
                const { blockedDates } = get();
                const target = blockedDates.find(b => b.id === id);
                if (!target) return;

                const newStatus = !target.isPaid;
                await supabase.from('blocked_dates').update({ is_paid: newStatus }).eq('id', id);

                set((state) => ({
                    blockedDates: state.blockedDates.map(b => b.id === id ? { ...b, isPaid: newStatus } : b)
                }));
            },

            getUserHistory: async (query: string) => {
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();

                // 1. Fetch Reservations (Web)
                const { data: resData } = await supabase
                    .from('reservations')
                    .select('*')
                    .or(`user_id.eq.${query}`);

                // 2. Fetch Blocked Dates (Manual)
                const { data: blockData } = await supabase
                    .from('blocked_dates')
                    .select('*')
                    .eq('guest_name', query);

                const history: Reservation[] = [];

                if (resData) {
                    resData.forEach((r: any) => {  // TODO: Add reservations table to supabase.ts
                        history.push({
                            id: r.id,
                            userId: r.user_id,
                            siteId: r.site_id,
                            checkInDate: new Date(r.check_in_date),
                            checkOutDate: new Date(r.check_out_date),
                            guests: r.guests,
                            price: r.total_price,
                            status: r.status,
                            created_at: new Date(r.created_at)
                        } as any);
                    });
                }

                if (blockData) {
                    blockData.forEach((b: DbBlockedDate) => {
                        history.push({
                            id: b.id,
                            userId: b.guest_name || 'Manual',
                            siteId: b.site_id,
                            checkInDate: new Date(b.start_date || b.date),
                            checkOutDate: new Date(b.end_date || b.date),
                            guests: 0,
                            price: 0,
                            status: b.is_paid ? 'CONFIRMED' : 'PENDING',
                            created_at: new Date(b.created_at),
                            requests: b.memo
                        } as any);
                    });
                }

                // Sort by date desc
                return history.sort((a, b) => b.checkInDate.getTime() - a.checkInDate.getTime());
            },

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

            // 예약 변경 (관리자 전용): 일정/사이트 변경 + 차액 계산
            updateReservation: (id, updates) => {
                const { reservations, sites, calculatePrice: calcPrice } = get();
                const reservation = reservations.find(r => r.id === id);

                if (!reservation) {
                    return { success: false, oldPrice: 0, newPrice: 0, diff: 0, error: '예약을 찾을 수 없습니다.' };
                }

                // 변경될 값 계산
                const newCheckIn = updates.checkInDate || reservation.checkInDate;
                const newCheckOut = updates.checkOutDate || reservation.checkOutDate;
                const newSiteId = updates.siteId || reservation.siteId;
                const newFamilyCount = updates.familyCount ?? reservation.familyCount;
                const newVisitorCount = updates.visitorCount ?? reservation.visitorCount;

                // 중복 예약 검증 (자기 자신 제외)
                const hasOverlap = reservations.some(r => {
                    if (r.id === id) return false; // 자기 자신 제외
                    if (r.siteId !== newSiteId || r.status === 'CANCELLED') return false;
                    const rCheckIn = new Date(r.checkInDate);
                    const rCheckOut = new Date(r.checkOutDate);
                    return rCheckIn < newCheckOut && rCheckOut > newCheckIn;
                });

                if (hasOverlap) {
                    return { success: false, oldPrice: reservation.totalPrice, newPrice: 0, diff: 0, error: '해당 기간에 이미 다른 예약이 있습니다.' };
                }

                // 새로운 가격 계산
                const site = sites.find(s => s.id === newSiteId);
                if (!site) {
                    return { success: false, oldPrice: reservation.totalPrice, newPrice: 0, diff: 0, error: '사이트를 찾을 수 없습니다.' };
                }

                const priceBreakdown = calcPrice(site, newCheckIn, newCheckOut, newFamilyCount, newVisitorCount);
                const oldPrice = reservation.totalPrice;
                const newPrice = priceBreakdown.totalPrice;
                const diff = newPrice - oldPrice;

                // 예약 업데이트
                set((state) => ({
                    reservations: state.reservations.map((res) =>
                        res.id === id ? {
                            ...res,
                            checkInDate: newCheckIn,
                            checkOutDate: newCheckOut,
                            siteId: newSiteId,
                            familyCount: newFamilyCount,
                            visitorCount: newVisitorCount,
                            guests: newFamilyCount + newVisitorCount,
                            totalPrice: newPrice
                        } : res
                    ),
                }));

                return { success: true, oldPrice, newPrice, diff };
            },

            reset: () => set({ selectedDateRange: { from: undefined, to: undefined }, selectedSite: null }),


            // Dynamic Holidays
            holidays: new Set(),
            fetchHolidays: async () => {
                try {
                    const res = await fetch('/api/holidays');

                    if (!res.ok) {
                        console.error('Fetch holidays failed:', res.statusText);
                        return;
                    }

                    const data = await res.json();

                    if (data.holidays && Array.isArray(data.holidays)) {
                        set({ holidays: new Set(data.holidays) });
                    }
                } catch (e) {
                    console.error('Failed to fetch holidays', e);
                }
            },

            calculatePrice: (site, checkIn, checkOut, familyCount, visitorCount) => {
                const { priceConfig, holidays } = get();
                return calculatePrice(site, checkIn, checkOut, familyCount, visitorCount, priceConfig, holidays);
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
                const startDay = checkIn.getDay();
                const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

                // Rule 1: Weekend 2-night Rule (Fri, Sat Check-in)
                if (startDay === 5 || startDay === 6) {
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
                return null;
            },

            initRebook: (siteId) => {
                // Now using dynamic sites if available, but for rebook standard we can look up from store
                const { sites } = get();
                const site = sites.find(s => s.id === siteId);
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
                        const config = data.automation_config;

                        // 1. Determine the "Trigger Moment" for THIS month
                        const currentTrigger = new Date();
                        currentTrigger.setDate(config.triggerDay || 1);
                        currentTrigger.setHours(9, 0, 0, 0);

                        // 2. Base Date Calculation
                        const baseDate = new Date();
                        if (isBefore(now, currentTrigger)) {
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
                            repeat_rule: data.repeat_rule
                        }
                    });
                } else {
                    set({ openDayRule: null });
                }
            },
        }),
        {
            name: 'reservation-storage-v2',
            storage: {
                getItem: (name) => {
                    const str = localStorage.getItem(name);
                    if (!str) return null;
                    return JSON.parse(str, (key, value) => {
                        if (key === 'holidays' && Array.isArray(value)) {
                            return new Set(value);
                        }
                        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
                            return new Date(value);
                        }
                        return value;
                    });
                },
                setItem: (name, value) => {
                    const str = JSON.stringify(value, (key, val) => {
                        if (val instanceof Set) {
                            return Array.from(val);
                        }
                        return val;
                    });
                    localStorage.setItem(name, str);
                },
                removeItem: (name) => localStorage.removeItem(name),
            },
        }
    )
);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Reservation, Site, SiteType, ReservationStatus, PricingConfig, BlockedDate, SiteConfig } from '@/types/reservation';
import { calculatePrice } from '@/utils/pricing';
import { formatLocalDate } from '@/utils/date';
import { SITES as DEFAULT_SITES } from '@/constants/sites';
import { Database } from '@/types/supabase';
import { notificationService } from '@/services/notificationService';
import { NotificationEventType } from '@/types/notificationEvents';

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
    createReservationSafe: (params: {
        siteId: string;
        checkIn: Date;
        checkOut: Date;
        familyCount: number;
        visitorCount: number;
        vehicleCount: number;
        totalPrice: number;
        guestName: string;
        guestPhone: string;
        requests?: string;
    }) => Promise<{ success: boolean; reservationId?: string; error?: string; message?: string }>;
    updateReservationStatus: (id: string, status: ReservationStatus, cancelReason?: string) => Promise<void>;
    updateReservation: (id: string, updates: {
        checkInDate?: Date;
        checkOutDate?: Date;
        siteId?: string;
        familyCount?: number;
        visitorCount?: number;
    }) => { success: boolean; oldPrice: number; newPrice: number; diff: number; error?: string };
    reset: () => void;

    // 예약 취소/환불 관련 액션
    fetchAllReservations: () => Promise<void>;
    fetchMyReservations: () => Promise<Reservation[]>;
    requestCancelReservation: (params: {
        reservationId: string;
        refundBank: string;
        refundAccount: string;
        refundHolder: string;
        cancelReason?: string;
    }) => Promise<{ success: boolean; refundRate?: number; refundAmount?: number; error?: string; message?: string }>;
    completeRefund: (reservationId: string) => Promise<{ success: boolean; error?: string; message?: string }>;

    // Helper to calculate price
    calculatePrice: (site: Site, checkIn: Date, checkOut: Date, familyCount: number, visitorCount: number) => PriceBreakdown;

    // Deposit Deadline Management
    deadlineHours: number; // 3, 6, 9, 12
    setDeadlineHours: (hours: number) => void;
    getOverdueReservations: () => { overdue: Reservation[], warning: Reservation[] };
    cancelOverdueReservations: () => void;
    validateReservation: (siteId: string, checkIn: Date, checkOut: Date) => string | null;
    initRebook: (siteId: string, familyCount?: number, visitorCount?: number, vehicleCount?: number, guestName?: string, guestPhone?: string) => void;

    // Last Reservation (for Smart Re-book)
    lastReservation: {
        siteId: string;
        siteName: string;
        familyCount: number;
        visitorCount: number;
        vehicleCount: number;
        checkInDate: Date;
        guestName?: string;
        guestPhone?: string;
    } | null;
    fetchLastReservation: () => Promise<void>;

    // Rebook Data (폼 자동 입력용)
    rebookData: {
        siteId: string;
        familyCount: number;
        visitorCount: number;
        vehicleCount: number;
        guestName?: string;
        guestPhone?: string;
    } | null;
    clearRebookData: () => void;

    // Generic User Contact Info (New Reservation용)
    userContactInfo: {
        guestName: string;
        guestPhone: string;
    } | null;
    fetchUserContactInfo: () => Promise<void>;

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

    // Public Reservations (Availability Check)
    fetchPublicReservations: (start: Date, end: Date) => Promise<void>;
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
            lastReservation: null, // Smart Re-book용 마지막 예약 정보
            rebookData: null, // Rebook 폼 자동 입력용
            userContactInfo: null, // 단순 연락처 정보 (New Reservation용)

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
                        type: (s.site_type as SiteType) || 'TENT',
                        description: s.description || '',
                        price: s.price || s.base_price,
                        basePrice: s.base_price,
                        maxOccupancy: s.capacity,
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

                // 삭제 전에 날짜/사이트 정보 저장 (빈자리 알림용)
                const { blockedDates } = get();
                const targetBlock = blockedDates.find(b => b.id === id);

                await supabase.from('blocked_dates').delete().eq('id', id);
                set((state) => ({ blockedDates: state.blockedDates.filter(b => b.id !== id) }));

                // 빈자리 알림 발송 (차단 해제 시)
                if (targetBlock) {
                    const startDateStr = targetBlock.startDate.toISOString().split('T')[0];
                    import('@/actions/waitlist-notifier').then(({ notifyWaitlistUsers }) => {
                        notifyWaitlistUsers(startDateStr, targetBlock.siteId)
                            .catch(err => console.error('[Store] Waitlist Notify on Block Remove Failed:', err));
                    });
                }
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
                            checkInDate: new Date(b.start_date),
                            checkOutDate: new Date(b.end_date),
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

            // 동시성 제어가 적용된 안전한 예약 생성 (DB RPC 사용)
            createReservationSafe: async (params) => {
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();

                // 현재 사용자 확인
                const { data: { user } } = await supabase.auth.getUser();
                const userId = user?.id || '00000000-0000-0000-0000-000000000000'; // Guest UUID

                console.log('[createReservationSafe] Call RPC with:', {
                    site_id: params.siteId,
                    check_in: formatLocalDate(params.checkIn),
                    check_out: formatLocalDate(params.checkOut)
                });

                // RPC 호출
                const { data, error } = await supabase.rpc('create_reservation_safe', {
                    p_user_id: userId,
                    p_site_id: params.siteId,
                    p_check_in: formatLocalDate(params.checkIn),
                    p_check_out: formatLocalDate(params.checkOut),
                    p_family_count: params.familyCount,
                    p_visitor_count: params.visitorCount,
                    p_vehicle_count: params.vehicleCount,
                    p_total_price: params.totalPrice,
                    p_guest_name: params.guestName,
                    p_guest_phone: params.guestPhone,
                    p_requests: params.requests || null
                });

                if (error) {
                    console.error('[createReservationSafe] RPC Error:', error);
                    return {
                        success: false,
                        error: 'RPC_ERROR',
                        message: (error as any).message || 'Unknown DB Error'
                    };
                }

                // RPC 반환값 파싱
                const result = data as { success: boolean; reservation_id?: string; error?: string; message?: string };

                if (result.success) {
                    // 로컬 상태에도 추가 (옵티미스틱 업데이트)
                    const newReservation: Reservation = {
                        id: result.reservation_id || Math.random().toString(36).substr(2, 9),
                        userId: userId,
                        siteId: params.siteId,
                        checkInDate: params.checkIn,
                        checkOutDate: params.checkOut,
                        familyCount: params.familyCount,
                        visitorCount: params.visitorCount,
                        vehicleCount: params.vehicleCount,
                        guests: params.familyCount + params.visitorCount,
                        totalPrice: params.totalPrice,
                        status: 'PENDING',
                        requests: params.requests || '',
                        createdAt: new Date()
                    };

                    set((state) => ({ reservations: [...state.reservations, newReservation] }));

                    // Notification Trigger (누락된 알림 코드 추가)
                    const { sites, siteConfig } = get();
                    const siteName = sites.find(s => s.id === params.siteId)?.name || '캠핑장';

                    // 입금 기한: 현재 + deadlineHours (default 6h)
                    const deadline = new Date(Date.now() + get().deadlineHours * 60 * 60 * 1000);

                    // Fire & Forget (await 하지 않음)
                    notificationService.dispatchNotification(
                        NotificationEventType.RESERVATION_SUBMITTED,
                        userId,
                        {
                            bankName: siteConfig?.bankName || '농협',
                            bankAccount: siteConfig?.bankAccount || '000-0000-0000-00',
                            bankHolder: siteConfig?.bankHolder || '라온아이',
                            totalPrice: params.totalPrice.toLocaleString(),
                            deadline: deadline.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                            checkIn: params.checkIn.toLocaleDateString(),
                            checkOut: params.checkOut.toLocaleDateString(),
                            siteName: siteName
                        },
                        result.reservation_id
                    ).catch(err => console.error('[Store] Notification Dispatch Failed:', err));
                }

                return {
                    success: result.success,
                    reservationId: result.reservation_id,
                    error: result.error,
                    message: result.message
                };
            },

            // 내 예약 목록 조회 (DB에서)
            fetchMyReservations: async () => {
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();

                const { data, error } = await supabase.rpc('get_my_reservations');

                if (error || !data) {
                    return [];
                }

                const mapped: Reservation[] = data.map((r: any) => ({
                    id: r.id,
                    userId: r.user_id,
                    siteId: r.site_id,
                    checkInDate: new Date(r.check_in_date),
                    checkOutDate: new Date(r.check_out_date),
                    familyCount: r.family_count || 1,
                    visitorCount: r.visitor_count || 0,
                    vehicleCount: r.vehicle_count || 1,
                    guests: r.guests || (r.family_count + r.visitor_count),
                    totalPrice: r.total_price || 0,
                    status: r.status,
                    requests: r.requests || '',
                    createdAt: new Date(r.created_at),
                    // 환불 관련 필드
                    refundBank: r.refund_bank,
                    refundAccount: r.refund_account,
                    refundHolder: r.refund_holder,
                    cancelReason: r.cancel_reason,
                    cancelledAt: r.cancelled_at ? new Date(r.cancelled_at) : undefined,
                    refundedAt: r.refunded_at ? new Date(r.refunded_at) : undefined,
                    refundAmount: r.refund_amount,
                    refundRate: r.refund_rate
                }));

                // 로컬 상태도 업데이트
                set({ reservations: mapped });
                return mapped;
            },

            // 관리자용: 모든 예약 조회
            fetchAllReservations: async () => {
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();

                // RLS 정책에 따라 관리자는 모든 예약을 볼 수 있음
                const { data, error } = await supabase
                    .from('reservations')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error || !data) {
                    console.error('Failed to fetch all reservations:', error);
                    return;
                }

                const mapped: Reservation[] = data.map((r: any) => ({
                    id: r.id,
                    userId: r.user_id,
                    siteId: r.site_id,
                    checkInDate: new Date(r.check_in_date),
                    checkOutDate: new Date(r.check_out_date),
                    familyCount: r.family_count || 1,
                    visitorCount: r.visitor_count || 0,
                    vehicleCount: r.vehicle_count || 1,
                    guests: r.guests || (r.family_count + r.visitor_count),
                    totalPrice: r.total_price || 0,
                    status: r.status,
                    guestName: r.guest_name, // Guest Name Mapping
                    guestPhone: r.guest_phone,
                    requests: r.requests || '',
                    createdAt: new Date(r.created_at),
                    // 환불 관련 필드
                    refundBank: r.refund_bank,
                    refundAccount: r.refund_account,
                    refundHolder: r.refund_holder,
                    cancelReason: r.cancel_reason,
                    cancelledAt: r.cancelled_at ? new Date(r.cancelled_at) : undefined,
                    refundedAt: r.refunded_at ? new Date(r.refunded_at) : undefined,
                    refundAmount: r.refund_amount,
                    refundRate: r.refund_rate
                }));

                set({ reservations: mapped });
            },

            // 공개 예약 조회 (마감 현황 확인용)
            fetchPublicReservations: async (start: Date, end: Date) => {
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();

                // RPC 호출
                const { data, error } = await supabase.rpc('get_public_reservations', {
                    p_start_date: formatLocalDate(start),
                    p_end_date: formatLocalDate(end)
                });

                if (error || !data) {
                    console.error('[Store] Failed to fetch public reservations:', error);
                    return;
                }

                const publicReservations: Reservation[] = data.map((r: any) => ({
                    id: `public-${r.site_id}-${r.check_in_date}`, // 임시 ID
                    userId: '00000000-0000-0000-0000-000000000000', // 익명
                    siteId: r.site_id,
                    checkInDate: new Date(r.check_in_date),
                    checkOutDate: new Date(r.check_out_date),
                    familyCount: 1,
                    visitorCount: 0,
                    vehicleCount: 1,
                    guests: 1,
                    totalPrice: 0,
                    status: 'CONFIRMED', // 마감 처리됨
                    requests: '',
                    createdAt: new Date(),
                }));

                // 기존 예약(내 예약 등)과 병합하되 중복 제거
                set((state) => {
                    // 기존 예약 중복 방지 (ID 기준) - public은 ID가 임의생성이므로 날짜/사이트로 비교해야 완벽하지만,
                    // 일단 기존 것을 유지하고 public을 추가하는 식이면 '내 예약'이 덮어써질 수 있음(상세 정보 부족).
                    // 따라서 '내 예약'이 있으면 public을 무시하도록 하거나, 아니면 그냥 view 용도이므로 합침.
                    // SiteList에서는 마감 여부만 중요함.

                    // 내 예약(상세 정보 있음)은 유지하고, 없는 것만 추가
                    const existingIds = new Set(state.reservations.map(r => `${r.siteId}-${r.checkInDate.toISOString()}`));

                    const newReservations = publicReservations.filter(r =>
                        !existingIds.has(`${r.siteId}-${r.checkInDate.toISOString()}`)
                    );

                    return {
                        reservations: [...state.reservations, ...newReservations]
                    };
                });
            },

            // 사용자 취소 요청
            requestCancelReservation: async (params) => {
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();

                const { data, error } = await supabase.rpc('request_reservation_cancel', {
                    p_reservation_id: params.reservationId,
                    p_refund_bank: params.refundBank,
                    p_refund_account: params.refundAccount,
                    p_refund_holder: params.refundHolder,
                    p_cancel_reason: params.cancelReason || null
                });

                if (error) {
                    return { success: false, error: 'RPC_ERROR', message: error.message };
                }

                const result = data as { success: boolean; refund_rate?: number; refund_amount?: number; error?: string; message?: string };

                if (result.success) {
                    // 로컬 상태 업데이트
                    set((state) => ({
                        reservations: state.reservations.map((res) =>
                            res.id === params.reservationId
                                ? {
                                    ...res,
                                    status: 'REFUND_PENDING' as const,
                                    refundBank: params.refundBank,
                                    refundAccount: params.refundAccount,
                                    refundHolder: params.refundHolder,
                                    cancelReason: params.cancelReason,
                                    refundRate: result.refund_rate,
                                    refundAmount: result.refund_amount,
                                    cancelledAt: new Date()
                                }
                                : res
                        )
                    }));

                    // Notification Trigger (사용자 취소 알림)
                    const targetReservation = get().reservations.find(r => r.id === params.reservationId);
                    if (targetReservation && targetReservation.userId) {
                        const siteName = get().sites.find(s => s.id === targetReservation.siteId)?.name || targetReservation.siteId;

                        notificationService.dispatchNotification(
                            NotificationEventType.RESERVATION_CANCELLED,
                            targetReservation.userId,
                            {
                                siteName,
                                checkIn: targetReservation.checkInDate.toLocaleDateString(),
                                checkOut: targetReservation.checkOutDate.toLocaleDateString(),
                                reservation_id: params.reservationId
                            },
                            params.reservationId
                        ).catch(err => console.error('[Store] Cancel Notification Failed:', err));

                        // 빈자리 알림 발송 (Server Action 호출)
                        const checkInDateStr = targetReservation.checkInDate.toISOString().split('T')[0];
                        import('@/actions/waitlist-notifier').then(({ notifyWaitlistUsers }) => {
                            notifyWaitlistUsers(checkInDateStr, targetReservation.siteId)
                                .catch(err => console.error('[Store] Waitlist Notify Failed:', err));
                        });
                    }
                }

                return {
                    success: result.success,
                    refundRate: result.refund_rate,
                    refundAmount: result.refund_amount,
                    error: result.error,
                    message: result.message
                };
            },

            // 관리자 환불 완료 처리
            completeRefund: async (reservationId) => {
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();

                const { data, error } = await supabase.rpc('complete_reservation_refund', {
                    p_reservation_id: reservationId
                });

                if (error) {
                    return { success: false, error: 'RPC_ERROR', message: error.message };
                }

                const result = data as { success: boolean; error?: string; message?: string };

                if (result.success) {
                    set((state) => ({
                        reservations: state.reservations.map((res) =>
                            res.id === reservationId
                                ? { ...res, status: 'REFUNDED' as const, refundedAt: new Date() }
                                : res
                        )
                    }));
                }

                return result;
            },

            // 예약 상태 변경 (DB + 로컬 동기화)
            updateReservationStatus: async (id, status, cancelReason) => {
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();

                // DB 업데이트 (취소 사유가 있으면 함께 업데이트)
                const updateData: any = { status, updated_at: new Date().toISOString() };
                if (status === 'CANCELLED' && cancelReason) {
                    updateData.cancel_reason = cancelReason;
                    updateData.cancelled_at = new Date().toISOString();
                }

                const { error } = await supabase
                    .from('reservations')
                    .update(updateData)
                    .eq('id', id);

                if (error) {
                    console.error('Failed to update reservation status:', error);
                    return;
                }

                // Notification Trigger
                // 먼저 로컬 스토어에서 찾고, 없으면 DB에서 직접 조회 (Admin 콘솔 대응)
                let targetReservation = get().reservations.find(r => r.id === id);

                if (!targetReservation) {
                    // Admin 페이지에서 호출 시 로컬 스토어에 없을 수 있음 -> DB에서 직접 조회
                    const { data: dbReservation } = await supabase
                        .from('reservations')
                        .select('id, user_id, site_id, check_in_date, check_out_date')
                        .eq('id', id)
                        .single();

                    if (dbReservation) {
                        targetReservation = {
                            id: dbReservation.id,
                            userId: dbReservation.user_id,
                            siteId: dbReservation.site_id,
                            checkInDate: new Date(dbReservation.check_in_date),
                            checkOutDate: new Date(dbReservation.check_out_date),
                        } as any;
                    }
                }

                if (targetReservation && targetReservation.userId) {
                    const siteName = get().sites.find(s => s.id === targetReservation!.siteId)?.name || '캠핑장';
                    const payload = {
                        siteName,
                        checkIn: targetReservation.checkInDate.toLocaleDateString(),
                        checkOut: targetReservation.checkOutDate.toLocaleDateString(),
                        reason: cancelReason || '관리자 취소'
                    };

                    // A. 예약 확정 (CONFIRMED)
                    if (status === 'CONFIRMED') {
                        notificationService.dispatchNotification(
                            NotificationEventType.RESERVATION_CONFIRMED,
                            targetReservation.userId,
                            payload,
                            id
                        ).catch(err => console.error('[Store] Reservation Confirmed Notification Failed:', err));
                    }
                    // B. 예약 취소 (CANCELLED)
                    else if (status === 'CANCELLED') {
                        notificationService.dispatchNotification(
                            NotificationEventType.RESERVATION_CANCELLED,
                            targetReservation.userId,
                            payload,
                            id
                        ).catch(err => console.error('[Store] Cancel Notification Failed:', err));

                        // 빈자리 알림 발송 (Server Action 호출)
                        const checkInDateStr = targetReservation.checkInDate.toISOString().split('T')[0];
                        import('@/actions/waitlist-notifier').then(({ notifyWaitlistUsers }) => {
                            notifyWaitlistUsers(checkInDateStr, targetReservation.siteId)
                                .catch(err => console.error('[Store] Waitlist Notify Failed:', err));
                        });
                    }
                }

                // 로컬 상태도 업데이트
                set((state) => ({
                    reservations: state.reservations.map((res) =>
                        res.id === id ? {
                            ...res,
                            status,
                            cancelReason: status === 'CANCELLED' ? cancelReason : res.cancelReason,
                            cancelledAt: status === 'CANCELLED' ? new Date() : res.cancelledAt
                        } : res
                    ),
                }));
            },

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

            // Smart Re-book용 마지막 예약 조회
            // Smart Re-book용 마지막 예약 조회
            fetchLastReservation: async () => {
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();

                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    set({ lastReservation: null });
                    return;
                }

                // Most recent CONFIRMED or COMPLETED reservation
                // Removed sites(name) join to avoid RLS/FK issues
                const { data, error } = await supabase
                    .from('reservations')
                    .select(`
                        id,
                        site_id,
                        family_count,
                        visitor_count,
                        vehicle_count,
                        check_in_date,
                        guest_name,
                        guest_phone
                    `)
                    .eq('user_id', user.id)
                    .in('status', ['CONFIRMED', 'COMPLETED'])
                    .order('check_in_date', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (error) {
                    console.error('[Store] fetchLastReservation Error:', error);
                    set({ lastReservation: null });
                    return;
                }

                if (!data) {
                    set({ lastReservation: null });
                    return;
                }

                // Find site name from local store (safe)
                const { sites } = get();
                const site = sites.find(s => s.id === data.site_id);
                const siteName = site ? site.name : (data.site_id || '알 수 없는 사이트');

                set({
                    lastReservation: {
                        siteId: data.site_id,
                        siteName: siteName,
                        familyCount: data.family_count || 1,
                        visitorCount: data.visitor_count || 0,
                        vehicleCount: data.vehicle_count || 1,
                        checkInDate: new Date(data.check_in_date),
                        guestName: data.guest_name || undefined,
                        guestPhone: data.guest_phone || undefined
                    }
                });
            },

            initRebook: (siteId, familyCount, visitorCount, vehicleCount, guestName, guestPhone) => {
                // 사이트 선택
                const { sites, lastReservation } = get();
                const site = sites.find(s => s.id === siteId);
                if (site) {
                    set({ selectedSite: site });
                }

                // Rebook 데이터 저장 (폼 자동 입력용)
                set({
                    rebookData: {
                        siteId,
                        familyCount: familyCount ?? lastReservation?.familyCount ?? 1,
                        visitorCount: visitorCount ?? lastReservation?.visitorCount ?? 0,
                        vehicleCount: vehicleCount ?? lastReservation?.vehicleCount ?? 1,
                        guestName: guestName ?? lastReservation?.guestName,
                        guestPhone: guestPhone ?? lastReservation?.guestPhone
                    }
                });
            },

            fetchUserContactInfo: async () => {
                const { createClient } = await import('@/lib/supabase-client');
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // 상태 상관없이 가장 최근 예약 1건 조회 (이름/연락처만)
                const { data } = await supabase
                    .from('reservations')
                    .select('guest_name, guest_phone')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (data && data.guest_name && data.guest_phone) {
                    set({
                        userContactInfo: {
                            guestName: data.guest_name,
                            guestPhone: data.guest_phone
                        }
                    });
                }
            },

            clearRebookData: () => set({ rebookData: null }),

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

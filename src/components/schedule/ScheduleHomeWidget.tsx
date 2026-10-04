'use client';

import { useState, useEffect, useMemo, memo, useRef } from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, ChevronRight, Tent, Clock, Plus, MapPin, Loader2 } from 'lucide-react';
import { Schedule, getMySchedules, ensureScheduleFromReservation } from '@/actions/schedule';
import { useReservationStore } from '@/store/useReservationStore';
import { Reservation } from '@/types/reservation';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { SITES } from '@/constants/sites';
import { useWeather } from '@/hooks/useWeather';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { createClient } from '@/lib/supabase-client';

const CancelReservationSheet = dynamic(() => import('@/components/reservation/CancelReservationSheet'), {
    ssr: false
});

// 통합 일정 타입 (라온아이 예약 또는 타캠핑장 일정)
interface UnifiedSchedule {
    type: 'reservation' | 'schedule';
    id: string;
    name: string;
    checkIn: Date;
    checkOut: Date;
    source?: 'raonai' | 'external';
    siteId?: string;
    status?: 'PENDING' | 'CONFIRMED' | 'REFUND_PENDING'; // 예약 상태 (입금대기/확정/환불대기)
    category?: string;
}

interface ScheduleHomeWidgetProps {
    isExpanded?: boolean;
    showButtons?: boolean;
    hideOtherScheduleButton?: boolean;
    scheduleButtonText?: string;
}

/**
 * 홈 화면에서 다가오는 캠핑 일정을 보여주는 위젯
 * 라온아이 예약 + 타캠핑장 일정을 통합하여 가장 가까운 1개 표시
 */
const ScheduleHomeWidget = memo(function ScheduleHomeWidget({ 
    isExpanded = false,
    showButtons = true,
    hideOtherScheduleButton = true,
    scheduleButtonText = '나의 전체 여행일정',
}: ScheduleHomeWidgetProps) {
    const router = useRouter();
    const { withAuth } = useRequireAuth();
    const supabase = useMemo(() => createClient(), []);
    const { reservations, fetchMyReservations, updateReservationStatus } = useReservationStore();
    const [schedules, setSchedules] = useState<Schedule[]>(() => {
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem('user_schedules_cache');
            if (raw) {
                const list = JSON.parse(raw);
                if (Array.isArray(list)) return list as Schedule[];
            }
        } catch {}
        return [];
    });
    const schedulesRef = useRef(schedules);
    useEffect(() => { schedulesRef.current = schedules; }, [schedules]);

    const isComponentMounted = useRef(true);
    useEffect(() => {
        isComponentMounted.current = true;
        return () => {
            isComponentMounted.current = false;
        };
    }, []);

    // 로그인 인증 상태 (초기값 null = 확인 중)
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    // 마운트 시 뒤로가기 복귀 여부 확인
    const isBackFromDetail = useMemo(() => {
        if (typeof window === 'undefined') return false;
        try {
            return window.sessionStorage?.getItem('raonai_back_from_detail') === 'true';
        } catch {
            return false;
        }
    }, []);

    // 로컬스토리지 동기 캐시 파싱 (라온아이 예약) - 비로그인 시 일체 배제
    const cachedReservations = useMemo<Reservation[]>(() => {
        if (isAuthenticated === false) return [];
        if (reservations && reservations.length > 0) return reservations;
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem('reservation-storage-v3') || localStorage.getItem('reservation-storage-v2');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            const list = parsed?.state?.reservations;
            if (!Array.isArray(list)) return [];
            return list as Reservation[];
        } catch {
            return [];
        }
    }, [reservations, isAuthenticated]);

    // 로컬스토리지 동기 캐시 파싱 (타캠핑장 일정) - 비로그인 시 일체 배제
    const cachedSchedules = useMemo<Schedule[]>(() => {
        if (isAuthenticated === false) return [];
        if (schedules && schedules.length > 0) return schedules;
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem('user_schedules_cache');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed as Schedule[];
        } catch {
            return [];
        }
    }, [schedules, isAuthenticated]);

    // 로딩 상태: 오늘 날짜(YYYY-MM-DD)에 이미 최신화된 캐시가 존재하거나 뒤로가기 복귀 시에는 0초 즉시 노출(false), 
    // 날짜가 바뀌었거나(오늘 첫 접속) 캐시가 아예 없을 때만 첫 스켈레톤(true) 노출 후 백그라운드 정밀 동기화 수행
    const [isLoading, setIsLoading] = useState(() => {
        if (isBackFromDetail) return false;
        if (typeof window === 'undefined') return true;
        try {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const lastSyncDate = localStorage.getItem('last_schedule_sync_date');
            const isSyncedToday = lastSyncDate === todayStr;

            const hasRes = !!(localStorage.getItem('reservation-storage-v3') || localStorage.getItem('reservation-storage-v2'));
            const hasSched = !!localStorage.getItem('user_schedules_cache');

            // 오늘 이미 1회 이상 검증/최신화가 완료되었고 캐시가 존재하는 경우에만 0초 즉시 노출
            if (isSyncedToday && (hasRes || hasSched)) return false;
        } catch {}
        return true;
    });

    const [isNavigating, setIsNavigating] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [dontShowToday, setDontShowToday] = useState(false);

    // 활성 예약 및 일정 (로컬 캐시 동기 참조 0.00초 보장)
    const activeReservations = useMemo<Reservation[]>(() => {
        if (cachedReservations && cachedReservations.length > 0) return cachedReservations;
        return isAuthenticated ? reservations : [];
    }, [cachedReservations, reservations, isAuthenticated]);

    const activeSchedules = useMemo<Schedule[]>(() => {
        if (cachedSchedules && cachedSchedules.length > 0) return cachedSchedules;
        return isAuthenticated ? schedules : [];
    }, [cachedSchedules, schedules, isAuthenticated]);

    // 통합 일정 계산 (라온아이 예약 + 타캠핑장 일정)
    const upcomingItem = useMemo(() => {
        // [Security] 비로그인 상태가 확인되면 어떤 캐시도 노출하지 않고 즉시 null 반환
        if (isAuthenticated === false) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const unifiedList: UnifiedSchedule[] = [];

        // 라온아이 예약 필터링
        if (Array.isArray(activeReservations)) {
            activeReservations.forEach(r => {
                try {
                    if (!r || !r.checkInDate || !r.checkOutDate) return;
                    const checkIn = new Date(r.checkInDate);
                    const checkOut = new Date(r.checkOutDate);
                    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) return;

                    const checkOutZero = new Date(checkOut);
                    checkOutZero.setHours(0, 0, 0, 0);

                    if (checkOutZero >= today && (r.status === 'PENDING' || r.status === 'CONFIRMED' || r.status === 'REFUND_PENDING')) {
                        const site = SITES.find(s => s.id === r.siteId);
                        unifiedList.push({
                            type: 'reservation',
                            id: r.id,
                            name: site?.name || r.siteId,
                            checkIn,
                            checkOut,
                            siteId: r.siteId,
                            status: r.status as 'PENDING' | 'CONFIRMED' | 'REFUND_PENDING'
                        });
                    }
                } catch {}
            });
        }

        // 타캠핑장 일정 필터링 (라온아이 예약과 연동된 일정 또는 raonai 소스는 중복 제외)
        if (Array.isArray(activeSchedules)) {
            activeSchedules.forEach(s => {
                try {
                    if (!s || !s.check_in || !s.check_out) return;
                    if (s.reservation_id && Array.isArray(activeReservations) && activeReservations.some(r => r.id === s.reservation_id)) {
                        return;
                    }
                    if (s.source === 'raonai') {
                        return;
                    }

                    const checkIn = parseISO(s.check_in);
                    const checkOut = parseISO(s.check_out);
                    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) return;

                    const checkOutZero = new Date(checkOut);
                    checkOutZero.setHours(0, 0, 0, 0);

                    if (checkOutZero >= today && s.status === 'scheduled') {
                        unifiedList.push({
                            type: 'schedule',
                            id: s.id,
                            name: s.campground_name,
                            checkIn,
                            checkOut,
                            source: s.source
                        });
                    }
                } catch {}
            });
        }

        // 체크인 날짜 기준 정렬 후 가장 가까운 것 선택
        unifiedList.sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());
        return unifiedList[0] || null;
    }, [cachedReservations, reservations, cachedSchedules, schedules, isAuthenticated]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // date-fns 렌더링 용 안전 Date 파서 (크래시 완전 방지)
    const safeCheckIn = useMemo(() => {
        if (!upcomingItem?.checkIn) return null;
        const d = new Date(upcomingItem.checkIn);
        return isNaN(d.getTime()) ? null : d;
    }, [upcomingItem]);

    const safeCheckOut = useMemo(() => {
        if (!upcomingItem?.checkOut) return null;
        const d = new Date(upcomingItem.checkOut);
        return isNaN(d.getTime()) ? null : d;
    }, [upcomingItem]);

    const daysUntil = safeCheckIn ? differenceInDays(safeCheckIn, today) : 999;
    const isCampingNow = !!(safeCheckIn && safeCheckOut && (today >= safeCheckIn && today <= safeCheckOut));
    const isWeatherEnabled = safeCheckIn ? (daysUntil <= 10 && isExpanded) : false;

    const itemLat = upcomingItem?.type === 'reservation' ? undefined : (schedules.find(s => s.id === upcomingItem?.id)?.campground_lat || undefined);
    const itemLng = upcomingItem?.type === 'reservation' ? undefined : (schedules.find(s => s.id === upcomingItem?.id)?.campground_lng || undefined);

    const weather = useWeather(itemLat, itemLng, isWeatherEnabled);

    useEffect(() => {
        let isSubscribed = true;

        const checkAuthAndFetch = async () => {
            // [0ms 즉시 판정] 쿠키 및 스토리지에 Supabase 인증 토큰이 아예 없다면 비로그인으로 즉시 확정하여 불필요한 대기 원천 차단
            const hasAuthToken = (typeof document !== 'undefined' && document.cookie.includes('sb-')) ||
                (typeof window !== 'undefined' && Object.keys(localStorage).some(k => k.includes('auth-token') || k.startsWith('sb-')));

            if (!hasAuthToken) {
                if (isSubscribed) {
                    setIsAuthenticated(false);
                    setSchedules([]);
                    setIsLoading(false);
                }
                return;
            }

            try {
                // Fail-safe timeout (4초): 만에 하나 브라우저 Web Locks 지연이 발생하더라도 스켈레톤 무한 대기 원천 방어
                const sessionPromise = supabase.auth.getSession();
                const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
                    setTimeout(() => resolve({ data: { session: null } }), 4000)
                );
                const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
                if (!isSubscribed) return;

                if (!session?.user) {
                    setIsAuthenticated(false);
                    setSchedules([]);
                    setIsLoading(false);
                    return;
                }

                setIsAuthenticated(true);

                // 백그라운드 Silent Revalidation
                await fetchMyReservations();
                const schedulesData = await getMySchedules('scheduled');
                if (!isSubscribed) return;
                setSchedules(schedulesData);
                try {
                    localStorage.setItem('user_schedules_cache', JSON.stringify(schedulesData));
                    const todayStr = format(new Date(), 'yyyy-MM-dd');
                    localStorage.setItem('last_schedule_sync_date', todayStr);
                } catch {}
            } catch (error) {
                console.error('Fetch error:', error);
            } finally {
                if (isSubscribed) {
                    setIsLoading(false);
                }
            }
        };

        checkAuthAndFetch();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isSubscribed) return;
            if (event === 'SIGNED_OUT' || !session) {
                setIsAuthenticated(false);
                setSchedules([]);
                setIsLoading(false);
            } else if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session)) {
                setIsAuthenticated(true);
                // 로그인 감지 즉시 내 예약 및 일정 데이터 자동 재조회
                try {
                    await fetchMyReservations();
                    const schedulesData = await getMySchedules('scheduled');
                    if (!isSubscribed) return;
                    setSchedules(schedulesData);
                    try {
                        localStorage.setItem('user_schedules_cache', JSON.stringify(schedulesData));
                        const todayStr = format(new Date(), 'yyyy-MM-dd');
                        localStorage.setItem('last_schedule_sync_date', todayStr);
                    } catch {}
                } catch (error) {
                    console.error('[ScheduleHomeWidget] Error fetching on auth change:', error);
                } finally {
                    if (isSubscribed) {
                        setIsLoading(false);
                    }
                }
            } else if (session) {
                setIsAuthenticated(true);
            }
        });

        return () => {
            isSubscribed = false;
            subscription.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase]);



    // 스마트플랜 사용 가능 여부 판별 (예약 생성 새벽 5시 이전 당일 9시, 이후 다음날 오전 9시 활성화)
    const isSmartPlanAvailable = useMemo(() => {
        if (!upcomingItem) return false;
        
        let createdAtDate: Date;
        
        if (upcomingItem.type === 'reservation') {
            const reservation = activeReservations.find(r => r.id === upcomingItem.id);
            if (!reservation || reservation.status !== 'CONFIRMED') return false;
            createdAtDate = new Date(reservation.createdAt);
        } else {
            const schedule = activeSchedules.find(s => s.id === upcomingItem.id);
            if (!schedule || schedule.status !== 'scheduled') return false;
            createdAtDate = new Date(schedule.created_at);
        }
        
        if (isNaN(createdAtDate.getTime())) return false;
        
        const unlockTimeByCreation = new Date(createdAtDate);
        if (createdAtDate.getHours() < 5) {
            unlockTimeByCreation.setHours(9, 0, 0, 0);
        } else {
            unlockTimeByCreation.setDate(unlockTimeByCreation.getDate() + 1);
            unlockTimeByCreation.setHours(9, 0, 0, 0);
        }

        return new Date() >= unlockTimeByCreation;
    }, [upcomingItem, activeReservations, activeSchedules]);

    // 스마트플랜 오픈 대기 여부 판별
    const isSmartPlanUnlockingSoon = useMemo(() => {
        if (!upcomingItem) return false;
        
        let createdAtDate: Date;
        let hasSmartPlan = false;
        
        if (upcomingItem.type === 'reservation') {
            const reservation = activeReservations.find(r => r.id === upcomingItem.id);
            if (!reservation || reservation.status !== 'CONFIRMED') return false;
            createdAtDate = new Date(reservation.createdAt);
            
            // 이미 생성된 일정에 smart_plan_data가 있는지 체크
            const matchedSchedule = activeSchedules.find(s => s.reservation_id === upcomingItem.id);
            if (matchedSchedule && matchedSchedule.smart_plan_data) {
                hasSmartPlan = true;
            }
        } else {
            const schedule = activeSchedules.find(s => s.id === upcomingItem.id);
            if (!schedule || schedule.status !== 'scheduled') return false;
            createdAtDate = new Date(schedule.created_at);
            hasSmartPlan = !!schedule.smart_plan_data;
        }
        
        if (isNaN(createdAtDate.getTime()) || hasSmartPlan) return false;
        
        const unlockTimeByCreation = new Date(createdAtDate);
        if (createdAtDate.getHours() < 5) {
            unlockTimeByCreation.setHours(9, 0, 0, 0);
        } else {
            unlockTimeByCreation.setDate(unlockTimeByCreation.getDate() + 1);
            unlockTimeByCreation.setHours(9, 0, 0, 0);
        }

        return new Date() < unlockTimeByCreation;
    }, [upcomingItem, activeReservations, activeSchedules]);

    // 뱃지 텍스트 결정 (스마트플랜 5단계 동적 D-Day 생명주기 뱃지 수식 - ScheduleCard와 100% 동일화)
    const badgeText = useMemo(() => {
        if (!upcomingItem) return '';

        // [v14.5.0] 결제 대기(PENDING) 또는 환불 대기(REFUND_PENDING) 상태에서는 여행계획 생성 유도 배지를 완전히 숨김
        if (upcomingItem.type === 'reservation' && (upcomingItem.status === 'PENDING' || upcomingItem.status === 'REFUND_PENDING')) {
            return null;
        }
        
        let smartPlanData: any = null;
        if (upcomingItem.type === 'schedule') {
            const schedule = activeSchedules.find(s => s.id === upcomingItem.id);
            smartPlanData = schedule?.smart_plan_data;
        } else if (upcomingItem.type === 'reservation') {
            const matchedSchedule = activeSchedules.find(s => s.reservation_id === upcomingItem.id);
            smartPlanData = matchedSchedule?.smart_plan_data;
        }

        const hasPlanData = !!smartPlanData;
        const isPreviewPlan = smartPlanData?.is_preview === true;
        const weatherWindow = smartPlanData?.weather_window || 'NONE';

        // 5단계: 사용자가 정밀/업데이트 플랜 작성을 완전히 완료한 경우
        if (hasPlanData && !isPreviewPlan) {
            if (daysUntil <= 0) {
                if (weatherWindow !== 'SHORT') {
                    return '⚡ 당일 정밀날씨 업데이트 가능';
                }
                return '✨ 출발 당일 플랜 최신화 완료';
            }
            if (daysUntil <= 7 && daysUntil >= 1) {
                if (weatherWindow === 'NONE') {
                    return '🌤️ 날씨정보 업데이트 가능';
                }
                return '✨ 주간 예보 업데이트 완료';
            }
            return '✨ 스마트플랜 생성 완료';
        }

        // 3/4단계: DB 캐싱 완료 & 오전 9시 도달 시 (정밀 스마트플랜 생성 관문)
        if (isSmartPlanAvailable) {
            if (daysUntil <= 0) {
                return '⚡ 당일 정밀날씨 업데이트 가능';
            }
            if (daysUntil <= 7 && daysUntil >= 1) {
                return '🌤️ 날씨정보 업데이트 가능';
            }
            return '✨ 정밀 스마트플랜 생성가능';
        }

        // 2단계: 즉시 여행계획이 이미 생성된 상태 (~ 오전 9시 전)
        if (hasPlanData && isPreviewPlan) {
            return '⚡ 즉시 여행계획 생성 완료';
        }

        // 1단계: 즉시 여행계획 생성 전 (신규 등록 직후)
        return "⚡ 즉시 여행계획 생성가능!, 터치해보세요!";
    }, [upcomingItem, isSmartPlanAvailable, activeSchedules, daysUntil]);

    const handleCardClick = () => {
        withAuth(async () => {
            if (!upcomingItem || isNavigating) return;
            try { window.sessionStorage?.setItem('raonai_back_from_detail', 'true'); } catch {}

            // 라온아이 입금대기 또는 취소/환불대기 상태면 예약 목록 페이지로 (스케줄 생성 X)
            if (upcomingItem.type === 'reservation' && (upcomingItem.status === 'PENDING' || upcomingItem.status === 'REFUND_PENDING')) {
                router.push('/myspace/reservations');
                return;
            }

            // 이미 Schedules 목록에 매핑된 일정이 존재하는 경우 비동기 서버 액션 호출 없이 0.001초 직통 이동
            const matchedSchedule = activeSchedules.find(s => s.reservation_id === upcomingItem.id);
            if (matchedSchedule) {
                setIsNavigating(true);
                router.push(`/myspace/schedule/${matchedSchedule.id}`);
                return;
            }

            // 그 외 (예약 확정, 타캠핑장) -> 일정 상세 페이지로
            if (upcomingItem.type === 'reservation') {
                setIsNavigating(true);
                try {
                    // 백그라운드 동기화와 겹치거나 지연 생성 시 직접 호출
                    const result = await ensureScheduleFromReservation(upcomingItem.id);

                    // [v11.9.150] 비동기 처리 도중 이미 컴포넌트가 언마운트(이탈/튕김) 되었다면 라우팅 방지
                    if (!isComponentMounted.current) {
                        console.warn('[ScheduleHomeWidget] Component unmounted during schedule ensuring. Skipping push.');
                        return;
                    }

                    if (result.success && result.scheduleId) {
                        router.push(`/myspace/schedule/${result.scheduleId}`);
                    } else {
                        console.error('Failed to ensure schedule:', result.error);
                        toast.error('일정을 준비 중입니다. 잠시 후 다시 클릭해 주세요.');
                        setIsNavigating(false);
                    }
                } catch (e) {
                    if (isComponentMounted.current) {
                        console.error('Navigation error:', e);
                        toast.error('일정을 불러오는 중 오류가 발생했습니다.');
                        setIsNavigating(false);
                    }
                }
            } else {
                // 이미 스케줄임
                setIsNavigating(true);
                router.push(`/myspace/schedule/${upcomingItem.id}`);
            }
        });
    };

    // 취소 대상 라온아이 예약 객체
    const selectedReservationForCancel = useMemo(() => {
        if (!upcomingItem || upcomingItem.type !== 'reservation') return null;
        return activeReservations.find(r => r.id === upcomingItem.id) || null;
    }, [upcomingItem, activeReservations]);

    // 취소 관련 상태
    const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
    const [isDirectCancelling, setIsDirectCancelling] = useState(false);

    // 취소 버튼 클릭 핸들러 (카드 클릭 간섭 원천 차단)
    const handleCancelClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!selectedReservationForCancel) return;

        if (selectedReservationForCancel.status === 'PENDING') {
            setCancelConfirmOpen(true);
        } else if (selectedReservationForCancel.status === 'CONFIRMED') {
            setCancelSheetOpen(true);
        }
    };

    // 입금대기 예약 즉시 취소 핸들러
    const handleDirectCancel = async () => {
        if (!selectedReservationForCancel) return;
        setIsDirectCancelling(true);
        try {
            await updateReservationStatus(selectedReservationForCancel.id, 'CANCELLED');
            toast.success('예약이 정상적으로 취소되었습니다.');
            setCancelConfirmOpen(false);
            await fetchMyReservations();
            const latest = await getMySchedules();
            setSchedules(latest);
        } catch (err: any) {
            toast.error(err?.message || '예약 취소에 실패했습니다.');
        } finally {
            setIsDirectCancelling(false);
        }
    };

    // 예약확정 취소(환불 요청) 완료 핸들러
    const handleCancelComplete = async () => {
        setCancelSheetOpen(false);
        toast.success('예약 취소(환불 요청)가 정상 접수되었습니다.');
        try {
            await fetchMyReservations();
            const latest = await getMySchedules();
            setSchedules(latest);
        } catch {}
    };

    const handleExternalScheduleClick = () => {
        withAuth(() => {
            if (!isComponentMounted.current) return;
            try { window.sessionStorage?.setItem('raonai_back_from_detail', 'true'); } catch {}
            let hideTime: string | null = null;
            try { hideTime = localStorage.getItem('raonai_hide_add_alert_today'); } catch {}
            const now = new Date().getTime();
            
            if (hideTime && now < parseInt(hideTime, 10)) {
                if (isComponentMounted.current) {
                    router.push('/myspace/schedule?add=external');
                }
            } else {
                setDontShowToday(false);
                setIsAlertOpen(true);
            }
        });
    };

    const handleConfirmExternalAlert = () => {
        try { window.sessionStorage?.setItem('raonai_back_from_detail', 'true'); } catch {}
        if (dontShowToday) {
            const expireTime = new Date().getTime() + 24 * 60 * 60 * 1000;
            try { localStorage.setItem('raonai_hide_add_alert_today', expireTime.toString()); } catch {}
        }
        setIsAlertOpen(false);
        if (isComponentMounted.current) {
            router.push('/myspace/schedule?add=external');
        }
    };

    // 로딩 (새로고침 / 첫 진입 데이터 조회 중)
    if (isLoading) {
        return (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-[#388E5A]/20 shadow-sm flex items-center gap-3.5 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-[#388E5A]/10 flex items-center justify-center text-[#388E5A] dark:text-emerald-400 shrink-0">
                    <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <div className="space-y-0.5">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-stone-100 flex items-center gap-1.5">
                        일정을 불러오고 있습니다...
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                        잠시만 기다려주시면 다가오는 여행을 안내해 드립니다.
                    </p>
                </div>
            </div>
        );
    }

    // 일정 없음 (등록된 일정이 없는 신규/기존 유저)
    if (!upcomingItem) {
        return (
            <>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4.5 border-2 border-dashed border-[#A7CCA8] shadow-xs flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#EDF5EE] flex items-center justify-center text-[#388E5A] dark:text-emerald-400 shrink-0">
                        <Calendar className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">다가오는 여행 일정이 없습니다</h4>
                    </div>
                </div>

                {showButtons && (
                    <div className="flex flex-col gap-2 w-full mt-2">
                        {!hideOtherScheduleButton && (
                            <button
                                onClick={handleExternalScheduleClick}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#388E5A] hover:bg-[#2F774B] text-white rounded-xl text-sm font-semibold shadow-md active:scale-[0.98] transition-all duration-200"
                            >
                                <Plus className="w-4 h-4" />
                                <span>다른 여행 일정추가</span>
                            </button>
                        )}
                        <button
                            onClick={() => withAuth(() => router.push('/myspace/schedule'))}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#388E5A] hover:bg-[#2F774B] text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all active:scale-[0.98] duration-200"
                        >
                            <Calendar className="w-4 h-4 text-emerald-200" />
                            <span>{scheduleButtonText}</span>
                        </button>
                    </div>
                )}

                {/* 다른 여행 자동계획 안내 커스텀 모달 팝업 */}
                <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                    <AlertDialogContent className="w-[90%] max-w-[340px] rounded-3xl p-6">
                        <AlertDialogHeader className="space-y-2">
                            <AlertDialogTitle className="text-center text-lg font-bold text-[#388E5A] dark:text-emerald-400">
                                📢 안내
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-center text-sm text-stone-600 dark:text-stone-300 font-medium break-keep leading-relaxed pt-1">
                                다른 곳으로 가시는 여행 일정도 등록해 보세요. 라온아이가 똑똑한 여행 계획을 자동으로 완성해 드립니다.
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        {/* 오늘 하루 보지 않기 선택지 추가 */}
                        <div className="flex items-center gap-2 mt-4 justify-center">
                            <input
                                type="checkbox"
                                id="dontShowToday"
                                checked={dontShowToday}
                                onChange={(e) => setDontShowToday(e.target.checked)}
                                className="w-4 h-4 rounded border-stone-300 text-[#388E5A] focus:ring-[#388E5A] cursor-pointer"
                            />
                            <label htmlFor="dontShowToday" className="text-xs text-stone-500 dark:text-stone-400 font-semibold cursor-pointer select-none">
                                오늘 하루 보지 않기
                            </label>
                        </div>

                        <AlertDialogFooter className="mt-5 flex flex-row justify-center gap-2 sm:justify-center">
                            <AlertDialogAction
                                onClick={handleConfirmExternalAlert}
                                className="bg-[#388E5A] hover:bg-[#2F774B] text-white font-bold px-8 rounded-xl h-10 w-full active:scale-[0.97] transition-all"
                            >
                                확인
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </>
        );
    }


    const nights = differenceInDays(upcomingItem.checkOut, upcomingItem.checkIn);

    // 라온아이 예약 여부
    const isRaonai = upcomingItem.type === 'reservation' || upcomingItem.source === 'raonai';
    // 입금대기 여부
    const isPending = upcomingItem.status === 'PENDING';
    // 취소/환불대기 여부
    const isRefundPending = upcomingItem.status === 'REFUND_PENDING';

    // 배경색 구분 (입금대기는 황색 계열)
    const bgGradient = isPending
        ? 'from-yellow-500 to-orange-500'
        : isRaonai
            ? 'from-brand-1 to-brand-2'
            : 'from-[#388E5A] to-[#2F774B]';

    // 캠핑 기간의 날짜 리스트 생성 헬퍼
    const getDatesInRange = (startDate: Date, endDate: Date) => {
        const dates = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const curr = new Date(startDate);
        const end = new Date(endDate);
        curr.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        while (curr <= end) {
            if (curr >= today) {
                dates.push(format(curr, 'yyyyMMdd'));
            }
            curr.setDate(curr.getDate() + 1);
        }
        return dates;
    };

    const datesInRange = upcomingItem ? getDatesInRange(upcomingItem.checkIn, upcomingItem.checkOut) : [];

    const getWeatherIcon = (type: string) => {
        switch (type) {
            case 'sunny': return '☀️';
            case 'partly_cloudy': return '⛅';
            case 'cloudy': return '☁️';
            case 'rainy': return '☔';
            case 'snowy': return '❄️';
            default: return '🌤️';
        }
    };

    return (
        <div className="space-y-3">
            {/* 다가오는 캠핑 카드 (화이트 카드 + 보태니컬 그린 테두리) */}
            <div
                onClick={handleCardClick}
                className="cursor-pointer"
            >
                <div className="bg-white dark:bg-zinc-900 border-2 border-[#388E5A] rounded-2xl p-4.5 text-stone-900 dark:text-stone-100 shadow-xs hover:shadow-md transition-all relative overflow-hidden">
                    {isNavigating && (
                        <div className="absolute inset-0 bg-black/10 flex items-center justify-center z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#388E5A]"></div>
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#388E5A] text-white flex items-center justify-center shadow-xs">
                                {isRaonai ? <Tent className="w-4 h-4 stroke-[2.2]" /> : <Tent className="w-4 h-4 stroke-[2.2]" />}
                            </div>
                            <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                                {isRefundPending ? '취소/환불 대기' : isPending ? '입금대기' : isCampingNow ? '현재 여행 진행 중' : '다가오는 여행'}
                            </span>
                            <span className="text-[11px] bg-[#E9EFEA] text-[#2D5A3C] font-bold px-2 py-0.5 rounded-md">
                                {isRaonai ? '라온아이' : '타캠핑장'}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className={cn(
                                "inline-block px-3 py-1 rounded-full text-xs font-black shadow-xs",
                                isRefundPending
                                    ? "bg-amber-500 text-white"
                                    : isCampingNow
                                        ? "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white shadow-[0_2px_10px_rgba(249,115,22,0.4)] animate-pulse"
                                        : daysUntil === 0
                                            ? "bg-amber-400 text-amber-900"
                                            : "bg-[#388E5A] text-white"
                            )}>
                                {isRefundPending ? '취소 접수' : isCampingNow ? '✨ 힐링 중~' : daysUntil === 0 ? 'D-Day!' : `D-${daysUntil}`}
                            </span>
                        </div>
                    </div>

                    {/* 상단 사이트명(1단) 및 바로 아래 일자 표기(2단) */}
                    <div className="mb-2.5">
                        <h3 className="text-xl sm:text-[22px] font-black text-[#1E4D2B] dark:text-stone-100 tracking-tight leading-tight w-full break-keep mb-1.5">
                            {upcomingItem.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs sm:text-[13px] text-stone-700 dark:text-stone-300 font-bold">
                            <Calendar className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400 stroke-[2.2] shrink-0" />
                            <span>
                                {safeCheckIn && safeCheckOut ? (
                                    `${format(safeCheckIn, 'yyyy.MM.dd(EEE)', { locale: ko })} - ${format(safeCheckOut, 'MM.dd(EEE)', { locale: ko })} · ${nights}박 ${nights + 1}일`
                                ) : (
                                    `${format(upcomingItem.checkIn, 'yyyy.MM.dd(EEE)', { locale: ko })} · ${nights}박`
                                )}
                            </span>
                        </div>
                    </div>

                    {isRefundPending ? (
                        <div className="text-xs font-bold px-2.5 py-1.5 rounded-lg w-full mb-3 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60 shadow-2xs">
                            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>⏳ 관리자 환불 확인 중입니다</span>
                        </div>
                    ) : badgeText ? (
                        <div className="text-xs font-bold px-2.5 py-1 rounded-lg w-fit mb-3 flex items-center gap-1.5 bg-[#FEF5D9] text-[#7A5B00] border border-[#FBE39D]/70 shadow-2xs">
                            {badgeText}
                        </div>
                    ) : null}

                    {/* 카드 하단 액션 바: 취소 버튼(좌, 라온아이 예약인 경우) + 상세보기(우) */}
                    <div className="flex items-center justify-between text-xs sm:text-sm mt-1 gap-2">
                        {isRaonai && selectedReservationForCancel && (selectedReservationForCancel.status === 'PENDING' || selectedReservationForCancel.status === 'CONFIRMED') ? (
                            <button
                                type="button"
                                onClick={handleCancelClick}
                                disabled={isDirectCancelling}
                                className="flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 border border-red-200 dark:border-red-900/50 px-3 py-1.5 rounded-full shadow-2xs active:scale-95 transition-all shrink-0 disabled:opacity-50"
                            >
                                {isDirectCancelling ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <span>취소요청</span>
                                )}
                            </button>
                        ) : isRefundPending ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-3 py-1.5 rounded-full shadow-2xs shrink-0 cursor-default">
                                <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 animate-pulse" />
                                <span>취소 요청중</span>
                            </span>
                        ) : (
                            <div />
                        )}
                        <div className="flex items-center gap-1 text-xs font-bold text-white bg-[#388E5A] hover:bg-[#2F774B] px-3.5 py-1.5 rounded-full shadow-xs active:scale-95 transition-all shrink-0 group">
                            <span className="text-xs">👆</span>
                            <span>상세보기</span>
                            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 stroke-[2.5]" />
                        </div>
                    </div>
                </div>
            </div>

            {/* 다른 여행 일정추가 및 나의 여행일정 버튼 */}
            {showButtons && (
                <div className="flex flex-col gap-2 w-full">
                    {!hideOtherScheduleButton && (
                        <button
                            onClick={handleExternalScheduleClick}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-dashed border-[#388E5A]/30 rounded-xl text-[#388E5A] hover:bg-[#388E5A]/5 transition-all active:scale-[0.98] duration-200"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="text-sm font-semibold">다른 여행 일정추가</span>
                        </button>
                    )}
                    <button
                        onClick={() => withAuth(() => router.push('/myspace/schedule'))}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#388E5A] hover:bg-[#2F774B] text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all active:scale-[0.98] duration-200"
                    >
                        <Calendar className="w-4 h-4 text-emerald-200" />
                        <span>{scheduleButtonText}</span>
                    </button>
                </div>
            )}

            {/* 다른 여행 자동계획 안내 커스텀 모달 팝업 */}
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent className="w-[90%] max-w-[340px] rounded-3xl p-6">
                    <AlertDialogHeader className="space-y-2">
                        <AlertDialogTitle className="text-center text-lg font-bold text-[#388E5A] dark:text-emerald-400">
                            📢 안내
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-center text-sm text-stone-600 dark:text-stone-300 font-medium break-keep leading-relaxed pt-1">
                            다른 곳으로 가시는 여행 일정도 등록해 보세요. 라온아이가 똑똑한 여행 계획을 자동으로 완성해 드립니다.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {/* 오늘 하루 보지 않기 선택지 추가 */}
                    <div className="flex items-center gap-2 mt-4 justify-center">
                        <input
                            type="checkbox"
                            id="dontShowToday"
                            checked={dontShowToday}
                            onChange={(e) => setDontShowToday(e.target.checked)}
                            className="w-4 h-4 rounded border-stone-300 text-[#388E5A] focus:ring-[#388E5A] cursor-pointer"
                        />
                        <label htmlFor="dontShowToday" className="text-xs text-stone-500 dark:text-stone-400 font-semibold cursor-pointer select-none">
                            오늘 하루 보지 않기
                        </label>
                    </div>

                    <AlertDialogFooter className="mt-5 flex flex-row justify-center gap-2 sm:justify-center">
                        <AlertDialogAction
                            onClick={handleConfirmExternalAlert}
                            className="bg-[#388E5A] hover:bg-[#2F774B] text-white font-bold px-8 rounded-xl h-10 w-full active:scale-[0.97] transition-all"
                        >
                            확인
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 확정 예약 취소요청 바텀시트 */}
            {selectedReservationForCancel && selectedReservationForCancel.status === 'CONFIRMED' && (
                <CancelReservationSheet
                    open={cancelSheetOpen}
                    onOpenChange={setCancelSheetOpen}
                    reservation={selectedReservationForCancel}
                    onComplete={handleCancelComplete}
                />
            )}

            {/* 입금대기 예약 취소 확인 다이얼로그 */}
            <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
                <AlertDialogContent className="w-[90%] max-w-[340px] rounded-3xl p-6">
                    <AlertDialogHeader className="space-y-2">
                        <AlertDialogTitle className="text-center text-lg font-bold text-stone-900 dark:text-stone-100">
                            예약을 취소하시겠습니까?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-center text-sm text-stone-600 dark:text-stone-300 font-medium break-keep leading-relaxed pt-1">
                            아직 입금 전인 예약으로, 취소하시면 즉시 예약이 취소됩니다.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-5 flex flex-row justify-center gap-2 sm:justify-center">
                        <AlertDialogCancel
                            disabled={isDirectCancelling}
                            className="rounded-xl h-10 w-full"
                        >
                            돌아가기
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDirectCancel}
                            disabled={isDirectCancelling}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl h-10 w-full active:scale-[0.97] transition-all"
                        >
                            {isDirectCancelling ? '취소 중...' : '예약 취소'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
});

export default ScheduleHomeWidget;

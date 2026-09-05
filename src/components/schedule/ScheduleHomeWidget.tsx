'use client';

import { useState, useEffect, useMemo, memo, useRef } from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, ChevronRight, Tent, Clock, Plus, MapPin } from 'lucide-react';
import { Schedule, getMySchedules, ensureScheduleFromReservation } from '@/actions/schedule';
import { useReservationStore } from '@/store/useReservationStore';
import { Reservation } from '@/types/reservation';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { SITES } from '@/constants/sites';
import { useWeather } from '@/hooks/useWeather';
import { DEFAULT_CAMPING_LOCATION } from '@/constants/location';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// 통합 일정 타입 (라온아이 예약 또는 타캠핑장 일정)
interface UnifiedSchedule {
    type: 'reservation' | 'schedule';
    id: string;
    name: string;
    checkIn: Date;
    checkOut: Date;
    source?: 'raonai' | 'external';
    siteId?: string;
    status?: 'PENDING' | 'CONFIRMED'; // 예약 상태 (입금대기/확정)
}

/**
 * 홈 화면에서 다가오는 캠핑 일정을 보여주는 위젯
 * 라온아이 예약 + 타캠핑장 일정을 통합하여 가장 가까운 1개 표시
 */
const ScheduleHomeWidget = memo(function ScheduleHomeWidget({ isExpanded = false }: { isExpanded?: boolean }) {
    const router = useRouter();
    const { withAuth } = useRequireAuth();
    const { reservations, fetchMyReservations } = useReservationStore();
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const schedulesRef = useRef(schedules);
    useEffect(() => { schedulesRef.current = schedules; }, [schedules]);

    const isComponentMounted = useRef(true);
    useEffect(() => {
        isComponentMounted.current = true;
        return () => {
            isComponentMounted.current = false;
        };
    }, []);

    // 마운트 시 뒤로가기 복귀 여부 확인
    const isBackFromDetail = useMemo(() => {
        if (typeof window === 'undefined') return false;
        try {
            return window.sessionStorage?.getItem('raonai_back_from_detail') === 'true';
        } catch {
            return false;
        }
    }, []);

    // 로컬스토리지 동기 캐시 파싱 (라온아이 예약)
    const cachedReservations = useMemo<Reservation[]>(() => {
        if (reservations && reservations.length > 0) return reservations;
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem('reservation-storage-v2');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            const list = parsed?.state?.reservations;
            if (!Array.isArray(list)) return [];
            return list as Reservation[];
        } catch {
            return [];
        }
    }, [reservations]);

    // 로컬스토리지 동기 캐시 파싱 (타캠핑장 일정)
    const cachedSchedules = useMemo<Schedule[]>(() => {
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
    }, [schedules]);

    // 로딩 상태: 뒤로가기 복귀 시에는 스켈레톤 없이 즉시 노출(false), 첫진입/새로고침 시에는 스켈레톤 정상 노출(true)
    const [isLoading, setIsLoading] = useState(() => {
        if (isBackFromDetail) return false;
        return true;
    });

    const [isNavigating, setIsNavigating] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [dontShowToday, setDontShowToday] = useState(false);

    // 통합 일정 계산 (라온아이 예약 + 타캠핑장 일정)
    const upcomingItem = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const unifiedList: UnifiedSchedule[] = [];

        const activeReservations = (cachedReservations && cachedReservations.length > 0) ? cachedReservations : reservations;
        const activeSchedules = (cachedSchedules && cachedSchedules.length > 0) ? cachedSchedules : schedules;

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

                    if (checkOutZero >= today && (r.status === 'PENDING' || r.status === 'CONFIRMED')) {
                        const site = SITES.find(s => s.id === r.siteId);
                        unifiedList.push({
                            type: 'reservation',
                            id: r.id,
                            name: site?.name || r.siteId,
                            checkIn,
                            checkOut,
                            siteId: r.siteId,
                            status: r.status as 'PENDING' | 'CONFIRMED'
                        });
                    }
                } catch {}
            });
        }

        // 타캠핑장 일정 필터링
        if (Array.isArray(activeSchedules)) {
            activeSchedules.forEach(s => {
                try {
                    if (!s || !s.check_in || !s.check_out) return;
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
    }, [cachedReservations, reservations, cachedSchedules, schedules]);

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
        const fetchAll = async () => {
            try {
                // 백그라운드 Silent Revalidation
                await fetchMyReservations();
                const schedulesData = await getMySchedules('scheduled');
                setSchedules(schedulesData);
                try {
                    localStorage.setItem('user_schedules_cache', JSON.stringify(schedulesData));
                } catch {}
            } catch (error) {
                console.error('Fetch error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);



    // 스마트플랜 사용 가능 여부 판별 (예약 생성 새벽 5시 이전 당일 9시, 이후 다음날 오전 9시 활성화)
    const isSmartPlanAvailable = useMemo(() => {
        if (!upcomingItem) return false;
        
        let createdAtDate: Date;
        
        if (upcomingItem.type === 'reservation') {
            const reservation = reservations.find(r => r.id === upcomingItem.id);
            if (!reservation || reservation.status !== 'CONFIRMED') return false;
            createdAtDate = new Date(reservation.createdAt);
        } else {
            const schedule = schedules.find(s => s.id === upcomingItem.id);
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
    }, [upcomingItem, reservations, schedules]);

    // 스마트플랜 오픈 대기 여부 판별
    const isSmartPlanUnlockingSoon = useMemo(() => {
        if (!upcomingItem) return false;
        
        let createdAtDate: Date;
        let hasSmartPlan = false;
        
        if (upcomingItem.type === 'reservation') {
            const reservation = reservations.find(r => r.id === upcomingItem.id);
            if (!reservation || reservation.status !== 'CONFIRMED') return false;
            createdAtDate = new Date(reservation.createdAt);
            
            // 이미 생성된 일정에 smart_plan_data가 있는지 체크
            const matchedSchedule = schedules.find(s => s.reservation_id === upcomingItem.id);
            if (matchedSchedule && matchedSchedule.smart_plan_data) {
                hasSmartPlan = true;
            }
        } else {
            const schedule = schedules.find(s => s.id === upcomingItem.id);
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
    }, [upcomingItem, reservations, schedules]);

    // 뱃지 텍스트 결정 (스마트플랜 5단계 동적 D-Day 생명주기 뱃지 수식 - ScheduleCard와 100% 동일화)
    const badgeText = useMemo(() => {
        if (!upcomingItem) return '';
        
        let smartPlanData: any = null;
        if (upcomingItem.type === 'schedule') {
            const schedule = schedules.find(s => s.id === upcomingItem.id);
            smartPlanData = schedule?.smart_plan_data;
        } else if (upcomingItem.type === 'reservation') {
            const matchedSchedule = schedules.find(s => s.reservation_id === upcomingItem.id);
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
    }, [upcomingItem, isSmartPlanAvailable, schedules, daysUntil]);

    const handleCardClick = () => {
        withAuth(async () => {
            if (!upcomingItem || isNavigating) return;
            try { window.sessionStorage?.setItem('raonai_back_from_detail', 'true'); } catch {}

            // 라온아이 입금대기 상태면 예약 완료/확인 페이지로 (스케줄 생성 X)
            if (upcomingItem.type === 'reservation' && upcomingItem.status === 'PENDING') {
                router.push('/myspace/reservations');
                return;
            }

            // 이미 Schedules 목록에 매핑된 일정이 존재하는 경우 비동기 서버 액션 호출 없이 0.001초 직통 이동
            const matchedSchedule = schedules.find(s => s.reservation_id === upcomingItem.id);
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
            <div className="bg-white dark:bg-zinc-900 border-[2px] border-amber-500/20 rounded-2xl p-5 animate-pulse space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-500/60" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="h-4 w-36 bg-stone-200 dark:bg-zinc-800 rounded-md" />
                            <div className="h-3 w-24 bg-stone-200 dark:bg-zinc-800 rounded-md" />
                        </div>
                    </div>
                    <div className="w-12 h-6 bg-amber-200/60 dark:bg-zinc-800 rounded-full" />
                </div>
                <div className="h-10 w-full bg-stone-100 dark:bg-zinc-800/60 rounded-xl" />
            </div>
        );
    }

    // 일정 없음 (등록된 일정이 없는 신규/기존 유저)
    if (!upcomingItem) {
        return (
            <>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-dashed border-[#224732]/30 shadow-sm space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#224732]/10 flex items-center justify-center text-[#224732] dark:text-[#C3A675]">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-stone-100">다가오는 여행 일정이 없습니다</h4>
                        </div>
                    </div>
                    <button
                        onClick={handleExternalScheduleClick}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#224732] hover:bg-[#1a3626] text-white rounded-xl text-sm font-semibold shadow-md active:scale-[0.98] transition-all duration-200"
                    >
                        <Plus className="w-4 h-4" />
                        <span>다른 여행 일정추가</span>
                    </button>
                </div>

                {/* 다른 여행 자동계획 안내 커스텀 모달 팝업 */}
                <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                    <AlertDialogContent className="w-[90%] max-w-[340px] rounded-3xl p-6">
                        <AlertDialogHeader className="space-y-2">
                            <AlertDialogTitle className="text-center text-lg font-bold text-[#224732] dark:text-[#C3A675]">
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
                                className="w-4 h-4 rounded border-stone-300 text-[#224732] focus:ring-[#224732] cursor-pointer"
                            />
                            <label htmlFor="dontShowToday" className="text-xs text-stone-500 dark:text-stone-400 font-semibold cursor-pointer select-none">
                                오늘 하루 보지 않기
                            </label>
                        </div>

                        <AlertDialogFooter className="mt-5 flex flex-row justify-center gap-2 sm:justify-center">
                            <AlertDialogAction
                                onClick={handleConfirmExternalAlert}
                                className="bg-[#224732] hover:bg-[#1a3626] text-white font-bold px-8 rounded-xl h-10 w-full active:scale-[0.97] transition-all"
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
    const isRaonai = upcomingItem.type === 'reservation';
    // 입금대기 여부
    const isPending = upcomingItem.status === 'PENDING';

    // 배경색 구분 (입금대기는 황색 계열)
    const bgGradient = isPending
        ? 'from-yellow-500 to-orange-500'
        : isRaonai
            ? 'from-brand-1 to-brand-2'
            : 'from-[#224732] to-[#1a3626]';

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
            {/* 다가오는 캠핑 카드 */}
            <div
                onClick={handleCardClick}
                className="cursor-pointer"
            >
                <div className={`bg-gradient-to-br ${bgGradient} rounded-2xl p-4 text-white hover:shadow-lg transition-all relative overflow-hidden`}>
                    {isNavigating && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        </div>
                    )}

                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                {isRaonai ? <MapPin className="w-4 h-4" /> : <Tent className="w-4 h-4" />}
                            </div>
                            <div>
                                <span className="text-sm font-medium opacity-90">
                                    {isPending ? '입금대기' : isCampingNow ? '현재 여행 진행 중' : '다가오는 여행'}
                                </span>
                                <span className="ml-2 text-xs bg-white/20 px-1.5 py-0.5 rounded">
                                    {isRaonai ? '라온아이' : '타캠핑장'}
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={cn(
                                "inline-block px-2.5 py-1 rounded-full text-xs font-black",
                                isCampingNow
                                    ? "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white shadow-[0_2px_10px_rgba(249,115,22,0.4)] animate-pulse border border-orange-200/40"
                                    : daysUntil === 0
                                        ? "bg-amber-400 text-amber-900"
                                        : "bg-white/20 text-white"
                            )}>
                                {isCampingNow ? '✨ 힐링 중~' : daysUntil === 0 ? 'D-Day!' : `D-${daysUntil}`}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 mb-2 min-w-0">
                        <h3 className="text-lg font-bold truncate">
                            {upcomingItem.name}
                        </h3>
                    </div>

                    {badgeText && (
                        <div className={cn(
                            "text-[11px] font-black px-2.5 py-1.5 rounded-lg w-fit mb-2.5 flex items-center gap-1.5 shadow-sm",
                            badgeText.includes('완료')
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : badgeText.includes('정밀') || badgeText.includes('업데이트')
                                    ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        )}>
                            {badgeText}
                        </div>
                    )}

                    <div className="flex items-center gap-3 text-sm opacity-90">
                        <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {format(upcomingItem.checkIn, 'M.d(EEE)', { locale: ko })}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {nights}박
                        </span>
                        <ChevronRight className="w-4 h-4 ml-auto" />
                    </div>
                </div>
            </div>

            {/* 다른 여행 일정추가 및 나의 여행일정 버튼 */}
            <div className="flex flex-col gap-2 w-full">
                <button
                    onClick={handleExternalScheduleClick}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-dashed border-[#224732]/30 rounded-xl text-[#224732] hover:bg-[#224732]/5 transition-all active:scale-[0.98] duration-200"
                >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-semibold">다른 여행 일정추가</span>
                </button>
                <button
                    onClick={() => withAuth(() => router.push('/myspace/schedule'))}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#224732] hover:bg-[#1a3626] text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all active:scale-[0.98] duration-200"
                >
                    <Calendar className="w-4 h-4 text-[#C3A675]" />
                    <span>나의 여행일정</span>
                </button>
            </div>

            {/* 다른 여행 자동계획 안내 커스텀 모달 팝업 */}
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent className="w-[90%] max-w-[340px] rounded-3xl p-6">
                    <AlertDialogHeader className="space-y-2">
                        <AlertDialogTitle className="text-center text-lg font-bold text-[#224732] dark:text-[#C3A675]">
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
                            className="w-4 h-4 rounded border-stone-300 text-[#224732] focus:ring-[#224732] cursor-pointer"
                        />
                        <label htmlFor="dontShowToday" className="text-xs text-stone-500 dark:text-stone-400 font-semibold cursor-pointer select-none">
                            오늘 하루 보지 않기
                        </label>
                    </div>

                    <AlertDialogFooter className="mt-5 flex flex-row justify-center gap-2 sm:justify-center">
                        <AlertDialogAction
                            onClick={handleConfirmExternalAlert}
                            className="bg-[#224732] hover:bg-[#1a3626] text-white font-bold px-8 rounded-xl h-10 w-full active:scale-[0.97] transition-all"
                        >
                            확인
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
});

export default ScheduleHomeWidget;

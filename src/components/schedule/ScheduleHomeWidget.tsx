'use client';

import { useState, useEffect, useMemo, memo, useRef } from 'react';
import Link from 'next/link';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, ChevronRight, Tent, Clock, Plus, MapPin } from 'lucide-react';
import { Schedule, getMySchedules, ensureScheduleFromReservation } from '@/actions/schedule';
import { useReservationStore } from '@/store/useReservationStore';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { SITES } from '@/constants/sites';
import { useWeather } from '@/hooks/useWeather';
import { DEFAULT_CAMPING_LOCATION } from '@/constants/location';
import { useRequireAuth } from '@/hooks/useRequireAuth';
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
    const [upcomingItem, setUpcomingItem] = useState<UnifiedSchedule | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [dontShowToday, setDontShowToday] = useState(false);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysUntil = upcomingItem ? differenceInDays(upcomingItem.checkIn, today) : 999;
    const isCampingNow = upcomingItem && (today >= upcomingItem.checkIn && today <= upcomingItem.checkOut);
    const isWeatherEnabled = upcomingItem ? (daysUntil <= 10 && isExpanded) : false;

    const itemLat = upcomingItem?.type === 'reservation' ? undefined : (schedules.find(s => s.id === upcomingItem?.id)?.campground_lat || undefined);
    const itemLng = upcomingItem?.type === 'reservation' ? undefined : (schedules.find(s => s.id === upcomingItem?.id)?.campground_lng || undefined);

    const weather = useWeather(itemLat, itemLng, isWeatherEnabled);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                // 예약과 일정을 모두 가져오기
                await fetchMyReservations();
                const schedulesData = await getMySchedules('scheduled');
                setSchedules(schedulesData);
            } catch (error) {
                console.error('Fetch error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 백그라운드 일정 동기화 (Eager Sync)
    // 주의: schedules를 의존성 배열에 넣으면 setSchedules() → 이펙트 재실행 → 무한 루프가 발생하므로
    //       schedulesRef를 사용하여 최신 값을 참조하고, 의존성 배열에서 schedules를 제거한다.
    useEffect(() => {
        if (isLoading || isSyncing) return;

        // 확정(CONFIRMED) 상태인 라온아이 예약 중, schedules 테이블에 매핑되지 않은 예약 찾기
        const currentSchedules = schedulesRef.current;
        const pendingSyncReservations = reservations.filter(r => {
            if (r.status !== 'CONFIRMED') return false;
            const exists = currentSchedules.some(s => s.reservation_id === r.id);
            return !exists;
        });

        if (pendingSyncReservations.length === 0) return;

        const syncAll = async () => {
            setIsSyncing(true);
            try {
                // 확정 예약 건들에 대해 백그라운드에서 일정 확보 (변환 생성)
                const promises = pendingSyncReservations.map(async (res) => {
                    const result = await ensureScheduleFromReservation(res.id);
                    return { reservationId: res.id, result };
                });
                
                await Promise.all(promises);
                
                // 새로운 일정이 생성되었으므로 schedules 재로드
                const newSchedules = await getMySchedules('scheduled');
                setSchedules(newSchedules);
            } catch (error) {
                console.error('Background schedule sync failed:', error);
            } finally {
                setIsSyncing(false);
            }
        };

        syncAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reservations, isLoading]);

    // 예약 + 일정을 통합하여 가장 가까운 것 찾기
    useEffect(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const unifiedList: UnifiedSchedule[] = [];

        // 라온아이 예약 필터링 (진행 중인 예약만 - 퇴실일 당일까지 노출)
        reservations
            .filter(r => {
                const checkOut = new Date(r.checkOutDate);
                checkOut.setHours(0, 0, 0, 0);
                return checkOut >= today && (r.status === 'PENDING' || r.status === 'CONFIRMED');
            })
            .forEach(r => {
                const site = SITES.find(s => s.id === r.siteId);
                unifiedList.push({
                    type: 'reservation',
                    id: r.id,
                    name: site?.name || r.siteId,
                    checkIn: new Date(r.checkInDate),
                    checkOut: new Date(r.checkOutDate),
                    siteId: r.siteId,
                    status: r.status as 'PENDING' | 'CONFIRMED'
                });
            });

        // 타캠핑장 일정 필터링 (퇴실일 당일까지 노출)
        schedules
            .filter(s => {
                const checkOut = parseISO(s.check_out);
                return checkOut >= today && s.status === 'scheduled';
            })
            .forEach(s => {
                unifiedList.push({
                    type: 'schedule',
                    id: s.id,
                    name: s.campground_name,
                    checkIn: parseISO(s.check_in),
                    checkOut: parseISO(s.check_out),
                    source: s.source
                });
            });

        // 체크인 날짜 기준 정렬 후 가장 가까운 것 선택
        unifiedList.sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());
        setUpcomingItem(unifiedList[0] || null);
    }, [reservations, schedules]);

    // 스마트플랜 사용 가능 여부 판별 (예약 생성 새벽 5시 이전 당일 9시, 이후 다음날 오전 9시 활성화)
    const isSmartPlanAvailable = useMemo(() => {
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

    // 스마트플랜 오픈 대기 안내 문구 결정 (오늘/내일 오전 9시 이후 활성화 명시)
    const unlockMessage = useMemo(() => {
        if (!upcomingItem) return '';
        
        let createdAtDate: Date;
        if (upcomingItem.type === 'reservation') {
            const reservation = reservations.find(r => r.id === upcomingItem.id);
            if (!reservation) return '';
            createdAtDate = new Date(reservation.createdAt);
        } else {
            const schedule = schedules.find(s => s.id === upcomingItem.id);
            if (!schedule) return '';
            createdAtDate = new Date(schedule.created_at);
        }
        
        if (isNaN(createdAtDate.getTime())) return '';
        
        const unlockTimeByCreation = new Date(createdAtDate);
        if (createdAtDate.getHours() < 5) {
            unlockTimeByCreation.setHours(9, 0, 0, 0);
        } else {
            unlockTimeByCreation.setDate(unlockTimeByCreation.getDate() + 1);
            unlockTimeByCreation.setHours(9, 0, 0, 0);
        }

        const now = new Date();
        const isUnlockDay = now.getFullYear() === unlockTimeByCreation.getFullYear() &&
                            now.getMonth() === unlockTimeByCreation.getMonth() &&
                            now.getDate() === unlockTimeByCreation.getDate();

        return isUnlockDay 
            ? "오늘 오전 9시 이후에 자동계획생성이 가능합니다."
            : "내일 오전 9시 이후에 자동계획생성이 가능합니다.";
    }, [upcomingItem, reservations, schedules]);

    // 뱃지 텍스트 결정 (예약 다음 날 ~ D-8: 여행계획 세우기 가능 / D-7 ~ D-0: 최종 날씨 반영 계획 완성)
    const badgeText = useMemo(() => {
        if (!upcomingItem || !isSmartPlanAvailable) return '';
        
        const checkIn = new Date(upcomingItem.checkIn);
        checkIn.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.round((checkIn.getTime() - today.getTime()) / 86400000);
        
        if (daysDiff <= 7) {
            return '✨ 최종 날씨 반영 계획 완성 가능';
        } else {
            return '✨ 여행계획 세우기 가능';
        }
    }, [upcomingItem, isSmartPlanAvailable]);

    const handleCardClick = () => {
        withAuth(async () => {
            if (!upcomingItem || isNavigating) return;

            // 라온아이 입금대기 상태면 예약 완료/확인 페이지로 (스케줄 생성 X)
            if (upcomingItem.type === 'reservation' && upcomingItem.status === 'PENDING') {
                router.push('/reservation/complete');
                return;
            }

            // 그 외 (예약 확정, 타캠핑장) -> 일정 상세 페이지로
            if (upcomingItem.type === 'reservation') {
                setIsNavigating(true);
                try {
                    // 백그라운드 동기화와 겹치거나 지연 생성 시 직접 호출
                    const result = await ensureScheduleFromReservation(upcomingItem.id);

                    if (result.success && result.scheduleId) {
                        router.push(`/myspace/schedule/${result.scheduleId}`);
                    } else {
                        console.error('Failed to ensure schedule:', result.error);
                        router.push('/reservation/complete');
                    }
                } catch (e) {
                    console.error('Navigation error:', e);
                    router.push('/reservation/complete');
                }
            } else {
                // 이미 스케줄임 (Eager Sync로 인해 99.9% 이 케이스로 즉시 순간이동함)
                router.push(`/myspace/schedule/${upcomingItem.id}`);
            }
        });
    };

    const handleExternalScheduleClick = () => {
        withAuth(() => {
            const hideTime = localStorage.getItem('raonai_hide_add_alert_today');
            const now = new Date().getTime();
            
            if (hideTime && now < parseInt(hideTime, 10)) {
                router.push('/myspace/schedule?add=external');
            } else {
                setDontShowToday(false);
                setIsAlertOpen(true);
            }
        });
    };

    const handleConfirmExternalAlert = () => {
        if (dontShowToday) {
            const expireTime = new Date().getTime() + 24 * 60 * 60 * 1000;
            localStorage.setItem('raonai_hide_add_alert_today', expireTime.toString());
        }
        setIsAlertOpen(false);
        router.push('/myspace/schedule?add=external');
    };

    // 로딩
    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full" />
                    <div className="flex-1">
                        <div className="h-4 w-24 bg-gray-200 rounded mb-1" />
                        <div className="h-3 w-16 bg-gray-200 rounded" />
                    </div>
                </div>
                <div className="h-4 w-full bg-gray-200 rounded" />
            </div>
        );
    }

    // 일정 없음
    if (!upcomingItem) {
        return (
            <div 
                onClick={() => withAuth(() => router.push('/myspace/schedule'))}
                className="cursor-pointer"
            >
                <div className="bg-white rounded-2xl p-4 border border-dashed border-gray-200 hover:border-[#224732]/30 hover:bg-gray-50 transition-all">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#224732]/10 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-[#224732]" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">캠핑 일정 등록하기</p>
                            <p className="text-xs text-gray-500">다가올 캠핑을 미리 준비해보세요</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                </div>
            </div>
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
            {/* 날씨 정보 노출 조건분기 */}
            {upcomingItem && (
                <>
                    {daysUntil > 10 ? (
                        <div className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-xl p-3 border border-stone-200/50 dark:border-zinc-700/50 text-xs text-stone-600 dark:text-stone-300 flex items-center justify-between shadow-sm">
                            <span className="flex items-center gap-1.5 font-medium">
                                📅 캠핑 날씨 안내
                            </span>
                            <span className="text-[11px] opacity-80">출발 10일 전부터 캠핑장의 날씨가 안내됩니다. 🌤️</span>
                        </div>
                    ) : weather.loading ? (
                        <div className="bg-white rounded-2xl p-4 border border-stone-200/50 dark:border-zinc-700/50 shadow-sm animate-pulse space-y-3">
                            <div className="h-4 w-32 bg-stone-100 rounded" />
                            <div className="flex gap-3">
                                <div className="flex-1 h-16 bg-stone-100 rounded-xl" />
                                <div className="flex-1 h-16 bg-stone-100 rounded-xl" />
                                <div className="flex-1 h-16 bg-stone-100 rounded-xl" />
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white/95 dark:bg-zinc-800/95 backdrop-blur-sm rounded-2xl p-4 border border-stone-200/50 dark:border-zinc-700/50 shadow-sm space-y-2.5">
                            <div className="flex items-center justify-between text-xs border-b border-stone-100 dark:border-zinc-700/50 pb-2">
                                <span className="font-bold text-stone-800 dark:text-stone-200">
                                    🏕️ 캠핑 일정 날씨 예보 ({upcomingItem.name})
                                </span>
                                {weather.lastUpdated && (
                                    <span className="text-[10px] text-stone-400">
                                        업데이트: {format(weather.lastUpdated, 'HH:mm')}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2.5 overflow-x-auto py-1 scrollbar-hide">
                                {datesInRange.map(dateStr => {
                                    const dayFcst = weather.daily?.find(d => d.date === dateStr);
                                    const formattedDate = `${dateStr.substring(4, 6)}/${dateStr.substring(6, 8)}`;

                                    return (
                                        <div key={dateStr} className="flex-1 min-w-[65px] flex flex-col items-center p-2 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-100/50 dark:border-zinc-800/50">
                                            <span className="text-[10px] font-medium text-stone-500">{formattedDate}</span>
                                            {dayFcst ? (
                                                <>
                                                    <span className="text-xl my-1">{getWeatherIcon(dayFcst.weatherCode)}</span>
                                                    <span className="text-[10px] font-semibold text-stone-700 dark:text-stone-300">
                                                        {dayFcst.min !== null && dayFcst.max !== null ? `${Math.round(dayFcst.min)}°/${Math.round(dayFcst.max)}°` : '-'}
                                                    </span>
                                                    {dayFcst.pop > 0 && (
                                                        <span className="text-[9px] text-blue-500 font-bold mt-0.5">{dayFcst.pop}%</span>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-xl my-1 text-stone-400">⏳</span>
                                                    <span className="text-[9px] text-stone-400 font-medium">대기</span>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

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
                                    {isPending ? '입금대기' : isCampingNow ? '현재 캠핑 진행 중' : '다가오는 캠핑'}
                                </span>
                                <span className="ml-2 text-xs bg-white/20 px-1.5 py-0.5 rounded">
                                    {isRaonai ? '라온아이' : '타캠핑장'}
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={cn(
                                "inline-block px-2 py-0.5 rounded-full text-xs font-bold",
                                isCampingNow
                                    ? "bg-green-500 text-white animate-pulse"
                                    : daysUntil === 0
                                        ? "bg-amber-400 text-amber-900"
                                        : "bg-white/20 text-white"
                            )}>
                                {isCampingNow ? '🔥 힐링 중~' : daysUntil === 0 ? 'D-Day!' : `D-${daysUntil}`}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 mb-2 min-w-0">
                        <h3 className="text-lg font-bold truncate">
                            {upcomingItem.name}
                        </h3>
                        {isSmartPlanAvailable && (
                            <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full text-[15px] font-black gold-glow-badge shadow-md transition-all duration-300 animate-pulse">
                                {badgeText}
                            </span>
                        )}
                    </div>

                    {isSmartPlanUnlockingSoon && (
                        <div className="text-[11px] font-black bg-gradient-to-r from-orange-400/90 to-amber-500/90 text-white shadow-[0_0_10px_rgba(251,146,60,0.4)] border border-orange-300/20 px-2.5 py-1.5 rounded-lg w-fit mb-2.5 flex items-center gap-1.5 animate-pulse">
                            <span>⏰</span> {unlockMessage}
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

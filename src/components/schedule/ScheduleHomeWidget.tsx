'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, ChevronRight, Tent, Clock, Plus, MapPin } from 'lucide-react';
import { Schedule, getMySchedules } from '@/actions/schedule';
import { useReservationStore } from '@/store/useReservationStore';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { SITES } from '@/constants/sites';
import { useWeather } from '@/hooks/useWeather';
import { DEFAULT_CAMPING_LOCATION } from '@/constants/location';

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
export default function ScheduleHomeWidget() {
    const router = useRouter();
    const { reservations, fetchMyReservations } = useReservationStore();
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [upcomingItem, setUpcomingItem] = useState<UnifiedSchedule | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isNavigating, setIsNavigating] = useState(false);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysUntil = upcomingItem ? differenceInDays(upcomingItem.checkIn, today) : 999;
    const isCampingNow = upcomingItem && (today >= upcomingItem.checkIn && today <= upcomingItem.checkOut);
    const isWeatherEnabled = upcomingItem ? daysUntil <= 10 : false;

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
    }, [fetchMyReservations]);

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

    // 스마트플랜 사용 가능 여부 판별 (체크인 10일 전 오전 9시 또는 예약 생성 다음날 오전 9시 중 최댓값 비교)
    const isSmartPlanAvailable = useMemo(() => {
        if (!upcomingItem) return false;
        
        let checkInDate: Date;
        let createdAtDate: Date;
        let hasSmartPlan = false;
        
        if (upcomingItem.type === 'reservation') {
            const reservation = reservations.find(r => r.id === upcomingItem.id);
            if (!reservation || reservation.status !== 'CONFIRMED') return false;
            checkInDate = new Date(reservation.checkInDate);
            createdAtDate = new Date(reservation.createdAt);
        } else {
            const schedule = schedules.find(s => s.id === upcomingItem.id);
            if (!schedule || schedule.status !== 'scheduled') return false;
            checkInDate = parseISO(schedule.check_in);
            createdAtDate = new Date(schedule.created_at);
            hasSmartPlan = !!schedule.smart_plan_data;
        }
        
        if (isNaN(checkInDate.getTime()) || isNaN(createdAtDate.getTime()) || hasSmartPlan) return false;
        
        const unlockTimeByCheckIn = new Date(checkInDate);
        unlockTimeByCheckIn.setDate(unlockTimeByCheckIn.getDate() - 10);
        unlockTimeByCheckIn.setHours(9, 0, 0, 0);

        const unlockTimeByCreation = new Date(createdAtDate);
        unlockTimeByCreation.setDate(unlockTimeByCreation.getDate() + 1);
        unlockTimeByCreation.setHours(9, 0, 0, 0);

        const finalUnlockTime = new Date(Math.max(unlockTimeByCheckIn.getTime(), unlockTimeByCreation.getTime()));
        return new Date() >= finalUnlockTime;
    }, [upcomingItem, reservations, schedules]);

    const handleCardClick = async () => {
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
                // 예약 -> 일정 변환 (Lazy Creation)
                const { ensureScheduleFromReservation } = await import('@/actions/schedule');
                const result = await ensureScheduleFromReservation(upcomingItem.id);

                if (result.success && result.scheduleId) {
                    router.push(`/myspace/schedule/${result.scheduleId}`);
                } else {
                    console.error('Failed to ensure schedule:', result.error);
                    // 실패 시 예약 페이지로라도 보내줌 (fallback)
                    router.push('/reservation/complete');
                }
            } catch (e) {
                console.error('Navigation error:', e);
                router.push('/reservation/complete');
            } finally {
                // 네비게이션 중에는 로딩 상태 유지 (페이지 이동하므로 false설정 안해도 됨)
            }
        } else {
            // 이미 스케줄임
            router.push(`/myspace/schedule/${upcomingItem.id}`);
        }
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
            <Link href="/myspace/schedule">
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
            </Link>
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

                    <div className="flex items-center gap-2.5 mb-2 min-w-0">
                        <h3 className="text-lg font-bold truncate">
                            {upcomingItem.name}
                        </h3>
                        {isSmartPlanAvailable && (
                            <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-black gold-glow-badge shadow-md transition-all duration-300 animate-pulse">
                                ✨ 여행계획 자동완성 가능
                            </span>
                        )}
                    </div>

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
                    onClick={() => router.push('/myspace/schedule?add=external')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-dashed border-[#224732]/30 rounded-xl text-[#224732] hover:bg-[#224732]/5 transition-all active:scale-[0.98] duration-200"
                >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">다른 여행 일정추가</span>
                </button>
                <button
                    onClick={() => router.push('/myspace/schedule')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#224732] hover:bg-[#1a3626] text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all active:scale-[0.98] duration-200"
                >
                    <Calendar className="w-4 h-4 text-[#C3A675]" />
                    <span>나의 여행일정</span>
                </button>
            </div>
        </div>
    );
}

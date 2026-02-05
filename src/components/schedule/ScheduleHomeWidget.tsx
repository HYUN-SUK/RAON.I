'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, ChevronRight, Tent, Clock, Plus, MapPin } from 'lucide-react';
import { Schedule, getMySchedules } from '@/actions/schedule';
import { useReservationStore } from '@/store/useReservationStore';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { SITES } from '@/constants/sites';

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

        // 라온아이 예약 필터링 (진행 중인 예약만)
        reservations
            .filter(r => {
                const checkOut = new Date(r.checkOutDate);
                checkOut.setHours(0, 0, 0, 0);
                return checkOut > today && (r.status === 'PENDING' || r.status === 'CONFIRMED');
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

        // 타캠핑장 일정 필터링
        schedules
            .filter(s => {
                const checkIn = parseISO(s.check_in);
                return checkIn >= today && s.status === 'scheduled';
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntil = differenceInDays(upcomingItem.checkIn, today);
    const nights = differenceInDays(upcomingItem.checkOut, upcomingItem.checkIn);

    // 라온아이 예약인지 타캠핑장인지에 따라 다른 링크
    const detailLink = upcomingItem.type === 'reservation'
        ? '/reservation/complete'
        : `/myspace/schedule/${upcomingItem.id}`;

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

    return (
        <div className="space-y-3">
            {/* 다가오는 캠핑 카드 */}
            <Link href={detailLink}>
                <div className={`bg-gradient-to-br ${bgGradient} rounded-2xl p-4 text-white hover:shadow-lg transition-all`}>
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                {isRaonai ? <MapPin className="w-4 h-4" /> : <Tent className="w-4 h-4" />}
                            </div>
                            <div>
                                <span className="text-sm font-medium opacity-90">
                                    {isPending ? '입금대기' : '다가오는 캠핑'}
                                </span>
                                <span className="ml-2 text-xs bg-white/20 px-1.5 py-0.5 rounded">
                                    {isRaonai ? '라온아이' : '타캠핑장'}
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={cn(
                                "inline-block px-2 py-0.5 rounded-full text-xs font-bold",
                                daysUntil === 0
                                    ? "bg-amber-400 text-amber-900"
                                    : "bg-white/20 text-white"
                            )}>
                                {daysUntil === 0 ? 'D-Day!' : `D-${daysUntil}`}
                            </span>
                        </div>
                    </div>

                    <h3 className="text-lg font-bold mb-2 truncate">
                        {upcomingItem.name}
                    </h3>

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
            </Link>

            {/* 타캠핑장 일정 추가 버튼 */}
            <button
                onClick={() => router.push('/myspace/schedule?add=external')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-dashed border-[#224732]/30 rounded-xl text-[#224732] hover:bg-[#224732]/5 transition-all"
            >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">타캠핑장 일정 추가</span>
            </button>
        </div>
    );
}

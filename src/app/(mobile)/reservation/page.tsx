'use client';

import { useMemo, useEffect } from 'react';
import DateRangePicker from '@/components/reservation/DateRangePicker';
import SiteList from '@/components/reservation/SiteList';
import { useReservationStore } from '@/store/useReservationStore';
import { checkReservationRules, D_N_DAYS } from '@/utils/reservationRules';
import { OPEN_DAY_CONFIG } from '@/constants/reservation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock, CalendarClock, Megaphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { differenceInDays, startOfDay, format } from 'date-fns';

export default function ReservationPage() {
    const router = useRouter();
    const { selectedDateRange, reservations, openDayRule, fetchOpenDayRule, sites, fetchSites } = useReservationStore();

    useEffect(() => {
        fetchOpenDayRule();
        fetchSites();
    }, [fetchOpenDayRule, fetchSites]);

    const activeConfig = useMemo(() => {
        if (openDayRule) {
            return {
                seasonName: openDayRule.seasonName || 'New Season',
                openAt: openDayRule.openAt,
                closeAt: openDayRule.closeAt,
                // Fallback for missing fields or future implementation
                nextSeasonOpenAt: null,
                nextSeasonCloseAt: null,
                preOpenTitle: "예약 오픈 예정",
                preOpenMessage: openDayRule.seasonName ? `${openDayRule.seasonName} 예약이 곧 시작됩니다.` : "다음 시즌 예약이 곧 시작됩니다.",
                closedTitle: "시즌 마감",
                closedMessage: "금번 시즌 예약이 종료되었습니다. 다음 시즌을 기대해주세요!"
            };
        }
        return OPEN_DAY_CONFIG;
    }, [openDayRule]);

    const now = new Date();

    const isOpen = now >= activeConfig.openAt && now <= activeConfig.closeAt;
    const isPreOpen = now < activeConfig.openAt;
    const isClosed = now > activeConfig.closeAt;

    // D-Day Calculation (SSOT 5.10.3.2)
    const today = startOfDay(now);
    const openDay = startOfDay(activeConfig.openAt);
    const diffDays = differenceInDays(openDay, today);

    let dDayBadge = null;
    if (isPreOpen && diffDays <= 7 && diffDays >= 1) {
        dDayBadge = `D-${diffDays}`;
    } else if (isPreOpen && diffDays === 0) {
        // Technically this might be handled by isOpen check with time, but D-0 is also useful if hours differ
        // If hours differ, diffDays is 0. 
        dDayBadge = `D-Day`;
    }

    // Strict Weekend Rule Logic (SSOT 6.2.1)
    const { isBlocked, hasEndCapAvailability, isNextDayBlocked } = useMemo(() => {
        let hasEndCapAvailability = false;
        let isNextDayBlocked = false;

        if (selectedDateRange.from) {
            const checkIn = new Date(selectedDateRange.from);
            const nextDay = new Date(checkIn);
            nextDay.setDate(checkIn.getDate() + 1);

            if (activeConfig.closeAt && nextDay > activeConfig.closeAt) {
                isNextDayBlocked = true;
            }

            if (checkIn.getDay() === 5) { // Friday
                const saturdayBookedSiteIds = reservations
                    .filter(r => {
                        const rCheckIn = new Date(r.checkInDate);
                        const rCheckOut = new Date(r.checkOutDate);
                        return rCheckIn <= nextDay && rCheckOut > nextDay && r.status !== 'CANCELLED';
                    })
                    .map(r => r.siteId);

                const fridayBookedSiteIds = reservations
                    .filter(r => {
                        const rCheckIn = new Date(r.checkInDate);
                        const rCheckOut = new Date(r.checkOutDate);
                        return rCheckIn <= checkIn && rCheckOut > checkIn && r.status !== 'CANCELLED';
                    })
                    .map(r => r.siteId);

                const hasEndCapCandidate = sites.some(site =>
                    !fridayBookedSiteIds.includes(site.id) &&
                    saturdayBookedSiteIds.includes(site.id)
                );

                if (hasEndCapCandidate) {
                    hasEndCapAvailability = true;
                }
            }
        }

        const ruleResult = checkReservationRules(selectedDateRange.from, selectedDateRange.to, now, { hasEndCapAvailability, isNextDayBlocked });
        return { ...ruleResult, hasEndCapAvailability, isNextDayBlocked };
    }, [selectedDateRange.from, activeConfig, selectedDateRange.to, reservations, now, sites]);

    return (
        <main className="min-h-screen bg-[#F7F5EF] pb-32">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#F7F5EF]/80 backdrop-blur-md border-b border-stone-200 px-4 h-16 flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2 hover:bg-stone-100">
                    <ArrowLeft className="w-5 h-5 text-stone-700" />
                </Button>
                <h1 className="font-bold text-lg text-stone-800">예약하기</h1>
            </header>

            {/* SSOT 5.10.3 Open Day Banner */}
            <div className={`text-white px-5 py-4 shadow-md transition-colors ${isClosed ? 'bg-stone-600' : 'bg-[#1C4526]'}`}>
                <div className="flex items-start gap-4 max-w-lg mx-auto">
                    <div className="mt-1 p-2 bg-white/10 rounded-full">
                        {isClosed ? <Lock className="w-5 h-5 text-stone-300" /> : <Megaphone className="w-5 h-5 text-[#C3A675] animate-pulse" />}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="font-bold text-lg text-white">
                                {isClosed
                                    ? activeConfig.closedTitle
                                    : (isOpen ? "예약 가능" : activeConfig.preOpenTitle)
                                }
                            </h2>
                            {/* D-Day Badge */}
                            {!isOpen && !isClosed && dDayBadge && (
                                <span className="bg-[#C3A675] text-[#1C4526] text-xs font-bold px-2 py-0.5 rounded-full animate-bounce">
                                    {dDayBadge}
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">
                            {isClosed
                                ? activeConfig.closedMessage
                                : (isOpen
                                    ? `${format(activeConfig.closeAt, 'MM월 dd일')}까지 예약 가능합니다.\n${
                                    // Next Season Logic for Monthly
                                    openDayRule?.repeat_rule === 'MONTHLY'
                                        ? `(다음시즌 오픈일 ${format(startOfDay(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)), 'MM월 dd일')})`
                                        : activeConfig.nextSeasonOpenAt
                                            ? `(다음시즌 오픈일 ${format(activeConfig.nextSeasonOpenAt, 'MM월 dd일')})`
                                            : ''
                                    }`
                                    : `${activeConfig.preOpenMessage}\n오픈: ${activeConfig.openAt.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' })}`
                                )
                            }
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-8 max-w-lg mx-auto">
                <section>
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <span className="w-1 h-5 bg-[#1C4526] rounded-full"></span>
                        <h2 className="text-lg font-bold text-stone-800">날짜 선택</h2>
                    </div>
                    <DateRangePicker />
                </section>

                <section className={`transition-all duration-300 ${isBlocked || !isOpen ? 'opacity-60 grayscale pointer-events-none' : 'opacity-100'}`}>
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <span className="w-1 h-5 bg-[#C3A675] rounded-full"></span>
                        <h2 className="text-lg font-bold text-stone-800">사이트 선택</h2>
                    </div>

                    {isBlocked ? (
                        <div className="p-6 text-center bg-white rounded-2xl border border-stone-200 shadow-sm">
                            <p className="text-sm text-stone-600 leading-relaxed break-keep leading-relaxed pb-2 pt-2">
                                현재 지정한 기간에는 예약 가능한 사이트가 없습니다.<br />기간을 다시 지정해보세요.
                            </p>
                        </div>
                    ) : !isOpen && !isClosed ? (
                        <div className="p-6 text-center bg-white rounded-2xl border border-stone-200 shadow-sm">
                            <p className="text-stone-400 font-bold mb-2 flex items-center justify-center gap-2">
                                <CalendarClock className="w-4 h-4" />
                                예약 오픈 대기
                            </p>
                            <p className="text-sm text-stone-500">
                                예약 오픈일 이후 사이트를 선택할 수 있습니다.
                            </p>
                        </div>
                    ) : isClosed ? (
                        <div className="p-6 text-center bg-white rounded-2xl border border-stone-200 shadow-sm">
                            <p className="text-stone-400 font-bold mb-2 flex items-center justify-center gap-2">
                                <Lock className="w-4 h-4" />
                                시즌 마감
                            </p>
                            <p className="text-sm text-stone-500">
                                다음 시즌 오픈을 기다려주세요.
                            </p>
                        </div>
                    ) : (
                        <SiteList />
                    )}
                </section>
            </div>
        </main>
    );
}

'use client';

import DateRangePicker from '@/components/reservation/DateRangePicker';
import SiteList from '@/components/reservation/SiteList';
import { useReservationStore } from '@/store/useReservationStore';
import { checkReservationRules, D_N_DAYS } from '@/utils/reservationRules';
import { SITES } from '@/constants/sites';

export default function ReservationPage() {
    const { selectedDateRange, reservations } = useReservationStore();

    // Strict Weekend Rule Logic (SSOT 6.2.1)
    const now = new Date();

    // Calculate End-cap conditions
    let isSaturdayFull = false;
    let isNextDayBlocked = false;

    if (selectedDateRange.from) {
        const checkIn = new Date(selectedDateRange.from);
        const nextDay = new Date(checkIn);
        nextDay.setDate(checkIn.getDate() + 1);

        // Mock Open Day Rule (should match DateRangePicker)
        const OPEN_DAY_RULE = {
            closeAt: new Date('2025-12-31T23:59:59'),
        };

        if (nextDay > OPEN_DAY_RULE.closeAt) {
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

            // Check if ANY site is an End-cap candidate
            // (Free on Fri AND Booked on Sat)
            // We need SITES list here. Since we can't easily import SITES in this file without adding import,
            // let's assume we can import it.
            // Actually, we need to import SITES.
            const hasEndCapCandidate = SITES.some(site =>
                !fridayBookedSiteIds.includes(site.id) &&
                saturdayBookedSiteIds.includes(site.id)
            );

            if (hasEndCapCandidate) {
                isSaturdayFull = true;
            }
        }
    }

    const { isBlocked } = checkReservationRules(selectedDateRange.from, selectedDateRange.to, now, { isSaturdayFull, isNextDayBlocked });

    return (
        <main className="min-h-screen bg-[#1a1a1a] text-white pb-24 px-4 pt-20">
            <h1 className="text-2xl font-bold mb-6 text-center">예약하기</h1>

            <div className="space-y-8">
                <section>
                    <h2 className="text-lg font-semibold mb-3 text-white/90">날짜 선택</h2>
                    <DateRangePicker />
                </section>

                <section className={`transition-opacity duration-300 ${isBlocked ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
                    <h2 className="text-lg font-semibold mb-3 text-white/90">사이트 선택</h2>
                    {isBlocked ? (
                        <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/10">
                            <p className="text-red-400 font-bold mb-2">⛔ 사이트 선택 불가</p>
                            <p className="text-sm text-white/60">
                                주말(금요일)은 2박 이상 예약 시에만 사이트를 선택할 수 있습니다.<br />
                                (단, 예약일 기준 {D_N_DAYS}일 이내인 경우 1박 예약이 가능합니다)
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

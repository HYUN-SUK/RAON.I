'use client';

import DateRangePicker from '@/components/reservation/DateRangePicker';
import SiteList from '@/components/reservation/SiteList';
import { useReservationStore } from '@/store/useReservationStore';
import { checkReservationRules, D_N_DAYS } from '@/utils/reservationRules';

export default function ReservationPage() {
    const { selectedDateRange } = useReservationStore();

    // Strict Weekend Rule Logic (SSOT 6.2.1)
    // Use centralized utility
    const now = new Date();
    const { isBlocked } = checkReservationRules(selectedDateRange.from, selectedDateRange.to, now);

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

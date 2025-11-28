import DateRangePicker from '@/components/reservation/DateRangePicker';
import SiteList from '@/components/reservation/SiteList';

export default function ReservationPage() {
    return (
        <main className="min-h-screen bg-[#1a1a1a] text-white pb-24 px-4 pt-20">
            <h1 className="text-2xl font-bold mb-6">예약하기</h1>

            <div className="space-y-8">
                <section>
                    <h2 className="text-lg font-semibold mb-3 text-white/90">날짜 선택</h2>
                    <DateRangePicker />
                </section>

                <section>
                    <h2 className="text-lg font-semibold mb-3 text-white/90">사이트 선택</h2>
                    <SiteList />
                </section>
            </div>
        </main>
    );
}

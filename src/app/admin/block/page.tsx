import UnifiedReservationCalendar from '@/components/admin/UnifiedReservationCalendar';

export default function AdminBlockPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">통합 예약 캘린더 (차단/관리)</h1>
            <p className="text-gray-500">예약 현황을 확인하고, 특정 사이트의 일정을 관리(차단)할 수 있습니다.</p>

            <UnifiedReservationCalendar />
        </div>
    );
}

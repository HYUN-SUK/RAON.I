import BlockDateScheduler from '@/components/admin/BlockDateScheduler';

export default function AdminBlockPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">차단일 관리</h1>
            <p className="text-gray-500">특정 날짜의 예약을 막거나 해제할 수 있습니다.</p>

            <BlockDateScheduler />
        </div>
    );
}

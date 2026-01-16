'use client';

import { useReservationStore } from '@/store/useReservationStore';
import ReservationCard from '@/components/admin/ReservationCard';
import { useState, useEffect } from 'react';
import { ReservationStatus } from '@/types/reservation';

import { useSearchParams } from 'next/navigation';

export default function AdminReservationsPage() {
    const { reservations, fetchAllReservations } = useReservationStore();
    const searchParams = useSearchParams();
    const initialStatus = searchParams.get('status') as ReservationStatus | 'ALL' | null;

    const [filterStatus, setFilterStatus] = useState<ReservationStatus | 'ALL'>(initialStatus || 'ALL');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
        fetchAllReservations();
    }, [fetchAllReservations]);

    useEffect(() => {
        if (initialStatus) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFilterStatus(initialStatus);
        }
    }, [initialStatus]);

    if (!mounted) return <div className="p-4">Loading...</div>;

    const filteredReservations = reservations
        .filter(r => filterStatus === 'ALL' || r.status === filterStatus)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800">예약 관리</h2>

                <div className="flex space-x-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
                    <FilterButton label="전체" active={filterStatus === 'ALL'} onClick={() => setFilterStatus('ALL')} />
                    <FilterButton label="입금 대기" active={filterStatus === 'PENDING'} onClick={() => setFilterStatus('PENDING')} count={reservations.filter(r => r.status === 'PENDING').length} />
                    <FilterButton label="확정됨" active={filterStatus === 'CONFIRMED'} onClick={() => setFilterStatus('CONFIRMED')} />
                    <FilterButton label="환불대기" active={filterStatus === 'REFUND_PENDING'} onClick={() => setFilterStatus('REFUND_PENDING')} count={reservations.filter(r => r.status === 'REFUND_PENDING').length} />
                    <FilterButton label="환불완료" active={filterStatus === 'REFUNDED'} onClick={() => setFilterStatus('REFUNDED')} />
                    <FilterButton label="취소됨" active={filterStatus === 'CANCELLED'} onClick={() => setFilterStatus('CANCELLED')} />
                </div>
            </div>

            {filteredReservations.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-dashed">
                    <p className="text-gray-500">해당하는 예약이 없습니다.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredReservations.map(reservation => (
                        <ReservationCard key={reservation.id} reservation={reservation} />
                    ))}
                </div>
            )}
        </div>
    );
}

function FilterButton({ label, active, onClick, count }: { label: string, active: boolean, onClick: () => void, count?: number }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${active
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 border hover:bg-gray-50'
                }`}
        >
            {label}
            {count !== undefined && count > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${active ? 'bg-white text-gray-900' : 'bg-gray-200 text-gray-700'}`}>
                    {count}
                </span>
            )}
        </button>
    );
}

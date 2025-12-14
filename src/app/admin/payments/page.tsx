'use client';

import { useReservationStore } from '@/store/useReservationStore';
import ReservationCard from '@/components/admin/ReservationCard';
import { AlertCircle } from 'lucide-react';

export default function AdminPaymentsPage() {
    const { reservations } = useReservationStore();

    // SSOT 11.3: 입금 대기 리스트
    const pendingReservations = reservations
        .filter((r) => r.status === 'PENDING')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());


    const totalAmount = pendingReservations.reduce((sum, r) => sum + r.totalPrice, 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">입금 확인</h1>
                    <p className="text-gray-500">입금 대기 중인 예약을 확인하고 확정 처리합니다.</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500">대기 중 금액 합계</p>
                    <p className="text-2xl font-bold text-[#1C4526]">{totalAmount.toLocaleString()}원</p>
                </div>
            </div>

            {pendingReservations.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
                    <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">입금 대기 내역이 없습니다</h3>
                    <p className="text-gray-500 mt-1">모든 예약이 처리되었습니다.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {pendingReservations.map((reservation) => (
                        <ReservationCard key={reservation.id} reservation={reservation} />
                    ))}
                </div>
            )}
        </div>
    );
}

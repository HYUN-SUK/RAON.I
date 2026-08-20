'use client';

import { useReservationStore } from '@/store/useReservationStore';
import ReservationCard from '@/components/admin/ReservationCard';
import { AlertCircle, Banknote, CreditCard } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function AdminPaymentsPage() {
    const { reservations, fetchAllReservations } = useReservationStore();
    const [activeTab, setActiveTab] = useState<'PENDING' | 'REFUND_PENDING'>('PENDING');

    useEffect(() => {
        fetchAllReservations();
    }, [fetchAllReservations]);

    // 입금 대기 리스트
    const pendingReservations = reservations
        .filter((r) => r.status === 'PENDING')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 환불 대기 리스트
    const refundPendingReservations = reservations
        .filter((r) => r.status === 'REFUND_PENDING')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalPendingAmount = pendingReservations.reduce((sum, r) => sum + r.totalPrice, 0);
    const totalRefundAmount = refundPendingReservations.reduce((sum, r) => sum + (r.refundAmount ?? r.totalPrice), 0);

    const currentList = activeTab === 'PENDING' ? pendingReservations : refundPendingReservations;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">결제 / 환불 관리</h1>
                    <p className="text-gray-500">입금 대기 및 환불 대기 중인 예약을 확인하고 처리합니다.</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500">
                        {activeTab === 'PENDING' ? '입금 대기 총액' : '환불 대기 총액'}
                    </p>
                    <p className={`text-2xl font-bold ${activeTab === 'PENDING' ? 'text-[#1C4526]' : 'text-orange-600'}`}>
                        {(activeTab === 'PENDING' ? totalPendingAmount : totalRefundAmount).toLocaleString()}원
                    </p>
                </div>
            </div>

            {/* 탭 전환 버튼 */}
            <div className="flex space-x-2 border-b border-gray-200 pb-2">
                <button
                    onClick={() => setActiveTab('PENDING')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        activeTab === 'PENDING'
                            ? 'bg-gray-900 text-white shadow-sm'
                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                >
                    <CreditCard size={16} />
                    <span>입금 대기</span>
                    {pendingReservations.length > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            activeTab === 'PENDING' ? 'bg-amber-400 text-gray-900' : 'bg-gray-100 text-gray-700'
                        }`}>
                            {pendingReservations.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('REFUND_PENDING')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        activeTab === 'REFUND_PENDING'
                            ? 'bg-orange-600 text-white shadow-sm'
                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                >
                    <Banknote size={16} />
                    <span>환불 대기 (계좌 확인)</span>
                    {refundPendingReservations.length > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            activeTab === 'REFUND_PENDING' ? 'bg-white text-orange-700' : 'bg-orange-100 text-orange-800'
                        }`}>
                            {refundPendingReservations.length}
                        </span>
                    )}
                </button>
            </div>

            {currentList.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
                    <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">
                        {activeTab === 'PENDING' ? '입금 대기 내역이 없습니다' : '환불 대기 내역이 없습니다'}
                    </h3>
                    <p className="text-gray-500 mt-1">모든 처리가 완료되었습니다.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {currentList.map((reservation) => (
                        <ReservationCard key={reservation.id} reservation={reservation} />
                    ))}
                </div>
            )}
        </div>
    );
}

'use client';

import { Reservation, ReservationStatus } from '@/types/reservation';
import { useReservationStore } from '@/store/useReservationStore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { SITES } from '@/constants/sites';
import { CheckCircle, XCircle, AlertTriangle, Banknote, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { notificationService } from '@/services/notificationService';
import { NotificationEventType } from '@/types/notificationEvents';
import { toast } from 'sonner';
import CancelReservationDialog from './CancelReservationDialog';

interface ReservationCardProps {
    reservation: Reservation;
}

import { useMySpaceStore } from '@/store/useMySpaceStore';

export default function ReservationCard({ reservation }: ReservationCardProps) {
    const { updateReservationStatus } = useReservationStore();
    const { addXp, addToken } = useMySpaceStore();
    const site = SITES.find(s => s.id === reservation.siteId);
    const [confirmStep, setConfirmStep] = useState<'IDLE' | 'CONFIRMING' | 'CANCELLING'>('IDLE');

    const handleConfirmClick = async () => {
        if (confirmStep === 'CONFIRMING') {
            updateReservationStatus(reservation.id, 'CONFIRMED');
            // Award XP and Points
            addXp(100);
            addToken(100);
            setConfirmStep('IDLE');
        } else {
            setConfirmStep('CONFIRMING');
            setTimeout(() => setConfirmStep('IDLE'), 3000); // Reset after 3s
        }
    };

    const handleCancelClick = async () => {
        if (confirmStep === 'CANCELLING') {
            updateReservationStatus(reservation.id, 'CANCELLED');
            setConfirmStep('IDLE');
        } else {
            setConfirmStep('CANCELLING');
            setTimeout(() => setConfirmStep('IDLE'), 3000);
        }
    };

    const [refunding, setRefunding] = useState(false);
    const { completeRefund } = useReservationStore();

    const handleRefundComplete = async () => {
        setRefunding(true);
        const result = await completeRefund(reservation.id);
        setRefunding(false);

        if (result.success) {
            toast.success('환불 완료 처리되었습니다');
        } else {
            toast.error(result.message || '환불 처리 실패');
        }
    };

    const statusColors: Record<ReservationStatus, string> = {
        'PENDING': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        'CONFIRMED': 'bg-blue-100 text-blue-800 border-blue-200',
        'REFUND_PENDING': 'bg-orange-100 text-orange-800 border-orange-200',
        'REFUNDED': 'bg-indigo-100 text-indigo-800 border-indigo-200',
        'CANCELLED': 'bg-gray-100 text-gray-800 border-gray-200',
        'COMPLETED': 'bg-green-100 text-green-800 border-green-200',
        'NO-SHOW': 'bg-red-100 text-red-800 border-red-200',
    };

    const statusLabels: Record<ReservationStatus, string> = {
        'PENDING': '입금 대기',
        'CONFIRMED': '예약 확정',
        'REFUND_PENDING': '환불 대기',
        'REFUNDED': '환불 완료',
        'CANCELLED': '취소됨',
        'COMPLETED': '이용 완료',
        'NO-SHOW': '노쇼',
    };

    return (
        <div className={`bg-white rounded-lg border p-4 shadow-sm ${statusColors[reservation.status]} border-l-4`}>
            <div className="flex justify-between items-start mb-2">
                <div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColors[reservation.status]} bg-opacity-50`}>
                        {statusLabels[reservation.status]}
                    </span>
                    <h3 className="text-lg font-bold mt-2">{site?.name || reservation.siteId}</h3>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500">예약일: {format(new Date(reservation.createdAt), 'yyyy-MM-dd HH:mm')}</p>
                    <p className="text-lg font-bold text-gray-900">{reservation.totalPrice.toLocaleString()}원</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 mb-4">
                <div>
                    <p className="font-semibold">일정</p>
                    <p>{format(new Date(reservation.checkInDate), 'yyyy.MM.dd (eee)', { locale: ko })} - {format(new Date(reservation.checkOutDate), 'yyyy.MM.dd (eee)', { locale: ko })}</p>
                </div>
                <div>
                    <p className="font-semibold">인원/차량</p>
                    <p>총 {reservation.guests}명 (가족 {reservation.familyCount}, 방문 {reservation.visitorCount}) / 차량 {reservation.vehicleCount}대</p>
                </div>
                <div className="col-span-2">
                    <p className="font-semibold">요청사항</p>
                    <p className="text-gray-600">{reservation.requests || '-'}</p>
                </div>
            </div>

            {/* 환불 정보 (REFUND_PENDING 상태일 때) */}
            {reservation.status === 'REFUND_PENDING' && (
                <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                        <Banknote size={16} className="text-orange-600" />
                        <span className="font-semibold text-orange-800">환불 정보</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <span className="text-gray-500">환불 계좌:</span>
                            <p className="font-medium">{reservation.refundBank} {reservation.refundAccount}</p>
                        </div>
                        <div>
                            <span className="text-gray-500">예금주:</span>
                            <p className="font-medium">{reservation.refundHolder}</p>
                        </div>
                        <div>
                            <span className="text-gray-500">환불액:</span>
                            <p className="font-bold text-orange-700">
                                {reservation.refundAmount?.toLocaleString()}원
                                <span className="text-xs font-normal ml-1">({reservation.refundRate}%)</span>
                            </p>
                        </div>
                        {reservation.cancelReason && (
                            <div>
                                <span className="text-gray-500">취소 사유:</span>
                                <p className="font-medium">{reservation.cancelReason}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
                {reservation.status === 'PENDING' && (
                    <button
                        onClick={handleConfirmClick}
                        className={`flex items-center space-x-1 px-3 py-2 rounded text-sm font-medium transition-colors ${confirmStep === 'CONFIRMING'
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                    >
                        <CheckCircle size={16} />
                        <span>{confirmStep === 'CONFIRMING' ? '정말 확정할까요?' : '입금 확인'}</span>
                    </button>
                )}
                {reservation.status === 'REFUND_PENDING' && (
                    <button
                        onClick={handleRefundComplete}
                        disabled={refunding}
                        className="flex items-center space-x-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {refunding ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />}
                        <span>{refunding ? '처리 중...' : '환불 완료'}</span>
                    </button>
                )}
                {reservation.status !== 'CANCELLED' && reservation.status !== 'REFUND_PENDING' && reservation.status !== 'REFUNDED' && (
                    <CancelReservationDialog
                        reservationId={reservation.id}
                        trigger={
                            <button
                                className="flex items-center space-x-1 px-3 py-2 border rounded text-sm font-medium transition-colors bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                <XCircle size={16} />
                                <span>취소</span>
                            </button>
                        }
                    />
                )}
            </div>
        </div>
    );
}

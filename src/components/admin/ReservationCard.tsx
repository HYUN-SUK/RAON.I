'use client';

import { Reservation, ReservationStatus } from '@/types/reservation';
import { useReservationStore } from '@/store/useReservationStore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { SITES } from '@/constants/sites';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { notificationService } from '@/services/notificationService';
import { NotificationEventType } from '@/types/notificationEvents';

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

            // 푸시 알림 발송: 입금 확정 (예약 확정)
            if (reservation.userId) {
                const siteName = site?.name || reservation.siteId;
                const checkIn = format(new Date(reservation.checkInDate), 'MM.dd(eee)', { locale: ko });
                const checkOut = format(new Date(reservation.checkOutDate), 'MM.dd(eee)', { locale: ko });
                await notificationService.dispatchNotification(
                    NotificationEventType.DEPOSIT_CONFIRMED,
                    reservation.userId,
                    {
                        siteName,
                        checkIn,
                        checkOut,
                        reservation_id: reservation.id
                    },
                    reservation.id
                );
            }
        } else {
            setConfirmStep('CONFIRMING');
            setTimeout(() => setConfirmStep('IDLE'), 3000); // Reset after 3s
        }
    };

    const handleCancelClick = async () => {
        if (confirmStep === 'CANCELLING') {
            updateReservationStatus(reservation.id, 'CANCELLED');
            setConfirmStep('IDLE');

            // 푸시 알림 발송: 예약 취소
            if (reservation.userId) {
                const siteName = site?.name || reservation.siteId;
                const checkIn = format(new Date(reservation.checkInDate), 'MM.dd(eee)', { locale: ko });
                const checkOut = format(new Date(reservation.checkOutDate), 'MM.dd(eee)', { locale: ko });
                await notificationService.dispatchNotification(
                    NotificationEventType.RESERVATION_CANCELLED,
                    reservation.userId,
                    {
                        siteName,
                        checkIn,
                        checkOut,
                        reservation_id: reservation.id
                    },
                    reservation.id
                );
            }
        } else {
            setConfirmStep('CANCELLING');
            setTimeout(() => setConfirmStep('IDLE'), 3000);
        }
    };

    const statusColors: Record<ReservationStatus, string> = {
        'PENDING': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        'CONFIRMED': 'bg-blue-100 text-blue-800 border-blue-200',
        'CANCELLED': 'bg-gray-100 text-gray-800 border-gray-200',
        'COMPLETED': 'bg-green-100 text-green-800 border-green-200',
        'NO-SHOW': 'bg-red-100 text-red-800 border-red-200',
    };

    const statusLabels: Record<ReservationStatus, string> = {
        'PENDING': '입금 대기',
        'CONFIRMED': '예약 확정',
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
                {reservation.status !== 'CANCELLED' && (
                    <button
                        onClick={handleCancelClick}
                        className={`flex items-center space-x-1 px-3 py-2 border rounded text-sm font-medium transition-colors ${confirmStep === 'CANCELLING'
                            ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <XCircle size={16} />
                        <span>{confirmStep === 'CANCELLING' ? '정말 취소할까요?' : '취소'}</span>
                    </button>
                )}
            </div>
        </div>
    );
}

'use client';

import { Reservation, ReservationStatus } from '@/types/reservation';
import { useReservationStore } from '@/store/useReservationStore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { SITES } from '@/constants/sites';
import { CheckCircle, XCircle, Banknote, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import CancelReservationDialog from './CancelReservationDialog';

interface ReservationCardProps {
    reservation: Reservation;
}

import { useMySpaceStore } from '@/store/useMySpaceStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

export default function ReservationCard({ reservation }: ReservationCardProps) {
    const { updateReservationStatus, deadlineHours, getUserHistory } = useReservationStore();
    const { addXp, addToken } = useMySpaceStore();
    const site = SITES.find(s => s.id === reservation.siteId);
    const [confirmStep, setConfirmStep] = useState<'IDLE' | 'CONFIRMING' | 'CANCELLING'>('IDLE');

    const [visitCount, setVisitCount] = useState<number>(0);
    const [historyList, setHistoryList] = useState<Reservation[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

    useEffect(() => {
        const loadHistory = async () => {
            const userIdQuery = reservation.userId || reservation.guestName;
            if (userIdQuery) {
                try {
                    const history = await getUserHistory(userIdQuery);
                    const today = new Date();
                    const completed = history.filter(h => {
                        const checkOut = new Date(h.checkOutDate);
                        return h.status !== 'CANCELLED' && checkOut < today;
                    });
                    setVisitCount(completed.length);
                    setHistoryList(history);
                } catch (e) {
                     console.error("Failed to load user history in ReservationCard:", e);
                }
            }
        };
        loadHistory();
    }, [reservation.userId, reservation.guestName, getUserHistory]);

    // 입금 기한 및 유예 만료 시간 연산
    const createdAt = new Date(reservation.createdAt);
    const deadline = new Date(createdAt.getTime() + (deadlineHours || 6) * 60 * 60 * 1000);
    const now = new Date();
    const isOverdue = now > deadline;

    // 유예 만료 시간 계산
    const graceTime = new Date(deadline);
    const graceHour = graceTime.getHours();
    if (graceHour < 9) {
        graceTime.setHours(9, 0, 0, 0);
    } else if (graceHour < 18) {
        graceTime.setHours(18, 0, 0, 0);
    } else {
        graceTime.setDate(graceTime.getDate() + 1);
        graceTime.setHours(9, 0, 0, 0);
    }

    const [isProcessing, setIsProcessing] = useState(false);

    const handleConfirmClick = async () => {
        if (confirmStep === 'CONFIRMING') {
            if (isProcessing) return;
            setIsProcessing(true);

            try {
                // Use store action to update both DB and local state
                await updateReservationStatus(reservation.id, 'CONFIRMED');

                toast.success('예약이 확정되었습니다');
                // Award XP and Points (Optional: move to server if needed)
                addXp(100);
                addToken(100);
            } catch (e) {
                console.error(e);
                toast.error('오류가 발생했습니다');
            } finally {
                setIsProcessing(false);
                setConfirmStep('IDLE');
            }
        } else {
            setConfirmStep('CONFIRMING');
            setTimeout(() => setConfirmStep('IDLE'), 3000); // Reset after 3s
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
                    {reservation.status === 'PENDING' && (
                        <div className="text-xs mt-1 space-y-0.5">
                            <p className={`${isOverdue ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                                입금기한: {format(deadline, 'MM-dd HH:mm')} {isOverdue ? '(경과)' : '까지'}
                            </p>
                            {isOverdue && (
                                <p className="text-orange-600 font-semibold">
                                    최종유예: {format(graceTime, 'MM-dd HH:mm')} 까지
                                </p>
                            )}
                        </div>
                    )}
                    <p className="text-lg font-bold text-gray-900 mt-1">{reservation.totalPrice.toLocaleString()}원</p>
                </div>
            </div>

            {/* 일정 및 인원/차량 상세 */}
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 mb-3">
                <div>
                    <p className="font-semibold text-xs text-gray-500">일정 ({Math.ceil((new Date(reservation.checkOutDate).getTime() - new Date(reservation.checkInDate).getTime()) / (1000 * 60 * 60 * 24))}박)</p>
                    <p className="font-bold text-gray-900">{format(new Date(reservation.checkInDate), 'yyyy.MM.dd (eee)', { locale: ko })} - {format(new Date(reservation.checkOutDate), 'MM.dd (eee)', { locale: ko })}</p>
                </div>
                <div>
                    <p className="font-semibold text-xs text-gray-500">가족 / 차량</p>
                    <p className="font-bold text-gray-900">
                        {reservation.familyCount}가족 {reservation.familyCount > 1 ? `(추가 ${reservation.familyCount - 1}팀)` : '(기본)'} / 차량 {reservation.vehicleCount}대
                    </p>
                </div>
                <div className="col-span-2 bg-stone-50 p-2.5 rounded-lg border border-stone-200/70 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-stone-700">👥 인원 상세:</span>
                        <span className="text-stone-900 font-extrabold">
                            {reservation.guestDetails ? (
                                `숙박 ${(reservation.guestDetails.adults || 0) + (reservation.guestDetails.seniors || 0) + (reservation.guestDetails.kids?.preschool || 0) + (reservation.guestDetails.kids?.elementary || 0) + (reservation.guestDetails.kids?.teen || 0)}명 (성인 ${reservation.guestDetails.adults || 0}${reservation.guestDetails.kids?.elementary ? `, 초등 ${reservation.guestDetails.kids.elementary}` : ''}${reservation.guestDetails.kids?.preschool ? `, 미취학 ${reservation.guestDetails.kids.preschool}` : ''}${reservation.guestDetails.kids?.teen ? `, 청소년 ${reservation.guestDetails.kids.teen}` : ''}${reservation.guestDetails.seniors ? `, 시니어 ${reservation.guestDetails.seniors}` : ''})`
                            ) : `숙박 ${reservation.guests}명`}
                            {reservation.visitorCount > 0 ? ` + 방문객 ${reservation.visitorCount}명` : ''}
                        </span>
                    </div>
                    {reservation.guestDetails?.hasPet && (
                        <p className="text-amber-700 font-semibold">🐾 반려동물 동반</p>
                    )}
                </div>
                <div className="col-span-2">
                    <p className="font-semibold text-xs text-gray-500">요청사항</p>
                    <p className="text-gray-600 text-xs">{reservation.requests || '-'}</p>
                </div>
                <div className="col-span-2 mt-1 p-2 bg-gray-50 dark:bg-stone-900 rounded border border-gray-100 dark:border-stone-800 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <div>
                        <span className="font-bold text-gray-500">예약자: </span>
                        <span className="font-extrabold text-gray-900 dark:text-gray-100">{reservation.guestName || '이름 없음'}</span>
                    </div>
                    <div>
                        <span className="font-bold text-gray-500">연락처: </span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{reservation.guestPhone || '연락처 없음'}</span>
                    </div>
                    <div>
                        <span className="font-bold text-gray-500">이력: </span>
                        <span
                            onClick={() => historyList.length > 0 && setIsHistoryOpen(true)}
                            className={`font-bold text-blue-600 dark:text-blue-400 underline decoration-dotted cursor-pointer hover:text-blue-800 ${historyList.length === 0 ? 'pointer-events-none text-gray-400 no-underline' : ''}`}
                        >
                            방문 {visitCount}회
                        </span>
                    </div>
                </div>
            </div>

            {/* 요금 산출 내역 영수증 박스 */}
            {(() => {
                const nights = Math.max(1, Math.ceil((new Date(reservation.checkOutDate).getTime() - new Date(reservation.checkInDate).getTime()) / (1000 * 60 * 60 * 24)));
                const extraFam = Math.max(0, (reservation.familyCount || 1) - 1);
                const extraFamCost = extraFam * 35000 * nights;
                const visitorCost = (reservation.visitorCount || 0) * 10000;
                const baseStayCost = reservation.totalPrice - extraFamCost - visitorCost;

                return (
                    <div className="mb-3 p-2.5 bg-blue-50/70 rounded-lg border border-blue-100 text-xs space-y-1">
                        <div className="flex justify-between items-center font-bold text-blue-900 mb-1 border-b border-blue-200/60 pb-1">
                            <span>🧾 요금 산출 내역</span>
                            <span className="text-sm font-extrabold text-blue-950">{reservation.totalPrice.toLocaleString()}원</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>• 기본 숙박료 ({nights}박)</span>
                            <span className="font-medium">{baseStayCost.toLocaleString()}원</span>
                        </div>
                        {extraFamCost > 0 && (
                            <div className="flex justify-between text-gray-600">
                                <span>• 추가 가족 (+{extraFam}가족 × {nights}박)</span>
                                <span className="font-medium text-amber-700">+{extraFamCost.toLocaleString()}원</span>
                            </div>
                        )}
                        {visitorCost > 0 && (
                            <div className="flex justify-between text-gray-600">
                                <span>• 방문객 (+{reservation.visitorCount}명)</span>
                                <span className="font-medium text-amber-700">+{visitorCost.toLocaleString()}원</span>
                            </div>
                        )}
                    </div>
                );
            })()}

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
                        disabled={isProcessing}
                        className={`flex items-center space-x-1 px-3 py-2 rounded text-sm font-medium transition-colors ${confirmStep === 'CONFIRMING'
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                        <span>
                            {isProcessing ? '처리중...' : (confirmStep === 'CONFIRMING' ? '정말 확정할까요?' : '입금 확인')}
                        </span>
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
                                className="flex items-center space-x-1 px-3 py-2 border rounded text-sm font-bold transition-colors bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                            >
                                <XCircle size={16} />
                                <span>예약 취소</span>
                            </button>
                        }
                    />
                )}
            </div>

            {/* 과거 이력 팝업 모달 */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-md w-full bg-white p-6 rounded-lg shadow-lg">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2 text-stone-900">
                            📜 {reservation.guestName || '고객'}님의 과거 이용 내역
                        </DialogTitle>
                    </DialogHeader>
                    <div className="my-4 max-h-[300px] overflow-y-auto pr-2 space-y-2.5">
                        {historyList.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">과거 이용 내역이 없습니다.</p>
                        ) : (
                            historyList.map(h => (
                                <div key={h.id} className="text-xs border p-3 rounded-lg bg-gray-50 flex justify-between items-center text-stone-800">
                                    <div className="space-y-1">
                                        <p className="font-bold text-gray-800">
                                            {format(new Date(h.checkInDate), 'yy.MM.dd')} ~ {format(new Date(h.checkOutDate), 'MM.dd')}
                                        </p>
                                        <p className="text-gray-500 font-medium">
                                            {SITES.find(s => s.id === h.siteId)?.name || h.siteId} / {h.guests}명
                                        </p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        h.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                                        h.status === 'CANCELLED' ? 'bg-gray-200 text-gray-600 line-through' :
                                        h.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                        {h.status === 'CONFIRMED' ? '이용 완료' : h.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                    <DialogFooter className="flex justify-end pt-2 border-t">
                        <Button onClick={() => setIsHistoryOpen(false)} className="bg-gray-900 hover:bg-gray-800 text-white text-sm">
                            닫기
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

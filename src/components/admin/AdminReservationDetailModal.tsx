'use client';

import React, { useState } from 'react';
import { Reservation } from '@/types/reservation';
import { useReservationStore } from '@/store/useReservationStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, History, Phone, User, Calendar, CreditCard, Tent, Car, Users, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import CancelReservationDialog from './CancelReservationDialog';

interface AdminReservationDetailModalProps {
    reservation: Reservation | null;
    isOpen: boolean;
    onClose: () => void;
    onStatusChanged?: () => void;
}

export default function AdminReservationDetailModal({
    reservation,
    isOpen,
    onClose,
    onStatusChanged
}: AdminReservationDetailModalProps) {
    const { updateReservationStatus, fetchAllReservations, getUserHistory, sites } = useReservationStore();
    const [userHistory, setUserHistory] = useState<Reservation[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    if (!reservation) return null;

    const site = sites.find(s => s.id === reservation.siteId);
    const siteName = site?.name || reservation.siteId || '사이트 미지정';

    const loadUserHistory = async () => {

        const q = reservation.guestPhone || reservation.userId || '';
        if (!q) return;
        setIsLoadingHistory(true);
        try {
            const history = await getUserHistory(q);
            setUserHistory(history || []);
            setShowHistory(true);
        } catch (e) {


            console.error('Failed to load user history', e);
            toast.error('과거 이력 조회에 실패했습니다.');
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleConfirmPayment = async () => {
        try {
            await updateReservationStatus(reservation.id, 'CONFIRMED');
            toast.success('입금 확인 및 예약이 확정되었습니다.');
            if (onStatusChanged) onStatusChanged();
            onClose();
        } catch (e: any) {
            toast.error(e?.message || '확정 처리에 실패했습니다.');
        }
    };

    // 요금 산출 내역 계산
    const checkIn = new Date(reservation.checkInDate);
    const checkOut = new Date(reservation.checkOutDate);
    const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
    const extraFam = Math.max(0, (reservation.familyCount || 1) - 1);
    const extraFamCost = extraFam * 35000 * nights;
    const visitorCost = (reservation.visitorCount || 0) * 10000;
    const baseStayCost = reservation.totalPrice - extraFamCost - visitorCost;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between pr-6 text-lg font-bold">
                        <span className="flex items-center gap-2">
                            <Tent className="w-5 h-5 text-[#224732]" />
                            예약 상세 정보
                        </span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                            reservation.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' :
                            reservation.status === 'PENDING' ? 'bg-amber-100 text-amber-900' :
                            reservation.status === 'REFUND_PENDING' ? 'bg-orange-100 text-orange-900' :
                            reservation.status === 'REFUNDED' ? 'bg-purple-100 text-purple-900' :
                            'bg-gray-100 text-gray-700'
                        }`}>
                            {reservation.status === 'CONFIRMED' ? '예약확정 (결제완료)' :
                             reservation.status === 'PENDING' ? '입금대기' :
                             reservation.status === 'REFUND_PENDING' ? '환불대기' :
                             reservation.status === 'REFUNDED' ? '환불완료' :
                             reservation.status === 'CANCELLED' ? '예약취소' : reservation.status}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className="grid md:grid-cols-2 gap-5 mt-2">
                    {/* 좌측: 예약자 및 일정 정보 */}
                    <div className="space-y-4">
                        {/* 예약자 박스 */}
                        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2">
                            <div>
                                <Label className="text-[11px] font-bold text-stone-500">예약자 / 연락처</Label>
                                <div className="flex items-center justify-between mt-0.5">
                                    <p className="font-extrabold text-base text-stone-900">
                                        {reservation.guestName || '이름 없음'}
                                    </p>
                                    <a 
                                        href={`tel:${reservation.guestPhone}`}
                                        className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md font-semibold hover:bg-blue-100 flex items-center gap-1"
                                    >
                                        <Phone className="w-3 h-3" /> {reservation.guestPhone || '-'}
                                    </a>
                                </div>
                                <button
                                    type="button"
                                    onClick={loadUserHistory}
                                    className="text-[11px] text-blue-600 hover:underline mt-1 flex items-center gap-1 font-medium"
                                >
                                    🔍 {isLoadingHistory ? '이력 불러오는 중...' : '클릭하여 방문 횟수 및 이전 예약 내역 조회'}
                                </button>
                            </div>

                            <div className="pt-2 border-t border-stone-200 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="text-stone-400">예약 사이트:</span>
                                    <p className="font-bold text-emerald-800">{siteName}</p>
                                </div>
                                <div>
                                    <span className="text-stone-400">차량 대수:</span>
                                    <p className="font-bold text-stone-800">
                                        {reservation.vehicleCount || 1}대 {reservation.vehicleNumber ? `(${reservation.vehicleNumber})` : ''}
                                    </p>
                                </div>
                            </div>

                            <div className="text-xs">
                                <span className="text-stone-400">예약 일정:</span>
                                <p className="font-bold text-stone-800">
                                    {format(checkIn, 'yyyy.MM.dd(eee)', { locale: ko })} ~ {format(checkOut, 'yyyy.MM.dd(eee)', { locale: ko })} ({nights}박)
                                </p>
                            </div>
                        </div>

                        {/* 인원 상세 박스 */}
                        <div className="bg-white p-3.5 rounded-xl border border-stone-200 text-xs space-y-1.5 shadow-xs">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-stone-600 flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5 text-stone-500" /> 인원 구성:
                                </span>
                                <span className="font-extrabold text-stone-900">
                                    {reservation.familyCount || 1}가족 / 숙박 {reservation.guests}명
                                    {reservation.visitorCount > 0 ? ` + 방문객 ${reservation.visitorCount}명` : ''}
                                </span>
                            </div>

                            {reservation.guestDetails && (
                                <div className="text-stone-500 text-[11px] bg-stone-50 p-2 rounded-lg space-y-0.5">
                                    <p>• 성인 {reservation.guestDetails.adults || 0}명</p>
                                    {reservation.guestDetails.kids?.elementary ? <p>• 초등학생 {reservation.guestDetails.kids.elementary}명</p> : null}
                                    {reservation.guestDetails.kids?.preschool ? <p>• 미취학 아동 {reservation.guestDetails.kids.preschool}명</p> : null}
                                    {reservation.guestDetails.kids?.teen ? <p>• 청소년 {reservation.guestDetails.kids.teen}명</p> : null}
                                    {reservation.guestDetails.seniors ? <p>• 시니어 {reservation.guestDetails.seniors}명</p> : null}
                                </div>
                            )}

                            {reservation.guestDetails?.hasPet && (
                                <p className="text-amber-800 font-bold text-[11px] bg-amber-50 px-2 py-1 rounded">
                                    🐾 반려동물 동반
                                </p>
                            )}
                        </div>

                        {/* 요청사항 */}
                        <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs">
                            <Label className="text-[11px] font-bold text-stone-500">고객 요청사항</Label>
                            <p className="text-stone-700 mt-1 whitespace-pre-wrap">{reservation.requests || '없음'}</p>
                        </div>
                    </div>

                    {/* 우측: 요금 내역 및 과거 이력 */}
                    <div className="space-y-4">
                        {/* 요금 영수증 박스 */}
                        <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200 text-xs space-y-2">
                            <div className="flex justify-between items-center font-bold text-blue-900 border-b border-blue-200 pb-2">
                                <span className="flex items-center gap-1.5">
                                    <CreditCard className="w-4 h-4 text-blue-600" /> 요금 산출 내역
                                </span>
                                <span className="text-base font-black text-blue-950">
                                    {reservation.totalPrice.toLocaleString()}원
                                </span>
                            </div>
                            <div className="space-y-1 text-stone-600 text-[11px]">
                                <div className="flex justify-between">
                                    <span>• 기본 숙박료 ({nights}박)</span>
                                    <span className="font-semibold text-stone-800">{baseStayCost.toLocaleString()}원</span>
                                </div>
                                {extraFamCost > 0 && (
                                    <div className="flex justify-between text-amber-700">
                                        <span>• 추가 가족 (+{extraFam}가족 × {nights}박)</span>
                                        <span className="font-semibold">+{extraFamCost.toLocaleString()}원</span>
                                    </div>
                                )}
                                {visitorCost > 0 && (
                                    <div className="flex justify-between text-amber-700">
                                        <span>• 추가 방문객 (+{reservation.visitorCount}명)</span>
                                        <span className="font-semibold">+{visitorCost.toLocaleString()}원</span>
                                    </div>
                                )}
                            </div>

                            {reservation.refundAmount !== undefined && reservation.refundAmount !== null && (
                                <div className="pt-2 border-t border-blue-200 flex justify-between font-bold text-rose-600">
                                    <span>• 환불 처리 금액</span>
                                    <span>-{reservation.refundAmount.toLocaleString()}원</span>
                                </div>
                            )}
                        </div>

                        {/* 과거 예약 이력 섹션 */}
                        {showHistory && (
                            <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 animate-in fade-in space-y-2">
                                <h4 className="font-bold text-xs text-stone-800 flex items-center gap-1.5">
                                    <History className="w-3.5 h-3.5 text-stone-600" />
                                    과거 방문 이력 ({userHistory.filter(h => h.status !== 'CANCELLED').length}회 완료)
                                </h4>
                                <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
                                    {userHistory.length === 0 ? (
                                        <p className="text-xs text-stone-400 py-2 text-center">과거 내역이 없습니다.</p>
                                    ) : (
                                        userHistory.map(h => (
                                            <div key={h.id} className="bg-white p-2 rounded-lg border border-stone-200 text-[11px] flex justify-between items-center">
                                                <div>
                                                    <span className="font-bold text-stone-800">{h.siteId}</span>
                                                    <span className="text-stone-400 ml-1.5">
                                                        {h.checkInDate ? format(new Date(h.checkInDate), 'yy.MM.dd') : ''}
                                                    </span>
                                                </div>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                                    h.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' :
                                                    h.status === 'CANCELLED' ? 'bg-stone-100 text-stone-500' : 'bg-amber-50 text-amber-700'
                                                }`}>
                                                    {h.status}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 하단 관리자 액션 버튼 바 */}
                <DialogFooter className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-2 sm:justify-between items-center">
                    <div className="text-xs text-stone-400">
                        신청일시: {reservation.createdAt ? format(new Date(reservation.createdAt), 'yyyy.MM.dd HH:mm') : '-'}
                    </div>

                    <div className="flex items-center gap-2">
                        {reservation.status === 'PENDING' && (
                            <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl"
                                onClick={handleConfirmPayment}
                            >
                                <CheckCircle className="w-3.5 h-3.5 mr-1" /> 입금 확인 (확정)
                            </Button>
                        )}

                        {reservation.status !== 'CANCELLED' && reservation.status !== 'REFUNDED' && (
                            <CancelReservationDialog
                                reservationId={reservation.id}
                                onSuccess={() => {
                                    toast.success('예약이 성공적으로 취소되었습니다.');
                                    if (onStatusChanged) onStatusChanged();
                                    onClose();
                                }}
                                trigger={
                                    <Button variant="destructive" size="sm" className="font-bold text-xs rounded-xl">
                                        <XCircle className="w-3.5 h-3.5 mr-1" /> 예약 취소
                                    </Button>
                                }
                            />
                        )}

                        <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs">
                            닫기
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

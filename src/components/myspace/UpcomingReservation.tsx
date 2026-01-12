"use client";

import { Calendar, MapPin, User, ChevronRight, Clock, AlertCircle, CheckCircle2, Copy, X, Loader2 } from "lucide-react";
import { useReservationStore } from "@/store/useReservationStore";
import { format, differenceInDays } from "date-fns";
import { ko } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import CancelReservationSheet from "@/components/reservation/CancelReservationSheet";
import { SITES } from "@/constants/sites";
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function UpcomingReservation() {
    const router = useRouter();
    const { reservations, fetchMyReservations, updateReservationStatus } = useReservationStore();
    const { config } = useSiteConfig();
    const [copied, setCopied] = useState(false);
    const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
    const [directCancelling, setDirectCancelling] = useState(false);
    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

    // 최신 예약 선택 로직 개선:
    // 1. PENDING/CONFIRMED 상태 우선
    // 2. 같은 상태 중 체크인 날짜가 가까운 것
    // 3. 그래도 없으면 가장 최근 생성된 것
    const latestReservation = useMemo(() => {
        if (reservations.length === 0) return null;

        // 활성 상태 (PENDING, CONFIRMED) 예약 우선
        const activeReservations = reservations.filter(
            r => r.status === 'PENDING' || r.status === 'CONFIRMED'
        );

        if (activeReservations.length > 0) {
            // 체크인 날짜가 가장 가까운 것
            return activeReservations.sort((a, b) =>
                new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
            )[0];
        }

        // 활성 예약이 없으면 가장 최근 생성된 예약
        return [...reservations].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
    }, [reservations]);

    if (!latestReservation) {
        return (
            <div className="px-6 pb-6 mt-4">
                {/* Title with Link */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-text-1">다가오는 예약</h2>
                </div>
                <div
                    onClick={() => router.push('/reservation')}
                    className="bg-white rounded-3xl p-6 shadow-sm border border-surface-2 flex flex-col items-center justify-center gap-3 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                >
                    <div className="p-3 bg-brand-1/10 rounded-full text-brand-1">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-text-1">아직 예약이 없어요</h3>
                        <p className="text-sm text-text-2">첫 번째 캠핑을 떠나보세요!</p>
                    </div>
                </div>
            </div>
        );
    }

    const { status, siteId, checkInDate, checkOutDate, familyCount, visitorCount, vehicleCount, totalPrice } = latestReservation;
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    // Calculate D-Day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDay = new Date(checkIn);
    checkInDay.setHours(0, 0, 0, 0);
    const diffDays = differenceInDays(checkInDay, today);
    const dDay = diffDays === 0 ? "D-Day" : diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`;

    // 입금 계좌 정보 (site_config에서 가져오기)
    const bankName = config?.bank_name || '카카오뱅크';
    const bankAccount = config?.bank_account || '3333-00-0000000';

    const handleCopyAccount = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(bankAccount);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDetailClick = () => {
        router.push('/reservation/complete');
    };

    const handleCancelClick = (e: React.MouseEvent) => {
        e.stopPropagation();

        // 입금대기 상태면 확인 다이얼로그 표시
        if (status === 'PENDING') {
            setCancelConfirmOpen(true);
        } else {
            // 예약 확정 상태면 환불 계좌 입력 필요
            setCancelSheetOpen(true);
        }
    };

    // 입금대기 상태 바로 취소
    const handleDirectCancel = async () => {
        setDirectCancelling(true);
        try {
            await updateReservationStatus(latestReservation.id, 'CANCELLED');
            toast.success('예약이 취소되었습니다');
            setCancelConfirmOpen(false);
            fetchMyReservations();
        } catch {
            toast.error('취소에 실패했습니다');
        } finally {
            setDirectCancelling(false);
        }
    };

    const handleCancelComplete = () => {
        setCancelSheetOpen(false);
        fetchMyReservations();
    };

    return (
        <div className="px-6 pb-6 mt-4">
            {/* Title with Link */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-text-1">다가오는 예약</h2>
                <button
                    onClick={() => router.push('/myspace/reservations')}
                    className="text-sm text-brand-1 font-medium hover:underline"
                >
                    전체 내역 →
                </button>
            </div>

            <div className="relative group cursor-pointer active:scale-[0.99] transition-transform duration-200" onClick={handleDetailClick}>
                {/* Glow Effect */}
                <div className={`absolute -inset-0.5 bg-gradient-to-r rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-500
                    ${status === 'PENDING' ? 'from-yellow-500 to-orange-500' :
                        status === 'CONFIRMED' ? 'from-brand-1 to-brand-2' :
                            'from-red-500 to-pink-500'}`}
                ></div>

                <div className="relative bg-white rounded-3xl overflow-hidden shadow-medium border border-surface-2">
                    {/* Header */}
                    <div className={`p-5 relative overflow-hidden transition-colors
                        ${status === 'PENDING' ? 'bg-yellow-500' :
                            status === 'CONFIRMED' ? 'bg-[#2F5233]' :
                                'bg-gray-600'}`}
                    >
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:16px_16px]"></div>

                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <span className="inline-flex items-center px-2.5 py-1 bg-white/20 rounded-full text-[10px] font-bold text-white backdrop-blur-sm border border-white/10">
                                {dDay}
                            </span>
                            <span className="flex items-center gap-1 text-xs font-medium text-white/90 tracking-wide">
                                {status === 'PENDING' && <><Clock size={12} /> 입금 대기</>}
                                {status === 'CONFIRMED' && <><CheckCircle2 size={12} /> 예약 확정</>}
                                {status === 'CANCELLED' && <><AlertCircle size={12} /> 취소됨</>}
                                {status === 'REFUND_PENDING' && <><Clock size={12} /> 환불 대기</>}
                                {status === 'REFUNDED' && <><CheckCircle2 size={12} /> 환불 완료</>}
                            </span>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-1 tracking-tight">
                            {SITES.find(s => s.id === siteId)?.name || siteId}
                        </h3>
                        <div className="flex items-center text-white/70 text-sm">
                            <MapPin size={14} className="mr-1" />
                            {siteId}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-5 bg-surface-1">
                        {status === 'PENDING' && (
                            <div className="mb-5 p-4 bg-yellow-50 rounded-2xl border border-yellow-100">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-yellow-800">입금 계좌 ({bankName})</span>
                                    <button onClick={handleCopyAccount} className="text-xs text-yellow-700 underline flex items-center gap-1 hover:text-yellow-900">
                                        {copied ? "복사완료!" : "계좌 복사"} <Copy size={10} />
                                    </button>
                                </div>
                                <p className="text-lg font-bold text-yellow-900 tracking-wider">{bankAccount}</p>
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-yellow-200/50">
                                    <span className="text-[10px] text-yellow-700">입금액</span>
                                    <span className="text-sm font-bold text-yellow-900">{totalPrice?.toLocaleString()}원</span>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-3 mb-5">
                            <div className="flex items-center gap-3 text-sm text-text-2">
                                <div className="p-2 bg-white rounded-full shadow-sm">
                                    <Calendar size={16} className="text-brand-2" />
                                </div>
                                <span className="font-medium">
                                    {format(checkIn, 'yyyy. MM. dd (eee)', { locale: ko })} - {format(checkOut, 'MM. dd (eee)', { locale: ko })}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-text-2">
                                <div className="p-2 bg-white rounded-full shadow-sm">
                                    <User size={16} className="text-brand-2" />
                                </div>
                                <span className="font-medium">
                                    가족 {familyCount}, 방문 {visitorCount}, 차량 {vehicleCount}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button className={`flex-1 py-3 text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-1 group/btn
                                ${status === 'PENDING' ? 'bg-yellow-500 hover:bg-yellow-600 shadow-yellow-500/20' :
                                    status === 'CONFIRMED' ? 'bg-brand-1 hover:bg-brand-2 shadow-brand-1/20' :
                                        'bg-gray-500 hover:bg-gray-600'}`}
                            >
                                {status === 'PENDING' ? '예약 확인하기' : '상세보기'}
                                <ChevronRight size={16} className="opacity-70 group-hover/btn:translate-x-1 transition-transform" />
                            </button>

                            {/* 취소 버튼 (PENDING 또는 CONFIRMED일 때만) */}
                            {(status === 'PENDING' || status === 'CONFIRMED') && (
                                <button
                                    onClick={handleCancelClick}
                                    disabled={directCancelling}
                                    className="py-3 px-4 text-red-600 bg-red-50 rounded-xl text-sm font-medium border border-red-100 hover:bg-red-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                                >
                                    {directCancelling ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <X size={16} />
                                    )}
                                    취소
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 취소 요청 바텀시트 (CONFIRMED일 때만 사용) */}
            <CancelReservationSheet
                open={cancelSheetOpen}
                onOpenChange={setCancelSheetOpen}
                reservation={latestReservation}
                onComplete={handleCancelComplete}
            />

            {/* 입금대기 취소 확인 다이얼로그 */}
            <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>예약을 취소하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>
                            아직 입금하지 않은 예약입니다. 취소하시면 예약이 즉시 취소됩니다.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>돌아가기</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDirectCancel}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={directCancelling}
                        >
                            {directCancelling ? '취소 중...' : '예약 취소'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useReservationStore } from "@/store/useReservationStore";
import { Reservation, ReservationStatus } from "@/types/reservation";
import { SITES } from "@/constants/sites";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, Calendar, MapPin, Clock, CheckCircle2, AlertCircle, XCircle, Loader2, RefreshCw, BanknoteIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import CancelReservationSheet from "@/components/reservation/CancelReservationSheet";

// 상태별 스타일 및 라벨
const STATUS_CONFIG: Record<ReservationStatus, { label: string; color: string; icon: React.ElementType; bgColor: string }> = {
    PENDING: { label: "입금 대기", color: "text-yellow-700", icon: Clock, bgColor: "bg-yellow-50 border-yellow-200" },
    CONFIRMED: { label: "예약 확정", color: "text-green-700", icon: CheckCircle2, bgColor: "bg-green-50 border-green-200" },
    REFUND_PENDING: { label: "환불 대기", color: "text-orange-700", icon: BanknoteIcon, bgColor: "bg-orange-50 border-orange-200" },
    REFUNDED: { label: "환불 완료", color: "text-blue-700", icon: CheckCircle2, bgColor: "bg-blue-50 border-blue-200" },
    CANCELLED: { label: "취소됨", color: "text-gray-500", icon: XCircle, bgColor: "bg-gray-50 border-gray-200" },
    COMPLETED: { label: "이용 완료", color: "text-brand-1", icon: CheckCircle2, bgColor: "bg-brand-1/10 border-brand-1/20" },
    "NO-SHOW": { label: "노쇼", color: "text-red-700", icon: AlertCircle, bgColor: "bg-red-50 border-red-200" },
};

export default function MyReservationsPage() {
    const router = useRouter();
    const { reservations, fetchMyReservations } = useReservationStore();
    const [loading, setLoading] = useState(true);
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    const [cancelSheetOpen, setCancelSheetOpen] = useState(false);

    const loadReservations = useCallback(async () => {
        setLoading(true);
        await fetchMyReservations();
        setLoading(false);
    }, [fetchMyReservations]);

    useEffect(() => {
        loadReservations();
    }, [loadReservations]);

    const handleCancelClick = (reservation: Reservation) => {
        setSelectedReservation(reservation);
        setCancelSheetOpen(true);
    };

    const handleCancelComplete = () => {
        setCancelSheetOpen(false);
        setSelectedReservation(null);
        loadReservations(); // 새로고침
    };

    return (
        <div className="min-h-screen bg-surface-1">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-surface-2 px-4 py-3 flex items-center gap-3">
                <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-lg font-bold">예약 내역</h1>
                <button onClick={loadReservations} className="ml-auto p-2 hover:bg-gray-100 rounded-full">
                    <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                </button>
            </header>

            {/* Content */}
            <div className="p-4 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-text-2">
                        <Loader2 size={32} className="animate-spin mb-3" />
                        <p>예약 내역을 불러오는 중...</p>
                    </div>
                ) : reservations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-text-2">
                        <Calendar size={48} className="mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">예약 내역이 없어요</p>
                        <p className="text-sm">첫 번째 캠핑을 예약해보세요!</p>
                        <button
                            onClick={() => router.push("/reservation")}
                            className="mt-6 px-6 py-3 bg-brand-1 text-white rounded-xl font-medium"
                        >
                            예약하러 가기
                        </button>
                    </div>
                ) : (
                    reservations.map((reservation) => {
                        const site = SITES.find((s) => s.id === reservation.siteId);
                        const config = STATUS_CONFIG[reservation.status];
                        const StatusIcon = config.icon;
                        const canCancel = reservation.status === "PENDING" || reservation.status === "CONFIRMED";

                        return (
                            <div
                                key={reservation.id}
                                className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${config.bgColor}`}
                            >
                                {/* 상태 헤더 */}
                                <div className="px-4 py-3 flex items-center justify-between border-b border-current/10">
                                    <div className={`flex items-center gap-2 ${config.color}`}>
                                        <StatusIcon size={16} />
                                        <span className="text-sm font-bold">{config.label}</span>
                                    </div>
                                    <span className="text-xs text-text-2">
                                        {format(new Date(reservation.createdAt), "yyyy.MM.dd HH:mm")}
                                    </span>
                                </div>

                                {/* 본문 */}
                                <div className="p-4">
                                    <h3 className="text-lg font-bold text-text-1 mb-3">
                                        {site?.name || reservation.siteId}
                                    </h3>

                                    <div className="space-y-2 text-sm text-text-2 mb-4">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} />
                                            <span>
                                                {format(new Date(reservation.checkInDate), "yyyy.MM.dd (eee)", { locale: ko })}
                                                {" ~ "}
                                                {format(new Date(reservation.checkOutDate), "MM.dd (eee)", { locale: ko })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin size={14} />
                                            <span>
                                                가족 {reservation.familyCount}, 방문객 {reservation.visitorCount}, 차량{" "}
                                                {reservation.vehicleCount}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 가격 */}
                                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                        <span className="text-sm text-text-2">결제 금액</span>
                                        <span className="text-lg font-bold text-text-1">
                                            {reservation.totalPrice.toLocaleString()}원
                                        </span>
                                    </div>

                                    {/* 환불 정보 (REFUND_PENDING 또는 REFUNDED) */}
                                    {(reservation.status === "REFUND_PENDING" || reservation.status === "REFUNDED") && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-text-2">환불 예정액</span>
                                                <span className={`font-bold ${reservation.status === "REFUNDED" ? "text-blue-600" : "text-orange-600"}`}>
                                                    {reservation.refundAmount?.toLocaleString()}원
                                                    <span className="text-xs font-normal ml-1">({reservation.refundRate}%)</span>
                                                </span>
                                            </div>
                                            <div className="text-xs text-text-2">
                                                환불 계좌: {reservation.refundBank} {reservation.refundAccount}
                                            </div>
                                            {reservation.cancelReason && (
                                                <div className="text-xs text-text-2">
                                                    취소 사유: {reservation.cancelReason}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 취소 버튼 */}
                                    {canCancel && (
                                        <button
                                            onClick={() => handleCancelClick(reservation)}
                                            className="mt-4 w-full py-3 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                                        >
                                            예약 취소 요청
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* 취소 요청 바텀시트 */}
            {selectedReservation && (
                <CancelReservationSheet
                    open={cancelSheetOpen}
                    onOpenChange={setCancelSheetOpen}
                    reservation={selectedReservation}
                    onComplete={handleCancelComplete}
                />
            )}
        </div>
    );
}

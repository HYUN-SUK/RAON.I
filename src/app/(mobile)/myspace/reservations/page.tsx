"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useReservationStore } from "@/store/useReservationStore";
import { Reservation, ReservationStatus } from "@/types/reservation";
import { SITES } from "@/constants/sites";
import { format, parseISO, differenceInDays } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, Calendar, MapPin, Clock, CheckCircle2, AlertCircle, XCircle, Loader2, RefreshCw, BanknoteIcon, Tent } from "lucide-react";
import { useRouter } from "next/navigation";
import CancelReservationSheet from "@/components/reservation/CancelReservationSheet";
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
import { toast } from "sonner";
import { Schedule, getMySchedules } from "@/actions/schedule";

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

// 통합 아이템 타입
type UnifiedItem =
    | { type: 'reservation'; data: Reservation; checkIn: Date }
    | { type: 'schedule'; data: Schedule; checkIn: Date };

export default function MyReservationsPage() {
    const router = useRouter();
    const { reservations, fetchMyReservations, updateReservationStatus } = useReservationStore();
    const [loading, setLoading] = useState(true);
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
    const [schedules, setSchedules] = useState<Schedule[]>([]);

    // 입금대기 취소용 상태
    const [pendingCancelReservation, setPendingCancelReservation] = useState<Reservation | null>(null);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [directCancelling, setDirectCancelling] = useState(false);

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            await fetchMyReservations();
            const schedulesData = await getMySchedules();
            setSchedules(schedulesData);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    }, [fetchMyReservations]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    // 통합 리스트: 예약 + 일정 시간순 정렬
    const unifiedList = useMemo(() => {
        const items: UnifiedItem[] = [];

        // 예약 추가
        reservations.forEach(r => {
            items.push({
                type: 'reservation',
                data: r,
                checkIn: new Date(r.checkInDate)
            });
        });

        // 일정 추가
        schedules.forEach(s => {
            items.push({
                type: 'schedule',
                data: s,
                checkIn: parseISO(s.check_in)
            });
        });

        // 체크인 날짜 기준 정렬 (최신순 = 가장 가까운 날짜가 위로)
        return items.sort((a, b) => b.checkIn.getTime() - a.checkIn.getTime());
    }, [reservations, schedules]);

    const handleCancelClick = (reservation: Reservation) => {
        if (reservation.status === 'PENDING') {
            setPendingCancelReservation(reservation);
            setConfirmDialogOpen(true);
        } else {
            setSelectedReservation(reservation);
            setCancelSheetOpen(true);
        }
    };

    const handleDirectCancel = async () => {
        if (!pendingCancelReservation) return;

        setDirectCancelling(true);
        try {
            await updateReservationStatus(pendingCancelReservation.id, 'CANCELLED');
            toast.success('예약이 취소되었습니다');
            setConfirmDialogOpen(false);
            setPendingCancelReservation(null);
            loadAll();
        } catch {
            toast.error('취소에 실패했습니다');
        } finally {
            setDirectCancelling(false);
        }
    };

    const handleCancelComplete = () => {
        setCancelSheetOpen(false);
        setSelectedReservation(null);
        loadAll();
    };

    // 예약 카드 렌더링
    const renderReservationCard = (reservation: Reservation) => {
        const site = SITES.find((s) => s.id === reservation.siteId);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkOut = new Date(reservation.checkOutDate);
        checkOut.setHours(0, 0, 0, 0);
        const isPast = checkOut <= today;

        const displayStatus = isPast && (reservation.status === 'PENDING' || reservation.status === 'CONFIRMED')
            ? 'COMPLETED' as const
            : reservation.status;

        const config = STATUS_CONFIG[displayStatus];
        const StatusIcon = config.icon;
        const canCancel = !isPast && (reservation.status === "PENDING" || reservation.status === "CONFIRMED");

        return (
            <div
                key={`reservation-${reservation.id}`}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${config.bgColor}`}
            >
                {/* 상태 헤더 */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-current/10">
                    <div className={`flex items-center gap-2 ${config.color}`}>
                        <StatusIcon size={16} />
                        <span className="text-sm font-bold">{config.label}</span>
                        <span className="ml-1 text-xs bg-brand-1/20 text-brand-1 px-1.5 py-0.5 rounded font-medium">라온아이</span>
                        {/* D-Day 배지: 예정된 예약에 표시 */}
                        {!isPast && (reservation.status === 'PENDING' || reservation.status === 'CONFIRMED') && (() => {
                            const checkInDate = new Date(reservation.checkInDate);
                            checkInDate.setHours(0, 0, 0, 0);
                            const daysUntil = differenceInDays(checkInDate, today);
                            const dDayText = daysUntil === 0 ? 'D-Day' : `D-${daysUntil}`;
                            return (
                                <span className="ml-auto text-xs font-bold bg-brand-1 text-white px-2 py-0.5 rounded-full">
                                    {dDayText}
                                </span>
                            );
                        })()}
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

                    {/* 환불 정보 */}
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
    };

    // 일정 카드 렌더링
    const renderScheduleCard = (schedule: Schedule) => {
        const checkIn = parseISO(schedule.check_in);
        const checkOut = parseISO(schedule.check_out);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isPast = checkOut <= today;
        const daysUntil = differenceInDays(checkIn, today);
        const nights = differenceInDays(checkOut, checkIn);

        const statusConfig = schedule.status === 'completed'
            ? { label: '완료', color: 'text-green-700', bg: 'bg-green-50 border-green-200' }
            : schedule.status === 'cancelled'
                ? { label: '취소', color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200' }
                : isPast
                    ? { label: '완료', color: 'text-green-700', bg: 'bg-green-50 border-green-200' }
                    : { label: daysUntil === 0 ? 'D-Day' : `D-${daysUntil}`, color: 'text-[#224732]', bg: 'bg-[#224732]/5 border-[#224732]/20' };

        return (
            <div
                key={`schedule-${schedule.id}`}
                onClick={() => router.push(`/myspace/schedule/${schedule.id}`)}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${statusConfig.bg}`}
            >
                {/* 상태 헤더 */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-current/10">
                    <div className={`flex items-center gap-2 ${statusConfig.color}`}>
                        <Tent size={16} />
                        <span className="text-sm font-bold">{statusConfig.label}</span>
                        <span className="ml-1 text-xs bg-[#224732]/20 text-[#224732] px-1.5 py-0.5 rounded font-medium">타캠핑장</span>
                    </div>
                    <span className="text-xs text-text-2">
                        {format(new Date(schedule.created_at), "yyyy.MM.dd")}
                    </span>
                </div>

                {/* 본문 */}
                <div className="p-4">
                    <h3 className="text-lg font-bold text-text-1 mb-3">
                        {schedule.campground_name}
                    </h3>

                    <div className="space-y-2 text-sm text-text-2 mb-4">
                        <div className="flex items-center gap-2">
                            <Calendar size={14} />
                            <span>
                                {format(checkIn, "yyyy.MM.dd (eee)", { locale: ko })}
                                {" ~ "}
                                {format(checkOut, "MM.dd (eee)", { locale: ko })}
                            </span>
                        </div>
                        {schedule.campground_address && (
                            <div className="flex items-center gap-2">
                                <MapPin size={14} />
                                <span className="truncate">{schedule.campground_address}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <Clock size={14} />
                            <span>{nights}박 {nights + 1}일</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-surface-1">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-surface-2">
                <div className="px-4 py-3 flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-lg font-bold">전체 내역</h1>
                    <button
                        onClick={loadAll}
                        className="ml-auto p-2 hover:bg-gray-100 rounded-full"
                    >
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="p-4 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-text-2">
                        <Loader2 size={32} className="animate-spin mb-3" />
                        <p>전체 내역을 불러오는 중...</p>
                    </div>
                ) : unifiedList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-text-2">
                        <Calendar size={48} className="mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">내역이 없어요</p>
                        <p className="text-sm">첫 번째 캠핑을 예약해보세요!</p>
                        <button
                            onClick={() => router.push("/reservation")}
                            className="mt-6 px-6 py-3 bg-brand-1 text-white rounded-xl font-medium"
                        >
                            예약하러 가기
                        </button>
                    </div>
                ) : (
                    unifiedList.map(item =>
                        item.type === 'reservation'
                            ? renderReservationCard(item.data)
                            : renderScheduleCard(item.data)
                    )
                )}
            </div>

            {/* 취소 요청 바텀시트 (CONFIRMED일 때만 사용) */}
            {selectedReservation && (
                <CancelReservationSheet
                    open={cancelSheetOpen}
                    onOpenChange={setCancelSheetOpen}
                    reservation={selectedReservation}
                    onComplete={handleCancelComplete}
                />
            )}

            {/* 입금대기 취소 확인 다이얼로그 */}
            <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
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

"use client";

import { Calendar, MapPin, User, ChevronRight, Clock, AlertCircle, CheckCircle2, Copy, X, Loader2, CreditCard, Plus, Tent } from "lucide-react";
import { useReservationStore } from "@/store/useReservationStore";
import { Reservation } from "@/types/reservation";
import { Schedule, getMySchedules } from "@/actions/schedule";
import { format, differenceInDays, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// 통합 일정 타입
type UnifiedUpcoming =
    | { type: 'reservation'; data: Reservation; checkIn: Date; checkOut: Date }
    | { type: 'schedule'; data: Schedule; checkIn: Date; checkOut: Date };

export default function UpcomingReservation() {
    const router = useRouter();
    const { reservations, fetchMyReservations, updateReservationStatus } = useReservationStore();
    const { config } = useSiteConfig();
    const [copied, setCopied] = useState(false);
    const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
    const [directCancelling, setDirectCancelling] = useState(false);
    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

    // 입금대기 상세 Sheet 상태
    const [pendingDetailOpen, setPendingDetailOpen] = useState(false);
    const [selectedPending, setSelectedPending] = useState<Reservation | null>(null);

    // 타캠핑장 일정 상태
    const [schedules, setSchedules] = useState<Schedule[]>([]);

    // 타캠핑장 일정 불러오기
    useEffect(() => {
        const loadSchedules = async () => {
            try {
                const data = await getMySchedules();
                setSchedules(data);
            } catch (error) {
                console.error('Failed to load schedules:', error);
            }
        };
        loadSchedules();
    }, []);

    // 오늘 기준
    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    // 활성 예약 필터링 (체크아웃이 오늘 이후)
    const activeReservations = useMemo(() => {
        return reservations.filter(r => {
            const checkOut = new Date(r.checkOutDate);
            checkOut.setHours(0, 0, 0, 0);
            if (checkOut <= today) return false;
            return r.status === 'PENDING' || r.status === 'CONFIRMED';
        });
    }, [reservations, today]);

    // 활성 일정 필터링 (체크아웃이 오늘 이후)
    const activeSchedules = useMemo(() => {
        return schedules.filter(s => {
            const checkOut = parseISO(s.check_out);
            checkOut.setHours(0, 0, 0, 0);
            return checkOut > today && s.status === 'scheduled';
        });
    }, [schedules, today]);

    // 통합 다가오는 일정: 예약 + 타캠핑장 일정 중 체크인이 가장 가까운 것
    const upcomingItem: UnifiedUpcoming | null = useMemo(() => {
        const items: UnifiedUpcoming[] = [];

        // 라온아이 예약 추가
        activeReservations.forEach(r => {
            items.push({
                type: 'reservation',
                data: r,
                checkIn: new Date(r.checkInDate),
                checkOut: new Date(r.checkOutDate)
            });
        });

        // 타캠핑장 일정 추가
        activeSchedules.forEach(s => {
            items.push({
                type: 'schedule',
                data: s,
                checkIn: parseISO(s.check_in),
                checkOut: parseISO(s.check_out)
            });
        });

        // 체크인 날짜 기준 정렬 후 가장 가까운 것 선택
        items.sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());
        return items[0] || null;
    }, [activeReservations, activeSchedules]);

    // 스마트플랜 사용 가능 여부 판별 (예약 생성 다음날 오전 9시 이후 활성화)
    const isSmartPlanAvailable = useMemo(() => {
        if (!upcomingItem) return false;
        
        let createdAt: Date;
        let hasSmartPlan = false;
        
        if (upcomingItem.type === 'reservation') {
            const reservation = upcomingItem.data;
            if (reservation.status !== 'CONFIRMED') return false; // 확정된 예약만 가능
            createdAt = new Date(reservation.createdAt);
        } else {
            const schedule = upcomingItem.data;
            if (schedule.status !== 'scheduled') return false;
            createdAt = new Date(schedule.created_at);
            hasSmartPlan = !!schedule.smart_plan_data; // 이미 생성 완료된 경우는 제외
        }
        
        if (isNaN(createdAt.getTime()) || hasSmartPlan) return false;
        
        const unlockTimeByCreation = new Date(createdAt);
        unlockTimeByCreation.setDate(unlockTimeByCreation.getDate() + 1);
        unlockTimeByCreation.setHours(9, 0, 0, 0);

        return new Date() >= unlockTimeByCreation;
    }, [upcomingItem]);

    // 뱃지 텍스트 결정 (예약 다음 날 ~ D-8: 여행계획 세우기 가능 / D-7 ~ D-0: 최종 날씨 반영 계획 완성)
    const badgeText = useMemo(() => {
        if (!upcomingItem || !isSmartPlanAvailable) return '';
        
        let checkIn: Date;
        if (upcomingItem.type === 'reservation') {
            checkIn = new Date(upcomingItem.data.checkInDate);
        } else {
            checkIn = new Date(upcomingItem.data.check_in);
        }
        
        if (isNaN(checkIn.getTime())) return '✨ 여행계획 세우기 가능';
        
        checkIn.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.round((checkIn.getTime() - today.getTime()) / 86400000);
        
        if (daysDiff <= 7) {
            return '✨ 최종 날씨 반영 계획 완성';
        } else {
            return '✨ 여행계획 세우기 가능';
        }
    }, [upcomingItem, isSmartPlanAvailable]);

    // 메인 예약: 라온아이 예약 중 체크인이 가장 가까운 것 (입금대기 카드용)
    const mainReservation = useMemo(() => {
        if (activeReservations.length === 0) return null;
        return [...activeReservations].sort((a, b) =>
            new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
        )[0];
    }, [activeReservations]);

    // 입금대기 리스트: 메인 카드가 라온아이 PENDING인 경우만 해당 예약 제외, 그 외에는 모든 PENDING 표시
    const pendingList = useMemo(() => {
        const isMainPending = upcomingItem?.type === 'reservation' && upcomingItem.data.status === 'PENDING';
        return activeReservations
            .filter(r => r.status === 'PENDING' && !(isMainPending && r.id === upcomingItem?.data.id))
            .sort((a, b) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime());
    }, [activeReservations, upcomingItem]);

    // 입금 계좌 정보
    const bankName = config?.bank_name || '카카오뱅크';
    const bankAccount = config?.bank_account || '3333-00-0000000';

    const handleCopyAccount = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(bankAccount);
        setCopied(true);
        toast.success('계좌번호가 복사되었습니다');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDetailClick = async () => {
        if (!mainReservation) return;

        // PENDING 상태면 예약 페이지로
        if (mainReservation.status === 'PENDING') {
            router.push('/reservation/complete');
            return;
        }

        // CONFIRMED 상태 등은 일정 페이지로 (Lazy Creation)
        try {
            const { ensureScheduleFromReservation } = await import('@/actions/schedule');

            // 로딩 표시 (Toast 사용, 또는 UI state 추가 권장)
            toast.loading('일정 정보를 불러오는 중...');

            const result = await ensureScheduleFromReservation(mainReservation.id);
            toast.dismiss();

            if (result.success && result.scheduleId) {
                router.push(`/myspace/schedule/${result.scheduleId}`);
            } else {
                console.error('Failed to ensure schedule:', result.error);
                router.push('/reservation/complete');
            }
        } catch (e) {
            console.error('Navigation error:', e);
            toast.dismiss();
            router.push('/reservation/complete');
        }
    };

    const handleCancelClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!mainReservation) return;

        if (mainReservation.status === 'PENDING') {
            setCancelConfirmOpen(true);
        } else {
            setCancelSheetOpen(true);
        }
    };

    // 입금대기 바로 취소
    const handleDirectCancel = async (reservationId?: string) => {
        const targetId = reservationId || mainReservation?.id;
        if (!targetId) return;

        setDirectCancelling(true);
        try {
            await updateReservationStatus(targetId, 'CANCELLED');
            toast.success('예약이 취소되었습니다');
            setCancelConfirmOpen(false);
            setPendingDetailOpen(false);
            setSelectedPending(null);
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

    // 입금대기 상세 열기
    const handlePendingClick = (reservation: Reservation) => {
        setSelectedPending(reservation);
        setPendingDetailOpen(true);
    };

    if (!upcomingItem) {
        return (
            <div className="px-6 pb-6 mt-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-text-1">다가오는 일정</h2>
                    <button
                        onClick={() => router.push('/myspace/reservations')}
                        className="text-sm text-brand-1 font-medium hover:underline"
                    >
                        전체 내역 →
                    </button>
                </div>
                <div
                    onClick={() => router.push('/reservation')}
                    className="bg-white rounded-3xl p-6 shadow-sm border border-surface-2 flex flex-col items-center justify-center gap-3 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                >
                    <div className="p-3 bg-brand-1/10 rounded-full text-brand-1">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-text-1">다가오는 일정이 없어요</h3>
                        <p className="text-sm text-text-2">새로운 캠핑을 떠나보세요!</p>
                    </div>
                </div>

                {/* 타캠핑장 일정 추가 버튼 */}
                <button
                    onClick={() => router.push('/myspace/schedule?add=external')}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-dashed border-brand-1/30 rounded-xl text-brand-1 hover:bg-brand-1/5 transition-all"
                >
                    <Plus size={16} />
                    <span className="text-sm font-medium">타캠핑장 일정 추가</span>
                </button>
            </div>
        );
    }

    // 통합 일정 기반 D-day 계산
    const checkInDay = new Date(upcomingItem.checkIn);
    checkInDay.setHours(0, 0, 0, 0);
    const diffDays = differenceInDays(checkInDay, today);
    const dDay = diffDays === 0 ? "D-Day" : diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`;

    return (
        <div className="px-6 pb-6 mt-4">
            {/* Title with Link */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-text-1">다가오는 일정</h2>
                <button
                    onClick={() => router.push('/myspace/reservations')}
                    className="text-sm text-brand-1 font-medium hover:underline"
                >
                    전체 내역 →
                </button>
            </div>

            {/* 통합 메인 카드 - 타입에 따라 다른 UI */}
            {upcomingItem.type === 'reservation' ? (
                // 라온아이 예약 카드
                (() => {
                    const reservation = upcomingItem.data;
                    const { status, siteId, familyCount, visitorCount, vehicleCount, totalPrice } = reservation;
                    return (
                        <div className="relative group cursor-pointer active:scale-[0.99] transition-transform duration-200" onClick={handleDetailClick}>
                            <div className={`absolute -inset-0.5 bg-gradient-to-r rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-500
                                ${status === 'PENDING' ? 'from-yellow-500 to-orange-500' :
                                    status === 'CONFIRMED' ? 'from-brand-1 to-brand-2' :
                                        'from-red-500 to-pink-500'}`}
                            ></div>

                            <div className="relative bg-white rounded-3xl overflow-hidden shadow-medium border border-surface-2">
                                <div className={`p-5 relative overflow-hidden transition-colors
                                    ${status === 'PENDING' ? 'bg-yellow-500' :
                                        status === 'CONFIRMED' ? 'bg-[#2F5233]' :
                                            'bg-gray-600'}`}
                                >
                                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:16px_16px]"></div>

                                    <div className="flex justify-between items-start mb-3 relative z-10">
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center px-2.5 py-1 bg-white/20 rounded-full text-[10px] font-bold text-white backdrop-blur-sm border border-white/10">
                                                {dDay}
                                            </span>
                                            <span className="inline-flex items-center px-2 py-0.5 bg-brand-1/30 rounded text-[9px] font-bold text-white">
                                                라온아이
                                            </span>
                                        </div>
                                        <span className="flex items-center gap-1 text-xs font-medium text-white/90 tracking-wide">
                                            {status === 'PENDING' && <><Clock size={12} /> 입금 대기</>}
                                            {status === 'CONFIRMED' && <><CheckCircle2 size={12} /> 예약 확정</>}
                                            {status === 'CANCELLED' && <><AlertCircle size={12} /> 취소됨</>}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 mb-1 min-w-0">
                                        <h3 className="text-xl font-bold text-white tracking-tight truncate">
                                            {SITES.find(s => s.id === siteId)?.name || siteId}
                                        </h3>
                                        {isSmartPlanAvailable && (
                                            <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full text-[15px] font-black gold-glow-badge shadow-md transition-all duration-300 animate-pulse">
                                                {badgeText}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center text-white/70 text-sm">
                                        <MapPin size={14} className="mr-1" />
                                        {siteId}
                                    </div>
                                </div>

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
                                                {format(upcomingItem.checkIn, 'yyyy. MM. dd (eee)', { locale: ko })} - {format(upcomingItem.checkOut, 'MM. dd (eee)', { locale: ko })}
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
                    );
                })()
            ) : (
                // 타캠핑장 일정 카드
                (() => {
                    const schedule = upcomingItem.data;
                    const nights = differenceInDays(upcomingItem.checkOut, upcomingItem.checkIn);
                    return (
                        <div
                            className="relative group cursor-pointer active:scale-[0.99] transition-transform duration-200"
                            onClick={() => router.push(`/myspace/schedule/${schedule.id}`)}
                        >
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#224732] to-[#3a6b4a] rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>

                            <div className="relative bg-white rounded-3xl overflow-hidden shadow-medium border border-surface-2">
                                <div className="p-5 relative overflow-hidden transition-colors bg-[#224732]">
                                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:16px_16px]"></div>

                                    <div className="flex justify-between items-start mb-3 relative z-10">
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center px-2.5 py-1 bg-white/20 rounded-full text-[10px] font-bold text-white backdrop-blur-sm border border-white/10">
                                                {dDay}
                                            </span>
                                            <span className="inline-flex items-center px-2 py-0.5 bg-white/20 rounded text-[9px] font-bold text-white">
                                                타캠핑장
                                            </span>
                                        </div>
                                        <span className="flex items-center gap-1 text-xs font-medium text-white/90 tracking-wide">
                                            <Tent size={12} /> 예정된 일정
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 mb-1 min-w-0">
                                        <h3 className="text-xl font-bold text-white tracking-tight truncate">
                                            {schedule.campground_name}
                                        </h3>
                                        {isSmartPlanAvailable && (
                                            <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full text-[15px] font-black gold-glow-badge shadow-md transition-all duration-300 animate-pulse">
                                                {badgeText}
                                            </span>
                                        )}
                                    </div>
                                    {schedule.campground_address && (
                                        <div className="flex items-center text-white/70 text-sm">
                                            <MapPin size={14} className="mr-1" />
                                            {schedule.campground_address}
                                        </div>
                                    )}
                                </div>

                                <div className="p-5 bg-surface-1">
                                    <div className="flex flex-col gap-3 mb-5">
                                        <div className="flex items-center gap-3 text-sm text-text-2">
                                            <div className="p-2 bg-white rounded-full shadow-sm">
                                                <Calendar size={16} className="text-[#224732]" />
                                            </div>
                                            <span className="font-medium">
                                                {format(upcomingItem.checkIn, 'yyyy. MM. dd (eee)', { locale: ko })} - {format(upcomingItem.checkOut, 'MM. dd (eee)', { locale: ko })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-text-2">
                                            <div className="p-2 bg-white rounded-full shadow-sm">
                                                <Clock size={16} className="text-[#224732]" />
                                            </div>
                                            <span className="font-medium">
                                                {nights}박 {nights + 1}일
                                            </span>
                                        </div>
                                    </div>

                                    <button className="w-full py-3 text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-1 group/btn bg-[#224732] hover:bg-[#1a3626] shadow-[#224732]/20">
                                        상세보기
                                        <ChevronRight size={16} className="opacity-70 group-hover/btn:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()
            )}

            {/* 타캠핑장 일정 추가 버튼 */}
            <button
                onClick={() => router.push('/myspace/schedule?add=external')}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-dashed border-brand-1/30 rounded-xl text-brand-1 hover:bg-brand-1/5 transition-all"
            >
                <Plus size={16} />
                <span className="text-sm font-medium">타캠핑장 일정 추가</span>
            </button>

            {/* 입금 대기 리스트 */}
            {pendingList.length > 0 && (
                <div className="mt-4 bg-yellow-50 rounded-2xl border border-yellow-200 overflow-hidden">
                    <div className="px-4 py-3 bg-yellow-100/50 flex items-center gap-2">
                        <CreditCard size={16} className="text-yellow-700" />
                        <span className="text-sm font-bold text-yellow-800">입금 대기 중 ({pendingList.length}건)</span>
                    </div>
                    <div className="divide-y divide-yellow-200">
                        {pendingList.map((reservation) => {
                            const site = SITES.find(s => s.id === reservation.siteId);
                            const pCheckIn = new Date(reservation.checkInDate);
                            return (
                                <button
                                    key={reservation.id}
                                    onClick={() => handlePendingClick(reservation)}
                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-yellow-100/50 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-yellow-200 flex items-center justify-center">
                                            <Clock size={14} className="text-yellow-700" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-yellow-900">{site?.name || reservation.siteId}</p>
                                            <p className="text-xs text-yellow-700">{format(pCheckIn, 'MM.dd (eee)', { locale: ko })}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-yellow-900">{reservation.totalPrice?.toLocaleString()}원</p>
                                        <ChevronRight size={14} className="text-yellow-600 ml-auto" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 입금대기 상세 Sheet */}
            <Sheet open={pendingDetailOpen} onOpenChange={setPendingDetailOpen}>
                <SheetContent side="bottom" className="rounded-t-3xl">
                    <SheetHeader className="pb-4 border-b border-gray-100">
                        <SheetTitle className="flex items-center gap-2">
                            <Clock className="text-yellow-500" size={20} />
                            입금 대기 예약
                        </SheetTitle>
                    </SheetHeader>

                    {selectedPending && (
                        <div className="py-5 space-y-4">
                            {/* 예약 정보 */}
                            <div className="bg-gray-50 rounded-xl p-4">
                                <h3 className="font-bold text-text-1 mb-2">
                                    {SITES.find(s => s.id === selectedPending.siteId)?.name || selectedPending.siteId}
                                </h3>
                                <div className="text-sm text-text-2 space-y-1">
                                    <p>{format(new Date(selectedPending.checkInDate), 'yyyy.MM.dd (eee)', { locale: ko })} ~ {format(new Date(selectedPending.checkOutDate), 'MM.dd (eee)', { locale: ko })}</p>
                                    <p>가족 {selectedPending.familyCount}, 방문객 {selectedPending.visitorCount}, 차량 {selectedPending.vehicleCount}</p>
                                </div>
                            </div>

                            {/* 입금 정보 */}
                            <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-yellow-800">입금 계좌 ({bankName})</span>
                                    <button
                                        onClick={handleCopyAccount}
                                        className="text-xs text-yellow-700 underline flex items-center gap-1"
                                    >
                                        {copied ? "복사완료!" : "계좌 복사"} <Copy size={10} />
                                    </button>
                                </div>
                                <p className="text-lg font-bold text-yellow-900 tracking-wider">{bankAccount}</p>
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-yellow-200">
                                    <span className="text-sm text-yellow-700">입금액</span>
                                    <span className="text-lg font-bold text-yellow-900">{selectedPending.totalPrice?.toLocaleString()}원</span>
                                </div>
                            </div>

                            {/* 버튼 */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => {
                                        setPendingDetailOpen(false);
                                        router.push('/reservation/complete');
                                    }}
                                    className="flex-1 py-4 bg-yellow-500 text-white rounded-xl font-bold hover:bg-yellow-600 transition-colors"
                                >
                                    상세보기
                                </button>
                                <button
                                    onClick={() => handleDirectCancel(selectedPending.id)}
                                    disabled={directCancelling}
                                    className="py-4 px-6 text-red-600 bg-red-50 rounded-xl font-medium border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                                >
                                    {directCancelling ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <X size={16} />
                                    )}
                                    취소
                                </button>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {/* 취소 요청 바텀시트 (CONFIRMED일 때만 사용) */}
            {mainReservation && (
                <CancelReservationSheet
                    open={cancelSheetOpen}
                    onOpenChange={setCancelSheetOpen}
                    reservation={mainReservation}
                    onComplete={handleCancelComplete}
                />
            )}

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
                            onClick={() => handleDirectCancel()}
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


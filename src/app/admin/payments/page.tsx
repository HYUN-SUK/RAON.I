'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';

import { useReservationStore } from '@/store/useReservationStore';
import { Reservation, ReservationStatus } from '@/types/reservation';
import { 
    CreditCard, 
    Banknote, 
    Clock, 
    Search, 
    RotateCcw, 
    ChevronLeft, 
    ChevronRight, 
    CheckCircle2, 
    AlertCircle, 
    X,
    Loader2
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminReservationDetailModal from '@/components/admin/AdminReservationDetailModal';

type FilterTabType = 'ALL' | 'PENDING' | 'CONFIRMED' | 'REFUND_PENDING' | 'REFUNDED' | 'CANCELLED';
type PeriodQuickType = 'today' | 'yesterday' | '1week' | '1month' | '3month' | '6month' | '1year' | 'all';

export interface PaymentListItem {
    id: string; // reservation.id or `${reservation.id}-partial`
    reservationId: string;
    isPartialRefund?: boolean;
    type: 'PAYMENT' | 'REFUND' | 'PARTIAL_REFUND' | 'CANCEL';
    status: ReservationStatus;
    guestName: string;
    guestPhone: string;
    siteId: string;
    checkInDate: Date;
    checkOutDate: Date;
    amount: number; // positive or negative
    refundBank?: string;
    refundAccount?: string;
    refundHolder?: string;
    createdAt: Date;
    updatedAt?: Date;
    refundedAt?: Date;
    raw: Reservation;
}

export default function AdminPaymentsPage() {
    const { reservations, sites, fetchAllReservations, updateReservationStatus, completeRefund, completePartialRefund } = useReservationStore();

    // 1. Filter States
    const [activeTab, setActiveTab] = useState<FilterTabType>('ALL');
    const [searchType, setSearchType] = useState<'guestName' | 'guestPhone' | 'siteId'>('guestName');
    const [searchQuery, setSearchQuery] = useState('');
    const [periodQuick, setPeriodQuick] = useState<PeriodQuickType>('3month');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // 2. Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // 3. Modal State
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // 4. Processing States (Double-click prevention)
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    // 5. 실시간 세션 작업 보존 (관리자가 방금 처리한 건이 아래로 날아가지 않고 상단 그 위치에 고정 유지되도록 보장)
    const [sessionProcessed, setSessionProcessed] = useState<Record<string, { type: 'REFUND' | 'CONFIRM'; timestamp: number }>>({});

    // 6. Loading State (Prevents flicker of 0건 before data arrives)
    const [isLoading, setIsLoading] = useState(true);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            await fetchAllReservations();
        } finally {
            setIsLoading(false);
        }
    }, [fetchAllReservations]);

    useEffect(() => {
        loadData();
        applyQuickPeriod('3month');
    }, [loadData]);

    const applyQuickPeriod = (p: PeriodQuickType) => {
        setPeriodQuick(p);
        const now = new Date();
        let start: Date;
        let end = now;

        if (p === 'today') {
            start = startOfDay(now);
        } else if (p === 'yesterday') {
            start = startOfDay(subDays(now, 1));
            end = endOfDay(subDays(now, 1));
        } else if (p === '1week') {
            start = subDays(now, 7);
        } else if (p === '1month') {
            start = subDays(now, 30);
        } else if (p === '3month') {
            start = subDays(now, 90);
        } else if (p === '6month') {
            start = subDays(now, 180);
        } else if (p === '1year') {
            start = subDays(now, 365);
        } else {
            start = new Date(2025, 0, 1);
        }

        setStartDate(format(start, 'yyyy-MM-dd'));
        setEndDate(format(end, 'yyyy-MM-dd'));
        setCurrentPage(1);
    };

    // ★ 본 예약과 예약 수정으로 발생한 '일부 환불(차액)' 항목을 완벽 분리하여 전체 결제 항목 생성
    const allPaymentItems = useMemo<PaymentListItem[]>(() => {
        const items: PaymentListItem[] = [];

        reservations.forEach(r => {
            const isFullRefund = r.status === 'REFUND_PENDING' || r.status === 'REFUNDED';
            const isCancelled = r.status === 'CANCELLED';

            // 1. 본 예약 항목 (예약 유지 및 결제액 표시)
            items.push({
                id: r.id,
                reservationId: r.id,
                isPartialRefund: false,
                type: isFullRefund ? 'REFUND' : isCancelled ? 'CANCEL' : 'PAYMENT',
                status: r.status,
                guestName: r.guestName || '',
                guestPhone: r.guestPhone || '',
                siteId: r.siteId,
                checkInDate: r.checkInDate,
                checkOutDate: r.checkOutDate,
                amount: isFullRefund ? -(r.refundAmount ?? r.totalPrice) : r.totalPrice,
                refundBank: r.refundBank,
                refundAccount: r.refundAccount,
                refundHolder: r.refundHolder,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
                refundedAt: r.refundedAt,
                raw: r
            });

            // 2. 예약 수정으로 발생한 '일부 환불(차액 환불)' 독립 항목
            // 본 예약이 CONFIRMED이고 refundAmount가 설정되어 있는 경우 별도 분리 노출!
            if (r.status === 'CONFIRMED' && (r.refundAmount ?? 0) > 0) {
                const isRefundDone = !!r.refundedAt;
                items.push({
                    id: `${r.id}-partial`,
                    reservationId: r.id,
                    isPartialRefund: true,
                    type: 'PARTIAL_REFUND',
                    status: isRefundDone ? 'REFUNDED' : 'REFUND_PENDING',
                    guestName: r.guestName || '',
                    guestPhone: r.guestPhone || '',
                    siteId: r.siteId,
                    checkInDate: r.checkInDate,
                    checkOutDate: r.checkOutDate,
                    amount: -(r.refundAmount!),
                    refundBank: r.refundBank,
                    refundAccount: r.refundAccount,
                    refundHolder: r.refundHolder,
                    createdAt: r.updatedAt || r.createdAt,
                    updatedAt: r.updatedAt,
                    refundedAt: r.refundedAt,
                    raw: r
                });
            }
        });

        return items;
    }, [reservations]);

    // 상단 3종 요약 데이터 계산
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayPaidList = allPaymentItems.filter(i => {
        if (i.type !== 'PAYMENT' || i.status !== 'CONFIRMED') return false;
        const cDate = i.createdAt ? format(new Date(i.createdAt), 'yyyy-MM-dd') : '';
        const uDate = i.updatedAt ? format(new Date(i.updatedAt), 'yyyy-MM-dd') : '';
        return cDate === todayStr || uDate === todayStr;
    });
    const todayPaidCount = todayPaidList.length;
    const todayPaidAmount = todayPaidList.reduce((sum, i) => sum + i.amount, 0);

    const refundPendingList = allPaymentItems.filter(i => i.status === 'REFUND_PENDING');
    const refundPendingCount = refundPendingList.length;
    const refundPendingAmount = refundPendingList.reduce((sum, i) => sum + Math.abs(i.amount), 0);

    const paymentPendingList = allPaymentItems.filter(i => i.status === 'PENDING');
    const paymentPendingCount = paymentPendingList.length;
    const paymentPendingAmount = paymentPendingList.reduce((sum, i) => sum + i.amount, 0);

    // 필터링 및 최신순 정렬
    const filteredPaymentItems = useMemo(() => {
        return allPaymentItems
            .filter(item => {
                // 1) 탭 필터
                if (activeTab === 'PENDING' && item.status !== 'PENDING') return false;
                if (activeTab === 'CONFIRMED' && (item.status !== 'CONFIRMED' || item.isPartialRefund)) return false;
                if (activeTab === 'REFUND_PENDING' && item.status !== 'REFUND_PENDING') return false;
                if (activeTab === 'REFUNDED' && item.status !== 'REFUNDED') return false;
                if (activeTab === 'CANCELLED' && item.status !== 'CANCELLED') return false;

                // 2) 기간 필터
                if (startDate && endDate) {
                    const rDate = item.createdAt ? new Date(item.createdAt) : null;
                    if (rDate) {
                        const s = startOfDay(new Date(startDate));
                        const e = endOfDay(new Date(endDate));
                        if (rDate < s || rDate > e) return false;
                    }
                }

                // 3) 검색어 필터
                if (searchQuery.trim()) {
                    const q = searchQuery.trim().toLowerCase();
                    if (searchType === 'guestName' && !item.guestName.toLowerCase().includes(q)) return false;
                    if (searchType === 'guestPhone' && !item.guestPhone.includes(q)) return false;
                    if (searchType === 'siteId' && !item.siteId.toLowerCase().includes(q)) return false;
                }

                return true;
            })
            // ★ 스마트 이벤트 타임라인 정렬:
            // 1단계: 미처리 환불대기(REFUND_PENDING - 전체 취소 및 일부 차액 환불)는 관리자 긴급 조치 대상이므로 최상단 우선 노출
            // 2단계: 나머지 모든 항목(환불완료, 결제대기, 결제완료)은 유효 기준 시각(effectiveTime) 최신순 정렬!
            //   - 환불완료(REFUNDED): '환불 완료 처리 시각(refundedAt)' 기준!
            //     -> 과거 최초 예약일(createdAt)로 튕겨 날아가지 않고, 방금 완료한 그 자리에 머묾!
            //     -> 이후 새로운 예약이 들어오면(새 예약의 createdAt이 환불 시각보다 최신이므로) 새 예약이 위로 오고,
            //        환불완료 건은 다른 결제목록들과 마찬가지로 차례대로 한 줄씩 아래로 내려감!
            //     -> 과거 8월 옛날 환불완료 건은 8월 완료 시각이므로 저 아래 8월 타임라인에 머묾!
            //   - 일반 결제 건(PENDING, CONFIRMED): 오직 '예약 신청일시(createdAt)' 기준!
            //     -> 결제대기가 상단으로 붕 뜨지 않고 제 시간대에 위치!
            //     -> [입금확인]을 눌러도 createdAt은 변하지 않으므로 행 위치가 절대 흔들리지 않고 그 자리 유지!
            //     -> 새로운 예약이 들어오면 createdAt이 가장 최신이므로 타임라인 상단에 최신순으로 적재!
            .sort((a, b) => {
                // 1단계: 미처리 환불대기 우선 (전체 환불대기 및 일부 환불대기)
                const aIsRefundPending = a.status === 'REFUND_PENDING';
                const bIsRefundPending = b.status === 'REFUND_PENDING';

                if (aIsRefundPending && !bIsRefundPending) return -1;
                if (!aIsRefundPending && bIsRefundPending) return 1;

                // 둘 다 환불대기인 경우: 환불 요청 시각(updatedAt or createdAt) 최신순
                if (aIsRefundPending && bIsRefundPending) {
                    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : new Date(a.createdAt).getTime();
                    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : new Date(b.createdAt).getTime();
                    return timeB - timeA;
                }

                // 2단계: 유효 기준 시각(effectiveTime) 계산
                const getEffectiveTime = (item: PaymentListItem) => {
                    // 환불 완료 건: 환불 처리 시각 기준!
                    if (item.status === 'REFUNDED') {
                        if (sessionProcessed[item.id]?.timestamp) return sessionProcessed[item.id]!.timestamp;
                        if (item.refundedAt) return new Date(item.refundedAt).getTime();
                        if (item.updatedAt) return new Date(item.updatedAt).getTime();
                    }
                    // 일반 예약 결제 건 (PENDING, CONFIRMED, CANCELLED):
                    // [입금확인]을 눌러도 제자리 유지를 위해 항상 createdAt 기준!
                    return item.createdAt ? new Date(item.createdAt).getTime() : 0;
                };

                const timeA = getEffectiveTime(a);
                const timeB = getEffectiveTime(b);
                return timeB - timeA;
            });
    }, [allPaymentItems, activeTab, startDate, endDate, searchQuery, searchType, sessionProcessed]);

    // 페이지네이션 슬라이싱
    const totalCount = filteredPaymentItems.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const paginatedList = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredPaymentItems.slice(start, start + pageSize);
    }, [filteredPaymentItems, currentPage, pageSize]);

    const handleRowClick = (r: Reservation) => {
        setSelectedReservation(r);
        setIsDetailOpen(true);
    };

    const handleQuickConfirm = async (e: React.MouseEvent, r: Reservation) => {
        e.stopPropagation();
        if (confirmingId) return;
        setConfirmingId(r.id);
        try {
            await updateReservationStatus(r.id, 'CONFIRMED');
            setSessionProcessed(prev => ({
                ...prev,
                [r.id]: { type: 'CONFIRM', timestamp: Date.now() }
            }));
            toast.success(`${r.guestName}님의 입금이 확인되어 예약이 확정되었습니다.`);
        } catch (err: any) {
            toast.error(err?.message || '확정 처리에 실패했습니다.');
        } finally {
            setConfirmingId(null);
        }
    };

    const handleQuickRefund = async (e: React.MouseEvent, r: Reservation) => {
        e.stopPropagation();
        const refundAmt = (r.refundAmount ?? r.totalPrice).toLocaleString();
        const holderName = r.refundHolder || r.guestName || '예약자';
        const bankName = r.refundBank || '계좌';

        const isConfirmed = window.confirm(
            `[전체 환불 완료 확인]\n\n• 대상: ${holderName} 님\n• 환불 계좌: ${bankName} ${r.refundAccount || ''}\n• 환불 금액: ${refundAmt}원\n\n위 계좌로 송금을 완료하셨습니까? 환불 완료로 상태를 변경합니다.`
        );
        if (!isConfirmed) return;

        setConfirmingId(r.id);
        try {
            const res = await completeRefund(r.id);
            if (res.success) {
                setSessionProcessed(prev => ({
                    ...prev,
                    [r.id]: { type: 'REFUND', timestamp: Date.now() }
                }));
                toast.success(`${holderName}님의 환불이 완료 처리되었습니다.`);
            } else {
                toast.error(res.message || '환불 처리에 실패했습니다.');
            }
        } catch (err: any) {
            toast.error(err?.message || '환불 처리 중 오류가 발생했습니다.');
        } finally {
            setConfirmingId(null);
        }
    };

    const handleQuickPartialRefund = async (e: React.MouseEvent, item: PaymentListItem) => {
        e.stopPropagation();
        const r = item.raw;
        const refundAmt = (r.refundAmount ?? Math.abs(item.amount)).toLocaleString();
        const holderName = r.refundHolder || r.guestName || '예약자';
        const bankName = r.refundBank || '계좌';

        const isConfirmed = window.confirm(
            `[일부 환불(차액) 완료 확인]\n\n• 대상: ${holderName} 님\n• 환불 계좌: ${bankName} ${r.refundAccount || ''}\n• 환불 차액: ${refundAmt}원\n\n위 계좌로 차액 송금을 완료하셨습니까?\n일부 환불 완료로 처리합니다 (기존 본 예약은 100% 유지됩니다).`
        );
        if (!isConfirmed) return;

        setConfirmingId(item.id);
        try {
            const res = await completePartialRefund(r.id);
            if (res.success) {
                setSessionProcessed(prev => ({
                    ...prev,
                    [item.id]: { type: 'REFUND', timestamp: Date.now() }
                }));
                toast.success(`${holderName}님의 일부 환불(${refundAmt}원)이 완료 처리되었습니다. (본 예약 정상 유지)`);
            } else {
                toast.error(res.error || '일부 환불 처리에 실패했습니다.');
            }
        } catch (err: any) {
            toast.error(err?.message || '일부 환불 처리 중 오류가 발생했습니다.');
        } finally {
            setConfirmingId(null);
        }
    };

    return (
        <div className="space-y-6 pb-20 max-w-7xl mx-auto">
            {/* 1. Header Navigation */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-400">결제 관리</span>
                        <span className="text-xs text-stone-300">/</span>
                        <h1 className="text-xl font-bold text-stone-900">결제 목록</h1>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">
                        실시간 입금 확인, 결제 및 환불 내역을 고밀도로 관제하고 관리합니다.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={isLoading}
                        onClick={() => loadData()} 
                        className="rounded-xl text-xs bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                    >
                        <RotateCcw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} /> 새로고침
                    </Button>
                </div>
            </div>

            {/* 2. 캠핏 스타일 상단 3종 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. 오늘 결제 */}
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs flex items-center justify-between relative overflow-hidden">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-stone-500 block">오늘 결제</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl font-black text-stone-900">{isLoading ? '-' : todayPaidCount}</span>
                            <span className="text-xs font-bold text-stone-400">건</span>
                        </div>
                        <p className="text-xs font-extrabold text-blue-600">
                            {isLoading ? '-' : `${todayPaidAmount.toLocaleString()}원`}
                        </p>
                    </div>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                        <CreditCard className="w-6 h-6" />
                    </div>
                </div>

                {/* 2. 환불 대기 */}
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs flex items-center justify-between relative overflow-hidden">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-stone-500 block">환불 대기</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className={`text-3xl font-black ${!isLoading && refundPendingCount > 0 ? 'text-rose-600' : 'text-stone-900'}`}>
                                {isLoading ? '-' : refundPendingCount}
                            </span>
                            <span className="text-xs font-bold text-stone-400">건</span>
                        </div>
                        <p className={`text-xs font-extrabold ${!isLoading && refundPendingCount > 0 ? 'text-rose-600' : 'text-stone-400'}`}>
                            {isLoading ? '-' : `${refundPendingAmount.toLocaleString()}원`}
                        </p>
                    </div>
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                        <Banknote className="w-6 h-6" />
                    </div>
                </div>

                {/* 3. 결제 대기 (입금대기) */}
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs flex items-center justify-between relative overflow-hidden">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-stone-500 block">결제 대기</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className={`text-3xl font-black ${!isLoading && paymentPendingCount > 0 ? 'text-amber-600' : 'text-stone-900'}`}>
                                {isLoading ? '-' : paymentPendingCount}
                            </span>
                            <span className="text-xs font-bold text-stone-400">건</span>
                        </div>
                        <p className={`text-xs font-extrabold ${!isLoading && paymentPendingCount > 0 ? 'text-amber-700' : 'text-stone-400'}`}>
                            {isLoading ? '-' : `${paymentPendingAmount.toLocaleString()}원`}
                        </p>
                    </div>
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                        <Clock className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* 3. 결제 검색 & 기간 필터 카드 */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-stone-800 flex items-center gap-1.5">
                        <Search className="w-4 h-4 text-[#224732]" />
                        결제 검색
                        <span className="text-xs font-normal text-stone-400 ml-1">
                            ({isLoading ? '-' : `${totalCount}개 검색됨`})
                        </span>
                    </h3>
                </div>

                {/* 검색 입력창 행 */}
                <div className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="w-full sm:w-36">
                        <Select value={searchType} onValueChange={(val: any) => setSearchType(val)}>
                            <SelectTrigger className="h-9 text-xs rounded-xl bg-stone-50 border-stone-200">
                                <SelectValue placeholder="검색 기준" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="guestName">입금자/예약자명</SelectItem>
                                <SelectItem value="guestPhone">연락처 (뒤4자리)</SelectItem>
                                <SelectItem value="siteId">사이트명</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="relative flex-1 w-full">
                        <Input
                            type="text"
                            placeholder="검색어를 입력하세요 (예: 전혜련, 010...)"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="h-9 text-xs rounded-xl bg-white border-stone-200 pr-8"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* 결제 신청일 기간 선택 행 */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-stone-500 mr-1">신청일 기준</span>
                        {[
                            { id: 'today', label: '오늘' },
                            { id: 'yesterday', label: '어제' },
                            { id: '1week', label: '1주' },
                            { id: '1month', label: '1달' },
                            { id: '3month', label: '3달' },
                            { id: '6month', label: '6달' },
                            { id: '1year', label: '1년' },
                            { id: 'all', label: '전체' }
                        ].map(btn => (
                            <button
                                key={btn.id}
                                onClick={() => applyQuickPeriod(btn.id as PeriodQuickType)}
                                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                                    periodQuick === btn.id
                                        ? 'bg-blue-600 text-white shadow-2xs'
                                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    {/* 직접 날짜 지정 */}
                    <div className="flex items-center gap-1.5 self-start lg:self-auto">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setPeriodQuick('all');
                                setCurrentPage(1);
                            }}
                            className="p-1 px-2 border border-stone-200 rounded-lg text-xs bg-stone-50 focus:bg-white"
                        />
                        <span className="text-stone-400">~</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setPeriodQuick('all');
                                setCurrentPage(1);
                            }}
                            className="p-1 px-2 border border-stone-200 rounded-lg text-xs bg-stone-50 focus:bg-white"
                        />
                    </div>
                </div>
            </div>

            {/* 4. 상태 탭 바 & 페이지당 항목 수 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                {/* 6대 상태 탭 버튼 */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                    {[
                        { id: 'ALL', label: '전체', count: allPaymentItems.length },
                        { id: 'PENDING', label: '결제대기', count: allPaymentItems.filter(i => i.status === 'PENDING').length },
                        { id: 'CONFIRMED', label: '결제완료', count: allPaymentItems.filter(i => i.status === 'CONFIRMED' && !i.isPartialRefund).length },
                        { id: 'REFUND_PENDING', label: '환불대기', count: allPaymentItems.filter(i => i.status === 'REFUND_PENDING').length },
                        { id: 'REFUNDED', label: '환불완료', count: allPaymentItems.filter(i => i.status === 'REFUNDED').length },
                        { id: 'CANCELLED', label: '취소됨', count: allPaymentItems.filter(i => i.status === 'CANCELLED').length },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id as FilterTabType);
                                setCurrentPage(1);
                            }}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                                activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'
                            }`}
                        >
                            <span>{tab.label}</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
                            }`}>
                                {isLoading ? '-' : tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* 10개씩 보기 셀렉트 */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className="text-xs text-stone-400 font-medium">페이지당:</span>
                    <Select 
                        value={pageSize.toString()} 
                        onValueChange={(v) => {
                            setPageSize(Number(v));
                            setCurrentPage(1);
                        }}
                    >
                        <SelectTrigger className="h-8 w-24 text-xs rounded-xl bg-white border-stone-200">
                            <SelectValue placeholder="10개씩" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10개씩</SelectItem>
                            <SelectItem value="20">20개씩</SelectItem>
                            <SelectItem value="50">50개씩</SelectItem>
                            <SelectItem value="100">100개씩</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* 5. 캠핏 스타일 고밀도 10열 테이블 그리드 */}
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[1000px]">
                        <thead className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200">
                            <tr>
                                <th className="py-3 px-3 text-center w-14">구분</th>
                                <th className="py-3 px-3 w-20">상태</th>
                                <th className="py-3 px-3.5 w-36">예약자 / 연락처</th>
                                <th className="py-3 px-3.5">예약 정보 (사이트 · 일정)</th>
                                <th className="py-3 px-3 text-center w-20">결제 방식</th>
                                <th className="py-3 px-3.5 text-right w-28">결제(예정)액</th>
                                <th className="py-3 px-3.5 w-44">계좌 정보</th>
                                <th className="py-3 px-3 text-center w-24">신청일</th>
                                <th className="py-3 px-3 text-center w-24">변동일시</th>
                                <th className="py-3 px-3 text-center w-20">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 text-stone-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={10} className="py-16 text-center text-stone-400">
                                        <Loader2 className="w-8 h-8 mx-auto mb-2 text-blue-600 animate-spin" />
                                        <p className="text-xs font-semibold text-stone-600">결제 및 예약 내역을 불러오는 중입니다...</p>
                                    </td>
                                </tr>
                            ) : paginatedList.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-16 text-center text-stone-400">
                                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                                        해당 조건에 맞는 결제/예약 내역이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                paginatedList.map(item => {
                                    const r = item.raw;
                                    const site = sites.find(s => s.id === item.siteId);
                                    const siteName = site?.name || item.siteId || '사이트';
                                    const checkIn = new Date(item.checkInDate);
                                    const checkOut = new Date(item.checkOutDate);
                                    const isRefund = item.type === 'REFUND' || item.type === 'PARTIAL_REFUND';
                                    const isCancelled = item.type === 'CANCEL';

                                    const createdStr = item.createdAt ? format(new Date(item.createdAt), 'MM/dd HH:mm') : '-';
                                    const updatedStr = item.updatedAt ? format(new Date(item.updatedAt), 'MM/dd HH:mm') : createdStr;

                                    return (
                                        <tr 
                                            key={item.id}
                                            onClick={() => handleRowClick(r)}
                                            className={`hover:bg-blue-50/40 cursor-pointer transition-colors ${
                                                item.isPartialRefund 
                                                    ? 'bg-amber-50/40 border-l-4 border-l-rose-500' 
                                                    : isRefund 
                                                        ? 'bg-rose-50/20' 
                                                        : isCancelled 
                                                            ? 'bg-stone-50/40 text-stone-400' 
                                                            : ''
                                            }`}
                                        >
                                            {/* 1. 구분 */}
                                            <td className="py-3 px-3 text-center">
                                                {item.isPartialRefund ? (
                                                    <span className="text-[11px] font-black text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full">
                                                        일부환불
                                                    </span>
                                                ) : isRefund ? (
                                                    <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                                        전체환불
                                                    </span>
                                                ) : isCancelled ? (
                                                    <span className="text-[11px] font-bold text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                                                        취소
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                        결제
                                                    </span>
                                                )}
                                            </td>

                                            {/* 2. 상태 */}
                                            <td className="py-3 px-3">
                                                {item.status === 'CONFIRMED' && (
                                                    <span className="text-emerald-700 font-bold text-xs flex items-center gap-0.5">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 결제완료
                                                    </span>
                                                )}
                                                {item.status === 'PENDING' && (
                                                    <span className="text-amber-700 font-bold text-xs flex items-center gap-0.5">
                                                        <Clock className="w-3 h-3 text-amber-600" /> 결제대기
                                                    </span>
                                                )}
                                                {item.status === 'REFUND_PENDING' && (
                                                    <span className="text-rose-700 font-bold text-xs flex items-center gap-0.5">
                                                        <AlertCircle className="w-3 h-3 text-rose-600" /> {item.isPartialRefund ? '일부환불 대기' : '환불대기'}
                                                    </span>
                                                )}
                                                {item.status === 'REFUNDED' && (
                                                    <span className="text-purple-700 font-bold text-xs">
                                                        {item.isPartialRefund ? '일부환불 완료' : '환불완료'}
                                                    </span>
                                                )}
                                                {item.status === 'CANCELLED' && (
                                                    <span className="text-stone-400 font-medium text-xs">
                                                        취소됨
                                                    </span>
                                                )}
                                            </td>

                                            {/* 3. 예약자 / 입금자 */}
                                            <td className="py-3 px-3.5">
                                                <div className="font-extrabold text-stone-900 text-xs hover:text-blue-600 flex items-center gap-1">
                                                    <span>{item.guestName || '(이름없음)'}</span>
                                                    {item.isPartialRefund && (
                                                        <span className="text-[10px] text-rose-600 font-semibold">(차액)</span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                                                    {item.guestPhone || '-'}
                                                </div>
                                            </td>

                                            {/* 4. 예약 정보 */}
                                            <td className="py-3 px-3.5">
                                                <div className="font-bold text-emerald-900">
                                                    {siteName}
                                                </div>
                                                <div className="text-[11px] text-stone-500 mt-0.5">
                                                    {format(checkIn, 'MM/dd(eee)', { locale: ko })} ~ {format(checkOut, 'MM/dd(eee)', { locale: ko })}
                                                </div>
                                            </td>

                                            {/* 5. 결제 방식 */}
                                            <td className="py-3 px-3 text-center text-stone-600 text-[11px]">
                                                계좌이체
                                            </td>

                                            {/* 6. 결제(예정)액 */}
                                            <td className="py-3 px-3.5 text-right font-black">
                                                {item.amount < 0 ? (
                                                    <span className="text-rose-600 text-xs font-black">
                                                        {item.amount.toLocaleString()}원
                                                    </span>
                                                ) : isCancelled ? (
                                                    <span className="text-stone-400 line-through text-xs">
                                                        {item.amount.toLocaleString()}원
                                                    </span>
                                                ) : (
                                                    <span className="text-stone-900 text-xs font-black">
                                                        {item.amount.toLocaleString()}원
                                                    </span>
                                                )}
                                            </td>

                                            {/* 7. 계좌 정보 (환불 시 예약취소자 계좌, 결제 시 라온아이 입금계좌) */}
                                            <td className="py-3 px-3.5 text-[11px] text-stone-600">
                                                {isRefund || item.refundAccount ? (
                                                    <div>
                                                        <div className="font-bold text-rose-800 flex items-center gap-1">
                                                            <span>{item.refundBank || '환불계좌'}</span>
                                                            <span className="text-[10px] font-normal text-rose-600">({item.refundHolder || item.guestName})</span>
                                                        </div>
                                                        <div className="text-rose-700 font-mono text-[11px] font-semibold">
                                                            {item.refundAccount || '계좌번호 미입력'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div className="font-semibold text-stone-800">국민은행 (라온아이)</div>
                                                        <div className="text-stone-500 font-mono text-[10px]">
                                                             458701-04-539380
                                                        </div>
                                                    </div>
                                                )}
                                            </td>

                                            {/* 8. 예약 신청일 */}
                                            <td className="py-3 px-3 text-center text-stone-500 font-mono text-[11px]">
                                                {createdStr}
                                            </td>

                                            {/* 9. 변동 일시 (취소/환불 시각) */}
                                            <td className="py-3 px-3 text-center text-stone-800 font-mono text-[11px] font-semibold">
                                                {updatedStr}
                                            </td>

                                            {/* 10. 관리 빠른 액션 */}
                                            <td className="py-3 px-3 text-center">
                                                {item.isPartialRefund ? (
                                                    item.status === 'REFUND_PENDING' ? (
                                                        <Button
                                                            size="sm"
                                                            disabled={confirmingId === item.id}
                                                            onClick={(e) => handleQuickPartialRefund(e, item)}
                                                            className="h-7 px-2.5 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-2xs"
                                                        >
                                                            {confirmingId === item.id ? (
                                                                <span className="flex items-center gap-1">
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                    처리중
                                                                </span>
                                                            ) : (
                                                                '환불완료'
                                                            )}
                                                        </Button>
                                                    ) : (
                                                        <span className="text-purple-700 text-[11px] font-bold px-2 py-1 bg-purple-50 rounded-md border border-purple-200">
                                                            환불완료
                                                        </span>
                                                    )
                                                ) : item.status === 'REFUND_PENDING' ? (
                                                    <Button
                                                        size="sm"
                                                        disabled={confirmingId === item.id}
                                                        onClick={(e) => handleQuickRefund(e, r)}
                                                        className="h-7 px-2.5 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-2xs"
                                                    >
                                                        {confirmingId === item.id ? (
                                                            <span className="flex items-center gap-1">
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                                처리중
                                                            </span>
                                                        ) : (
                                                            '환불완료'
                                                        )}
                                                    </Button>
                                                ) : item.status === 'PENDING' ? (
                                                    <Button
                                                        size="sm"
                                                        disabled={confirmingId === item.id}
                                                        onClick={(e) => handleQuickConfirm(e, r)}
                                                        className="h-7 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs disabled:opacity-50"
                                                    >
                                                        {confirmingId === item.id ? (
                                                            <span className="flex items-center gap-1">
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                                처리중
                                                            </span>
                                                        ) : (
                                                            '입금확인'
                                                        )}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRowClick(r);
                                                        }}
                                                        className="h-7 px-2 text-[11px] text-stone-500 hover:text-stone-800"
                                                    >
                                                        상세
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 6. 하단 페이지네이션 바 */}
                {!isLoading && totalPages > 1 && (
                    <div className="p-3 border-t border-stone-100 flex items-center justify-center gap-1.5 bg-stone-50/50">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className="h-8 w-8 p-0 rounded-lg"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                            // 현재 페이지 주변 5개 번호만 노출
                            if (pageNum < currentPage - 2 || pageNum > currentPage + 2) return null;
                            return (
                                <Button
                                    key={pageNum}
                                    size="sm"
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`h-8 w-8 p-0 rounded-lg text-xs font-bold transition-colors ${
                                        currentPage === pageNum
                                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs'
                                            : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
                                    }`}
                                >
                                    {pageNum}
                                </Button>
                            );
                        })}

                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className="h-8 w-8 p-0 rounded-lg"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </div>

            {/* 통합 예약 상세 모달 */}
            <AdminReservationDetailModal
                reservation={selectedReservation}
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
            />
        </div>
    );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';

import { useReservationStore } from '@/store/useReservationStore';
import { Reservation } from '@/types/reservation';
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
    X
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

export default function AdminPaymentsPage() {
    const { reservations, sites, fetchAllReservations, updateReservationStatus } = useReservationStore();

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

    useEffect(() => {
        fetchAllReservations();
        applyQuickPeriod('3month');
    }, [fetchAllReservations]);

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

    // 최신 변동 시각(updatedAt 또는 createdAt) 산출 헬퍼
    const getLatestTimestamp = (r: Reservation): number => {
        const u = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
        const c = r.createdAt ? new Date(r.createdAt).getTime() : 0;
        return Math.max(u, c);
    };

    // 상단 3종 요약 데이터 계산
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayPaidList = reservations.filter(r => {
        if (r.status !== 'CONFIRMED') return false;
        const cDate = r.createdAt ? format(new Date(r.createdAt), 'yyyy-MM-dd') : '';
        const uDate = r.updatedAt ? format(new Date(r.updatedAt), 'yyyy-MM-dd') : '';
        return cDate === todayStr || uDate === todayStr;
    });
    const todayPaidCount = todayPaidList.length;
    const todayPaidAmount = todayPaidList.reduce((sum, r) => sum + r.totalPrice, 0);

    const refundPendingList = reservations.filter(r => r.status === 'REFUND_PENDING');
    const refundPendingCount = refundPendingList.length;
    const refundPendingAmount = refundPendingList.reduce((sum, r) => sum + (r.refundAmount ?? r.totalPrice), 0);

    const paymentPendingList = reservations.filter(r => r.status === 'PENDING');
    const paymentPendingCount = paymentPendingList.length;
    const paymentPendingAmount = paymentPendingList.reduce((sum, r) => sum + r.totalPrice, 0);

    // 필터링 및 최신순 정렬
    const filteredReservations = useMemo(() => {
        return reservations
            .filter(r => {
                // 1) 탭 필터
                if (activeTab === 'PENDING' && r.status !== 'PENDING') return false;
                if (activeTab === 'CONFIRMED' && r.status !== 'CONFIRMED') return false;
                if (activeTab === 'REFUND_PENDING' && r.status !== 'REFUND_PENDING') return false;
                if (activeTab === 'REFUNDED' && r.status !== 'REFUNDED') return false;
                if (activeTab === 'CANCELLED' && r.status !== 'CANCELLED') return false;

                // 2) 기간 필터
                if (startDate && endDate) {
                    const rDate = r.createdAt ? new Date(r.createdAt) : null;
                    if (rDate) {
                        const s = startOfDay(new Date(startDate));
                        const e = endOfDay(new Date(endDate));
                        if (rDate < s || rDate > e) return false;
                    }
                }

                // 3) 검색어 필터
                if (searchQuery.trim()) {
                    const q = searchQuery.trim().toLowerCase();
                    if (searchType === 'guestName' && !(r.guestName || '').toLowerCase().includes(q)) return false;
                    if (searchType === 'guestPhone' && !(r.guestPhone || '').includes(q)) return false;
                    if (searchType === 'siteId' && !(r.siteId || '').toLowerCase().includes(q)) return false;
                }

                return true;
            })
            // ★ 관리자 조치 필요 건(환불대기/결제대기) 최상단 고정(Pin to Top) + 최신 변동 시각 우선 내림차순 정렬
            .sort((a, b) => {
                const isActionRequired = (status: string) => status === 'REFUND_PENDING' || status === 'PENDING';
                const aReq = isActionRequired(a.status);
                const bReq = isActionRequired(b.status);

                if (aReq && !bReq) return -1;
                if (!aReq && bReq) return 1;

                return getLatestTimestamp(b) - getLatestTimestamp(a);
            });
    }, [reservations, activeTab, startDate, endDate, searchQuery, searchType]);

    // 페이지네이션 슬라이싱
    const totalCount = filteredReservations.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const paginatedList = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredReservations.slice(start, start + pageSize);
    }, [filteredReservations, currentPage, pageSize]);

    const handleRowClick = (r: Reservation) => {
        setSelectedReservation(r);
        setIsDetailOpen(true);
    };

    const handleQuickConfirm = async (e: React.MouseEvent, r: Reservation) => {
        e.stopPropagation();
        try {
            await updateReservationStatus(r.id, 'CONFIRMED');
            toast.success(`${r.guestName}님의 입금이 확인되어 예약이 확정되었습니다.`);
        } catch (err: any) {
            toast.error(err?.message || '확정 처리에 실패했습니다.');
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
                        onClick={() => fetchAllReservations()} 
                        className="rounded-xl text-xs bg-white text-stone-700 hover:bg-stone-50"
                    >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> 새로고침
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
                            <span className="text-3xl font-black text-stone-900">{todayPaidCount}</span>
                            <span className="text-xs font-bold text-stone-400">건</span>
                        </div>
                        <p className="text-xs font-extrabold text-blue-600">
                            {todayPaidAmount.toLocaleString()}원
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
                            <span className={`text-3xl font-black ${refundPendingCount > 0 ? 'text-rose-600' : 'text-stone-900'}`}>
                                {refundPendingCount}
                            </span>
                            <span className="text-xs font-bold text-stone-400">건</span>
                        </div>
                        <p className={`text-xs font-extrabold ${refundPendingCount > 0 ? 'text-rose-600' : 'text-stone-400'}`}>
                            {refundPendingAmount.toLocaleString()}원
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
                            <span className={`text-3xl font-black ${paymentPendingCount > 0 ? 'text-amber-600' : 'text-stone-900'}`}>
                                {paymentPendingCount}
                            </span>
                            <span className="text-xs font-bold text-stone-400">건</span>
                        </div>
                        <p className={`text-xs font-extrabold ${paymentPendingCount > 0 ? 'text-amber-700' : 'text-stone-400'}`}>
                            {paymentPendingAmount.toLocaleString()}원
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
                            ({totalCount}개 검색됨)
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
                        { id: 'ALL', label: '전체', count: reservations.length },
                        { id: 'PENDING', label: '결제대기', count: reservations.filter(r => r.status === 'PENDING').length },
                        { id: 'CONFIRMED', label: '결제완료', count: reservations.filter(r => r.status === 'CONFIRMED').length },
                        { id: 'REFUND_PENDING', label: '환불대기', count: reservations.filter(r => r.status === 'REFUND_PENDING').length },
                        { id: 'REFUNDED', label: '환불완료', count: reservations.filter(r => r.status === 'REFUNDED').length },
                        { id: 'CANCELLED', label: '취소됨', count: reservations.filter(r => r.status === 'CANCELLED').length },
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
                                {tab.count}
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
                            {paginatedList.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-16 text-center text-stone-400">
                                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                                        해당 조건에 맞는 결제/예약 내역이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                paginatedList.map(r => {
                                    const site = sites.find(s => s.id === r.siteId);
                                    const siteName = site?.name || r.siteId || '사이트';
                                    const checkIn = new Date(r.checkInDate);
                                    const checkOut = new Date(r.checkOutDate);
                                    const isRefund = r.status === 'REFUND_PENDING' || r.status === 'REFUNDED';
                                    const isCancelled = r.status === 'CANCELLED';

                                    const createdStr = r.createdAt ? format(new Date(r.createdAt), 'MM/dd HH:mm') : '-';
                                    const updatedStr = r.updatedAt ? format(new Date(r.updatedAt), 'MM/dd HH:mm') : createdStr;

                                    return (
                                        <tr 
                                            key={r.id}
                                            onClick={() => handleRowClick(r)}
                                            className={`hover:bg-blue-50/40 cursor-pointer transition-colors ${
                                                isRefund ? 'bg-rose-50/20' : isCancelled ? 'bg-stone-50/40 text-stone-400' : ''
                                            }`}
                                        >
                                            {/* 1. 구분 */}
                                            <td className="py-3 px-3 text-center">
                                                {isRefund ? (
                                                    <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                                        환불
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
                                                {r.status === 'CONFIRMED' && (
                                                    <span className="text-emerald-700 font-bold text-xs flex items-center gap-0.5">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 결제완료
                                                    </span>
                                                )}
                                                {r.status === 'PENDING' && (
                                                    <span className="text-amber-700 font-bold text-xs flex items-center gap-0.5">
                                                        <Clock className="w-3 h-3 text-amber-600" /> 결제대기
                                                    </span>
                                                )}
                                                {r.status === 'REFUND_PENDING' && (
                                                    <span className="text-rose-700 font-bold text-xs flex items-center gap-0.5">
                                                        <AlertCircle className="w-3 h-3 text-rose-600" /> 환불대기
                                                    </span>
                                                )}
                                                {r.status === 'REFUNDED' && (
                                                    <span className="text-purple-700 font-bold text-xs">
                                                        환불완료
                                                    </span>
                                                )}
                                                {r.status === 'CANCELLED' && (
                                                    <span className="text-stone-400 font-medium text-xs">
                                                        취소됨
                                                    </span>
                                                )}
                                            </td>

                                            {/* 3. 예약자 / 입금자 */}
                                            <td className="py-3 px-3.5">
                                                <div className="font-extrabold text-stone-900 text-xs hover:text-blue-600 flex items-center gap-1">
                                                    <span>{r.guestName || '(이름없음)'}</span>
                                                </div>
                                                <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                                                    {r.guestPhone || '-'}
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
                                                {isRefund ? (
                                                    <span className="text-rose-600 text-xs">
                                                        -{(r.refundAmount ?? r.totalPrice).toLocaleString()}원
                                                    </span>
                                                ) : isCancelled ? (
                                                    <span className="text-stone-400 line-through text-xs">
                                                        {r.totalPrice.toLocaleString()}원
                                                    </span>
                                                ) : (
                                                    <span className="text-stone-900 text-xs">
                                                        {r.totalPrice.toLocaleString()}원
                                                    </span>
                                                )}
                                            </td>

                                            {/* 7. 계좌 정보 (환불 시 예약취소자 계좌, 결제 시 라온아이 입금계좌) */}
                                            <td className="py-3 px-3.5 text-[11px] text-stone-600">
                                                {isRefund || r.refundAccount ? (
                                                    <div>
                                                        <div className="font-bold text-rose-800 flex items-center gap-1">
                                                            <span>{r.refundBank || '환불계좌'}</span>
                                                            <span className="text-[10px] font-normal text-rose-600">({r.refundHolder || r.guestName})</span>
                                                        </div>
                                                        <div className="text-rose-700 font-mono text-[11px] font-semibold">
                                                            {r.refundAccount || '계좌번호 미입력'}
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
                                                {r.status === 'PENDING' ? (
                                                    <Button
                                                        size="sm"
                                                        onClick={(e) => handleQuickConfirm(e, r)}
                                                        className="h-7 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs"
                                                    >
                                                        입금확인
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
                {totalPages > 1 && (
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

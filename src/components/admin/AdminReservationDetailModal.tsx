'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Reservation } from '@/types/reservation';
import { useReservationStore } from '@/store/useReservationStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function safeFormatDate(dateVal: any, formatStr: string, options?: any): string {
    if (!dateVal) return '-';
    try {
        const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
        if (!d || isNaN(d.getTime())) return '-';
        return format(d, formatStr, options);
    } catch {
        return '-';
    }
}
import { 
    CheckCircle, 
    XCircle, 
    History, 
    Phone, 
    User, 
    Calendar, 
    CreditCard, 
    Tent, 
    Car, 
    Users, 
    Clock, 
    Loader2, 
    Edit3, 
    Save, 
    Undo2,
    AlertCircle,
    ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import CancelReservationDialog from './CancelReservationDialog';

interface AdminReservationDetailModalProps {
    reservation: Reservation | null;
    isOpen: boolean;
    onClose: () => void;
    onStatusChanged?: () => void;
    onModifySchedule?: (reservation: Reservation) => void;
}

export default function AdminReservationDetailModal({
    reservation,
    isOpen,
    onClose,
    onStatusChanged,
    onModifySchedule
}: AdminReservationDetailModalProps) {
    const { 
        updateReservationStatus, 
        completeRefund, 
        fetchAllReservations, 
        getUserHistory, 
        sites,
        updateReservationDetails,
        calculatePrice
    } = useReservationStore();

    const [userHistory, setUserHistory] = useState<Reservation[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isRefunding, setIsRefunding] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    // 수정 모드 상태
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // 수정 폼 입력값 상태
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [vehicleCount, setVehicleCount] = useState(1);
    const [familyCount, setFamilyCount] = useState(1);
    const [visitorCount, setVisitorCount] = useState(0);
    const [adults, setAdults] = useState(2);
    const [seniors, setSeniors] = useState(0);
    const [kidsPreschool, setKidsPreschool] = useState(0);
    const [kidsElementary, setKidsElementary] = useState(0);
    const [kidsTeen, setKidsTeen] = useState(0);
    const [hasPet, setHasPet] = useState(false);
    const [requests, setRequests] = useState('');

    useEffect(() => {
        if (reservation) {
            setGuestName(reservation.guestName || '');
            setGuestPhone(reservation.guestPhone || '');
            setVehicleCount(reservation.vehicleCount || 1);
            setFamilyCount(reservation.familyCount || 1);
            setVisitorCount(reservation.visitorCount || 0);
            setAdults(reservation.guestDetails?.adults ?? (reservation.familyCount * 2));
            setSeniors(reservation.guestDetails?.seniors ?? 0);
            setKidsPreschool(reservation.guestDetails?.kids?.preschool ?? 0);
            setKidsElementary(reservation.guestDetails?.kids?.elementary ?? 0);
            setKidsTeen(reservation.guestDetails?.kids?.teen ?? 0);
            setHasPet(reservation.guestDetails?.hasPet ?? false);
            setRequests(reservation.requests || '');
            setIsEditing(false);
        }
    }, [reservation, isOpen]);

    const site = useMemo(() => {
        if (!reservation) return undefined;
        return sites.find(s => s.id === reservation.siteId);
    }, [sites, reservation]);

    const siteName = site?.name || reservation?.siteId || '사이트 미지정';

    // 실시간 가격 변동 및 차액 계산 (Rules of Hooks: 조건부 리턴보다 상단에 위치)
    const pricePreview = useMemo(() => {
        if (!reservation || !site) return { newPrice: reservation?.totalPrice || 0, diff: 0 };
        try {
            const inDate = new Date(reservation.checkInDate);
            const outDate = new Date(reservation.checkOutDate);
            if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
                return { newPrice: reservation.totalPrice || 0, diff: 0 };
            }
            const breakdown = calculatePrice(
                site,
                inDate,
                outDate,
                familyCount,
                visitorCount
            );
            const newPrice = breakdown.totalPrice;
            const diff = newPrice - (reservation.totalPrice || 0);
            return { newPrice, diff };
        } catch {
            return { newPrice: reservation?.totalPrice || 0, diff: 0 };
        }
    }, [reservation, site, familyCount, visitorCount, calculatePrice]);

    if (!reservation) return null;

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
        if (isConfirming) return;
        setIsConfirming(true);
        try {
            await updateReservationStatus(reservation.id, 'CONFIRMED');
            toast.success('입금 확인 및 예약이 확정되었습니다.');
            if (onStatusChanged) onStatusChanged();
            onClose();
        } catch (e: any) {
            toast.error(e?.message || '확정 처리에 실패했습니다.');
        } finally {
            setIsConfirming(false);
        }
    };

    const handleCompleteRefund = async () => {
        const refundAmt = (reservation.refundAmount ?? reservation.totalPrice).toLocaleString();
        const holderName = reservation.refundHolder || reservation.guestName || '예약자';
        const bankName = reservation.refundBank || '계좌';
        
        const isConfirmed = window.confirm(
            `[환불 완료 확인]\n\n• 대상: ${holderName} 님\n• 환불 계좌: ${bankName} ${reservation.refundAccount || ''}\n• 환불 금액: ${refundAmt}원\n\n위 계좌로 송금을 완료하셨습니까? 환불 완료로 상태를 변경합니다.`
        );
        if (!isConfirmed) return;

        setIsRefunding(true);
        try {
            const res = await completeRefund(reservation.id);
            if (res.success) {
                toast.success('환불 완료 처리되었습니다.');
                if (onStatusChanged) onStatusChanged();
                onClose();
            } else {
                toast.error(res.message || '환불 처리에 실패했습니다.');
            }
        } catch (e: any) {
            toast.error(e?.message || '환불 처리 중 오류가 발생했습니다.');
        } finally {
            setIsRefunding(false);
        }
    };

    const handleSaveEdit = async () => {
        if (isSaving || !reservation) return;
        setIsSaving(true);
        try {
            const totalGuests = adults + seniors + kidsPreschool + kidsElementary + kidsTeen;
            const res = await updateReservationDetails({
                id: reservation.id,
                guestName: guestName.trim() || reservation.guestName || '',
                guestPhone: guestPhone.trim() || reservation.guestPhone || '',
                familyCount: Number(familyCount) || 1,
                visitorCount: Number(visitorCount) || 0,
                vehicleCount: Number(vehicleCount) || 1,
                guests: Math.max(1, totalGuests || 1),
                guestDetails: {
                    adults: Number(adults) || 0,
                    seniors: Number(seniors) || 0,
                    kids: {
                        preschool: Number(kidsPreschool) || 0,
                        elementary: Number(kidsElementary) || 0,
                        teen: Number(kidsTeen) || 0
                    },
                    hasPet: !!hasPet
                },
                requests: requests.trim(),
                newTotalPrice: pricePreview.newPrice,
                priceDiff: pricePreview.diff
            });

            if (res.success) {
                toast.success(`예약 정보가 수정되었습니다.${pricePreview.diff > 0 ? ` (추가 입금: +${pricePreview.diff.toLocaleString()}원)` : pricePreview.diff < 0 ? ` (환불대기: -${Math.abs(pricePreview.diff).toLocaleString()}원)` : ''}`);
                setIsEditing(false);
                if (onStatusChanged) onStatusChanged();
            } else {
                toast.error(res.error || '수정 중 오류가 발생했습니다.');
            }
        } catch (e: any) {
            toast.error(e?.message || '수정 처리 실패');
        } finally {
            setIsSaving(false);
        }
    };

    // 요금 산출 내역 안전 계산
    const checkIn = new Date(reservation.checkInDate);
    const checkOut = new Date(reservation.checkOutDate);
    const isValidDates = !isNaN(checkIn.getTime()) && !isNaN(checkOut.getTime());
    const nights = isValidDates ? Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))) : 1;
    const extraFam = Math.max(0, (reservation.familyCount || 1) - 1);
    const extraFamCost = extraFam * 35000 * nights;
    const visitorCost = (reservation.visitorCount || 0) * 10000;
    const currentTotalPrice = reservation.totalPrice || 0;
    const baseStayCost = Math.max(0, currentTotalPrice - extraFamCost - visitorCost);

    const isRefundCase = reservation.status === 'REFUND_PENDING' || reservation.status === 'REFUNDED' || !!reservation.refundAccount;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center justify-between pr-6 text-lg font-bold gap-2">
                        <span className="flex items-center gap-2">
                            <Tent className="w-5 h-5 text-[#224732]" />
                            예약 상세 정보
                        </span>
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        예약 상세 정보 조회 및 전체 수정 모달입니다.
                    </DialogDescription>
                </DialogHeader>

                {/* 상단 컨트롤 바 */}
                <div className="flex flex-wrap items-center justify-between pb-3 border-b border-stone-200 gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        reservation.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' :
                        reservation.status === 'PENDING' ? 'bg-amber-100 text-amber-900' :
                        reservation.status === 'REFUND_PENDING' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        reservation.status === 'REFUNDED' ? 'bg-purple-100 text-purple-900' :
                        'bg-gray-100 text-gray-700'
                    }`}>
                        {reservation.status === 'CONFIRMED' ? '예약확정 (결제완료)' :
                         reservation.status === 'PENDING' ? '입금대기' :
                         reservation.status === 'REFUND_PENDING' ? '환불대기 (송금 필요)' :
                         reservation.status === 'REFUNDED' ? '환불완료' :
                         reservation.status === 'CANCELLED' ? '예약취소' : reservation.status}
                    </span>

                    <div className="flex items-center gap-1.5">
                        {!isEditing && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setIsEditing(true)}
                                className="h-7 px-2.5 text-xs font-bold rounded-lg border-amber-300 bg-amber-50/80 text-amber-900 hover:bg-amber-100 flex items-center gap-1"
                            >
                                <Edit3 className="w-3.5 h-3.5" /> 정보 수정
                            </Button>
                        )}
                        {onModifySchedule && !isEditing && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    onClose();
                                    onModifySchedule(reservation);
                                }}
                                className="h-7 px-2.5 text-xs font-bold rounded-lg border-blue-300 bg-blue-50/80 text-blue-900 hover:bg-blue-100 flex items-center gap-1"
                            >
                                <Calendar className="w-3.5 h-3.5" /> 일정/사이트 변경
                            </Button>
                        )}
                    </div>
                </div>

                {isEditing ? (
                    /* 수정 모드 폼 */
                    <div className="grid md:grid-cols-2 gap-5 mt-2">
                        {/* 좌측: 기본 정보 및 요청사항 */}
                        <div className="space-y-4">
                            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3">
                                <h4 className="font-extrabold text-sm text-stone-900 flex items-center gap-1.5 pb-2 border-b border-stone-200">
                                    <User className="w-4 h-4 text-[#224732]" /> 기본 예약자 정보 수정
                                </h4>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-stone-700">예약자 성함</Label>
                                    <Input
                                        value={guestName}
                                        onChange={(e) => setGuestName(e.target.value)}
                                        placeholder="예약자 성함 입력"
                                        className="h-9 text-xs bg-white"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-stone-700">연락처</Label>
                                    <Input
                                        value={guestPhone}
                                        onChange={(e) => setGuestPhone(e.target.value)}
                                        placeholder="010-0000-0000"
                                        className="h-9 text-xs bg-white"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-stone-700">가족 수</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={10}
                                            value={familyCount}
                                            onChange={(e) => setFamilyCount(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="h-9 text-xs bg-white"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-stone-700">차량 대수</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={10}
                                            value={vehicleCount}
                                            onChange={(e) => setVehicleCount(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="h-9 text-xs bg-white"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5 pt-1">
                                    <Label className="text-xs font-bold text-stone-700">추가 방문객 수 (인당 10,000원)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={20}
                                        value={visitorCount}
                                        onChange={(e) => setVisitorCount(Math.max(0, parseInt(e.target.value) || 0))}
                                        className="h-9 text-xs bg-white"
                                    />
                                </div>

                                <div className="p-2.5 bg-amber-50/70 rounded-lg border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
                                    💡 <strong>사이트 및 일정(박수) 변경</strong>은 상단의 <span className="font-bold text-blue-700">[일정/사이트 변경]</span> 기능을 이용해주세요.
                                </div>
                            </div>

                            {/* 고객 요청사항 수정 */}
                            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2">
                                <Label className="text-xs font-bold text-stone-700">고객 요청사항</Label>
                                <Textarea
                                    rows={3}
                                    value={requests}
                                    onChange={(e) => setRequests(e.target.value)}
                                    placeholder="고객 요청사항을 입력하세요."
                                    className="text-xs bg-white resize-none"
                                />
                            </div>
                        </div>

                        {/* 우측: 인원 세부 구성 및 금액 변동 안내 */}
                        <div className="space-y-4">
                            {/* 인원 세부 구성 박스 */}
                            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                                    <h4 className="font-extrabold text-sm text-stone-900 flex items-center gap-1.5">
                                        <Users className="w-4 h-4 text-[#224732]" /> 동행자 세부 구성
                                    </h4>
                                    <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                        총 숙박 {adults + seniors + kidsTeen + kidsElementary + kidsPreschool}명
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold text-stone-600">성인</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={adults}
                                            onChange={(e) => setAdults(Math.max(0, parseInt(e.target.value) || 0))}
                                            className="h-8 text-xs bg-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold text-stone-600">시니어</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={seniors}
                                            onChange={(e) => setSeniors(Math.max(0, parseInt(e.target.value) || 0))}
                                            className="h-8 text-xs bg-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold text-stone-600">청소년</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={kidsTeen}
                                            onChange={(e) => setKidsTeen(Math.max(0, parseInt(e.target.value) || 0))}
                                            className="h-8 text-xs bg-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold text-stone-600">초등학생</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={kidsElementary}
                                            onChange={(e) => setKidsElementary(Math.max(0, parseInt(e.target.value) || 0))}
                                            className="h-8 text-xs bg-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] font-bold text-stone-600">미취학 아동</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={kidsPreschool}
                                            onChange={(e) => setKidsPreschool(Math.max(0, parseInt(e.target.value) || 0))}
                                            className="h-8 text-xs bg-white"
                                        />
                                    </div>
                                    <div className="space-y-1 flex flex-col justify-end">
                                        <div className="flex items-center justify-between h-8 px-2.5 bg-white border border-stone-200 rounded-md">
                                            <Label className="text-[11px] font-bold text-stone-700 cursor-pointer">반려동물</Label>
                                            <Switch
                                                checked={hasPet}
                                                onCheckedChange={setHasPet}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 금액 변동 및 정산 전이 미리보기 카드 */}
                            <div className="p-4 rounded-xl border transition-all space-y-3 bg-white shadow-xs border-stone-200">
                                <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                                    <span className="font-extrabold text-xs text-stone-800 flex items-center gap-1.5">
                                        <CreditCard className="w-4 h-4 text-emerald-700" /> 실시간 금액 재계산
                                    </span>
                                    <span className="text-[11px] text-stone-500 font-medium">
                                        가족 수 & 방문객 수 기준
                                    </span>
                                </div>

                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between items-center text-stone-600">
                                        <span>기존 결제 금액</span>
                                        <span className="font-semibold">{reservation.totalPrice.toLocaleString()}원</span>
                                    </div>
                                    <div className="flex justify-between items-center text-stone-900 font-bold">
                                        <span>변경 후 산출 금액</span>
                                        <span className="text-sm font-black text-emerald-800">{pricePreview.newPrice.toLocaleString()}원</span>
                                    </div>
                                </div>

                                <div className={`p-3 rounded-lg border text-xs font-semibold space-y-1 ${
                                    pricePreview.diff > 0 
                                        ? 'bg-amber-50 border-amber-200 text-amber-950' 
                                        : pricePreview.diff < 0 
                                        ? 'bg-rose-50 border-rose-200 text-rose-950' 
                                        : 'bg-stone-50 border-stone-200 text-stone-700'
                                }`}>
                                    <div className="flex justify-between items-center">
                                        <span>정산 차액:</span>
                                        <span className={`text-sm font-black ${
                                            pricePreview.diff > 0 ? 'text-amber-700' : pricePreview.diff < 0 ? 'text-rose-700' : 'text-stone-700'
                                        }`}>
                                            {pricePreview.diff > 0 
                                                ? `+${pricePreview.diff.toLocaleString()}원 (추가 입금 필요)` 
                                                : pricePreview.diff < 0 
                                                ? `-${Math.abs(pricePreview.diff).toLocaleString()}원 (환불 필요)` 
                                                : '변동 없음 (0원)'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] font-normal opacity-90 pt-0.5">
                                        {pricePreview.diff > 0 ? (
                                            <>⚠️ 저장 시 예약 상태가 <strong>[입금대기]</strong>로 자동 전환되어 관리자 결제목록에 노출됩니다.</>
                                        ) : pricePreview.diff < 0 ? (
                                            <>⚠️ 저장 시 예약 상태가 <strong>[환불대기]</strong>로 전환되며 송금해야 할 환불액으로 결제목록 최상단에 노출됩니다.</>
                                        ) : (
                                            <>✓ 결제 금액 변동이 없으므로 현재 결제 상태(<strong>{reservation.status}</strong>)가 그대로 유지됩니다.</>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* 일반 조회 모드 */
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
                                        {safeFormatDate(reservation.checkInDate, 'yyyy.MM.dd(eee)', { locale: ko })} ~ {safeFormatDate(reservation.checkOutDate, 'yyyy.MM.dd(eee)', { locale: ko })} ({nights}박)
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

                        {/* 우측: 환불 정보 / 요금 내역 / 과거 이력 */}
                        <div className="space-y-4">
                            {/* 예약자가 취소하여 환불해야 할 때 노출되는 [환불 송금 정보 카드] */}
                            {isRefundCase && (
                                <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-xs space-y-2.5">
                                    <div className="flex justify-between items-center font-bold text-rose-900 border-b border-rose-200 pb-2">
                                        <span className="flex items-center gap-1.5 text-rose-800">
                                            <CreditCard className="w-4 h-4 text-rose-600" /> 환불 요청 계좌 정보
                                        </span>
                                        <span className="text-sm font-black text-rose-700">
                                            {(reservation.refundAmount ?? reservation.totalPrice).toLocaleString()}원 환불
                                        </span>
                                    </div>

                                    <div className="space-y-1.5 text-stone-700 text-xs">
                                        <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-rose-100">
                                            <span className="font-bold text-stone-500">입금 계좌</span>
                                            <div className="text-right">
                                                <div className="font-extrabold text-rose-900">
                                                    {reservation.refundBank || '은행미기재'} {reservation.refundAccount || '계좌번호 미입력'}
                                                </div>
                                                <div className="text-[11px] text-stone-500">
                                                    예금주: {reservation.refundHolder || reservation.guestName || '-'}
                                                </div>
                                            </div>
                                        </div>

                                        {reservation.cancelReason && (
                                            <div className="bg-white/80 p-2 rounded-lg border border-rose-100 text-[11px]">
                                                <span className="font-bold text-stone-500">취소 사유:</span>{' '}
                                                <span className="text-stone-800">{reservation.cancelReason}</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between text-[11px] text-stone-500 pt-1">
                                            <span>취소 신청일시:</span>
                                            <span className="font-mono">
                                                {safeFormatDate(reservation.cancelledAt, 'yyyy.MM.dd HH:mm')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 요금 영수증 박스 */}
                            <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200 text-xs space-y-2">
                                <div className="flex justify-between items-center font-bold text-blue-900 border-b border-blue-200 pb-2">
                                    <span className="flex items-center gap-1.5">
                                        <CreditCard className="w-4 h-4 text-blue-600" /> 결제 금액 정보
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
                                        <span>• 환불 처리 금액 (환불율 {reservation.refundRate ?? 100}%)</span>
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
                                                            {safeFormatDate(h.checkInDate, 'yy.MM.dd')}
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
                )}

                {/* 하단 관리자 액션 버튼 바 */}
                <DialogFooter className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-2 sm:justify-between items-center">
                    {isEditing ? (
                        <>
                            <div className="text-xs text-stone-500 font-medium">
                                * 인원 및 방문객 수정 시 요금이 실시간으로 재계산됩니다.
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsEditing(false)}
                                    disabled={isSaving}
                                    className="rounded-xl text-xs"
                                >
                                    <Undo2 className="w-3.5 h-3.5 mr-1" /> 수정 취소
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleSaveEdit}
                                    disabled={isSaving}
                                    className="bg-[#224732] hover:bg-[#1b3827] text-white font-bold text-xs rounded-xl shadow-xs"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> 저장 중...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-3.5 h-3.5 mr-1" /> 수정사항 저장하기
                                        </>
                                    )}
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-xs text-stone-400">
                                신청일시: {safeFormatDate(reservation.createdAt, 'yyyy.MM.dd HH:mm')}
                            </div>

                            <div className="flex items-center gap-2">
                                {/* 1. 환불대기 송금 확인 버튼 */}
                                {reservation.status === 'REFUND_PENDING' && (
                                    <Button
                                        size="sm"
                                        disabled={isRefunding}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs"
                                        onClick={handleCompleteRefund}
                                    >
                                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                        {isRefunding ? '처리 중...' : '환불 완료 (송금 완료)'}
                                    </Button>
                                )}

                                {/* 2. 입금 대기 중일 때의 [입금 확인] 버튼 */}
                                {reservation.status === 'PENDING' && (
                                    <Button
                                        size="sm"
                                        disabled={isConfirming}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                                        onClick={handleConfirmPayment}
                                    >
                                        {isConfirming ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                                처리 중...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                                입금 확인 (확정)
                                            </>
                                        )}
                                    </Button>
                                )}

                                {/* 3. 정상 예약 상태일 때만 노출되는 [예약 취소] 버튼 */}
                                {reservation.status !== 'CANCELLED' && reservation.status !== 'REFUND_PENDING' && reservation.status !== 'REFUNDED' && (
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
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

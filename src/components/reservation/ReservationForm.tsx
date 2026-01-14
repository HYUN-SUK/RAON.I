'use client';

import { useState, useEffect } from 'react';
import { useReservationStore } from '@/store/useReservationStore';
import { useRouter } from 'next/navigation';
import { Site } from '@/types/reservation';
import TermsAgreementDialog from './TermsAgreementDialog';
import { useSiteConfig } from '@/hooks/useSiteConfig';

interface ReservationFormProps {
    site: Site;
}

export default function ReservationForm({ site }: ReservationFormProps) {
    const router = useRouter();
    // Use calculatePrice instead of calculateTotalPrice
    const { selectedDateRange, setSelectedSite, calculatePrice, validateReservation, siteConfig, fetchSiteConfig, createReservationSafe } = useReservationStore();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [familyCount, setFamilyCount] = useState(1);
    const [visitorCount, setVisitorCount] = useState(0);
    const [vehicleCount, setVehicleCount] = useState(1);
    const [requests, setRequests] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [termsDialogOpen, setTermsDialogOpen] = useState(false);
    const { config: fullConfig } = useSiteConfig();

    useEffect(() => {
        setIsMounted(true);
        setSelectedSite(site);
        fetchSiteConfig();
    }, [site, setSelectedSite, fetchSiteConfig]);

    // Calculate dates
    const fromDate = selectedDateRange.from ? new Date(selectedDateRange.from) : undefined;
    const toDate = selectedDateRange.to ? new Date(selectedDateRange.to) : undefined;

    // Calculate nights
    const nights = fromDate && toDate
        ? Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    // Calculate price breakdown
    const priceBreakdown = fromDate && toDate
        ? calculatePrice(site, fromDate, toDate, familyCount, visitorCount)
        : null;

    const totalPrice = priceBreakdown ? priceBreakdown.totalPrice : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fromDate || !toDate) {
            alert('날짜를 선택해주세요.');
            return;
        }
        if (!agreed) {
            alert('이용 규정에 동의해주세요.');
            return;
        }
        if (!name.trim()) {
            alert('예약자 성함을 입력해주세요.');
            return;
        }
        if (!phone.trim()) {
            alert('연락처를 입력해주세요.');
            return;
        }

        const validationError = validateReservation(site.id, fromDate, toDate);
        if (validationError) {
            alert(validationError);
            return;
        }

        try {
            // 동시성 제어가 적용된 안전한 예약 생성 (DB RPC)
            const result = await createReservationSafe({
                siteId: site.id,
                checkIn: fromDate,
                checkOut: toDate,
                familyCount,
                visitorCount,
                vehicleCount,
                totalPrice,
                guestName: name,
                guestPhone: phone,
                requests: requests || undefined
            });

            if (result.success) {
                router.push('/reservation/complete');
            } else {
                // 동시성 충돌 또는 중복 예약
                if (result.error === 'ALREADY_BOOKED') {
                    alert('죄송합니다. 방금 다른 분이 먼저 예약을 완료했습니다.\n다른 날짜를 선택해주세요.');
                } else if (result.error === 'CONCURRENT_REQUEST') {
                    alert('다른 예약이 처리 중입니다. 잠시 후 다시 시도해주세요.');
                } else {
                    alert(result.message || '예약 중 오류가 발생했습니다.');
                }
            }
        } catch (error: any) {
            alert(error.message || '예약 중 오류가 발생했습니다.');
        }
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length <= 11) {
            // Simpler approach for auto-hyphen
            let result = '';
            if (value.length < 4) {
                result = value;
            } else if (value.length < 8) {
                result = `${value.slice(0, 3)}-${value.slice(3)}`;
            } else {
                result = `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
            }
            setPhone(result);
        }
    };

    if (!isMounted) return null;

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-6 p-6 bg-white/5 rounded-2xl border border-white/10">
                <h3 className="text-xl font-bold text-white mb-4">예약 정보 입력</h3>

                {/* Basic Info */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-white/70 mb-1">예약자 성함</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#2F5233]"
                            placeholder="홍길동"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-white/70 mb-1">연락처</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={handlePhoneChange}
                            required
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#2F5233]"
                            placeholder="010-1234-5678"
                            maxLength={13}
                        />
                    </div>
                </div>

                {/* Counts */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-white/70 mb-1">가족 수 (기본 1, 최대 2)</label>
                        <select
                            value={familyCount}
                            onChange={(e) => setFamilyCount(parseInt(e.target.value))}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#2F5233]"
                        >
                            {[1, 2].map(n => <option key={n} value={n} className="text-black">{n}가족</option>)}
                        </select>
                        {familyCount > 1 && <p className="text-xs text-yellow-400 mt-1">+35,000원/박 (추가 가족)</p>}
                    </div>
                    <div>
                        <label className="block text-sm text-white/70 mb-1">방문객 수</label>
                        <input
                            type="number"
                            min={0}
                            value={visitorCount}
                            onChange={(e) => setVisitorCount(parseInt(e.target.value) || 0)}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#2F5233]"
                        />
                        {visitorCount > 0 && <p className="text-xs text-yellow-400 mt-1">+10,000원/인</p>}
                    </div>
                    <div>
                        <label className="block text-sm text-white/70 mb-1">차량 수</label>
                        <select
                            value={vehicleCount}
                            onChange={(e) => setVehicleCount(parseInt(e.target.value))}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#2F5233]"
                        >
                            {[1, 2, 3, 4].map(n => <option key={n} value={n} className="text-black">{n}대</option>)}
                        </select>
                    </div>
                </div>

                {/* Requests */}
                <div>
                    <label className="block text-sm text-white/70 mb-1">요청사항</label>
                    <textarea
                        value={requests}
                        onChange={(e) => setRequests(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#2F5233] h-20 resize-none"
                        placeholder="관리자에게 전달할 내용이 있다면 적어주세요."
                    />
                </div>


                {/* Agreement - 체크박스 클릭 시 Dialog 열기 */}
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="agreement"
                        checked={agreed}
                        onChange={(e) => {
                            // 체크하려고 할 때는 Dialog 열기 (확인 후 체크)
                            if (e.target.checked) {
                                setTermsDialogOpen(true);
                            } else {
                                // 체크 해제는 바로 가능
                                setAgreed(false);
                            }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-[#2F5233] focus:ring-[#2F5233] cursor-pointer"
                    />
                    <span
                        className="text-sm text-white/80 cursor-pointer select-none"
                        onClick={() => !agreed && setTermsDialogOpen(true)}
                    >
                        [필수] 이용 규정 및 환불 규정에 동의합니다.
                    </span>
                </div>

                {/* Price Breakdown & Submit */}
                <div className="pt-4 border-t border-white/10 mt-4 space-y-3">
                    {priceBreakdown && (
                        <div className="text-sm text-white/70 space-y-1">
                            <div className="flex justify-between">
                                <span>기본 요금 ({nights}박)</span>
                                <span>{priceBreakdown.basePrice.toLocaleString()}원</span>
                            </div>
                            {priceBreakdown.options.extraFamily > 0 && (
                                <div className="flex justify-between text-yellow-400">
                                    <span>추가 가족</span>
                                    <span>+{priceBreakdown.options.extraFamily.toLocaleString()}원</span>
                                </div>
                            )}
                            {priceBreakdown.options.visitor > 0 && (
                                <div className="flex justify-between text-yellow-400">
                                    <span>방문객</span>
                                    <span>+{priceBreakdown.options.visitor.toLocaleString()}원</span>
                                </div>
                            )}
                            {priceBreakdown.discount.pkg > 0 && (
                                <div className="flex justify-between text-green-400">
                                    <span>2박 패키지 할인</span>
                                    <span>-{priceBreakdown.discount.pkg.toLocaleString()}원</span>
                                </div>
                            )}
                            {priceBreakdown.discount.consecutive > 0 && (
                                <div className="flex justify-between text-green-400">
                                    <span>연박 할인</span>
                                    <span>-{priceBreakdown.discount.consecutive.toLocaleString()}원</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-between text-white pt-2 border-t border-white/5">
                        <span className="text-lg font-bold">총 결제 금액</span>
                        <span className="font-bold text-2xl text-[#C3A675]">
                            {totalPrice.toLocaleString()}원
                        </span>
                    </div>

                    <button
                        type="submit"
                        disabled={!fromDate || !toDate || !agreed}
                        className="w-full bg-[#2F5233] hover:bg-[#233e26] text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        예약 신청하기 (입금 대기)
                    </button>

                    <div className="text-center text-xs text-white/50 mt-4">
                        <p className="mb-1">입금 계좌: <span className="text-[#C3A675] font-bold">
                            {siteConfig ? `${siteConfig.bankName} ${siteConfig.bankAccount}` : '로딩중...'}
                        </span> (예금주: {siteConfig?.bankHolder || '라온아이'})</p>
                        <p>예약 신청 후 <span className="text-white/80">6시간 내</span> 미입금 시 자동 취소됩니다.</p>
                    </div>
                </div>
            </form>

            {/* Terms Agreement Dialog */}
            <TermsAgreementDialog
                open={termsDialogOpen}
                onOpenChange={setTermsDialogOpen}
                onAgree={() => setAgreed(true)}
                rulesText={fullConfig?.rules_guide_text || ''}
                refundRulesText={fullConfig?.refund_rules_text || ''}
            />
        </>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { useReservationStore } from '@/store/useReservationStore';
import { useRouter } from 'next/navigation';
import { Site } from '@/types/reservation';

interface ReservationFormProps {
    site: Site;
}

export default function ReservationForm({ site }: ReservationFormProps) {
    const router = useRouter();
    // Use calculatePrice instead of calculateTotalPrice
    const { selectedDateRange, addReservation, setSelectedSite, calculatePrice } = useReservationStore();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [familyCount, setFamilyCount] = useState(1);
    const [visitorCount, setVisitorCount] = useState(0);
    const [vehicleCount, setVehicleCount] = useState(1);
    const [requests, setRequests] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        setSelectedSite(site);
    }, [site, setSelectedSite]);

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fromDate || !toDate) {
            alert('날짜를 선택해주세요.');
            return;
        }
        if (!agreed) {
            alert('이용 규정에 동의해주세요.');
            return;
        }

        addReservation({
            id: Math.random().toString(36).substr(2, 9),
            userId: 'guest',
            siteId: site.id,
            checkInDate: fromDate,
            checkOutDate: toDate,
            familyCount,
            visitorCount,
            vehicleCount,
            guests: (familyCount * 4) + visitorCount,
            totalPrice,
            status: 'PENDING',
            requests,
            createdAt: new Date(),
        });

        router.push('/reservation/complete');
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

            {/* Agreement */}
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="agreement"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-[#2F5233] focus:ring-[#2F5233]"
                />
                <label htmlFor="agreement" className="text-sm text-white/80 select-none cursor-pointer">
                    [필수] 이용 규정 및 환불 규정에 동의합니다.
                </label>
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
                        {priceBreakdown.discount.package > 0 && (
                            <div className="flex justify-between text-green-400">
                                <span>2박 패키지 할인</span>
                                <span>-{priceBreakdown.discount.package.toLocaleString()}원</span>
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
            </div>
        </form>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { useReservationStore } from '@/store/useReservationStore';
import { useRouter } from 'next/navigation';
import { Site } from '@/types/reservation';
import TermsAgreementDialog from './TermsAgreementDialog';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { dispatchPersonaAction } from '@/lib/persona';
import { createClient } from '@/lib/supabase-client';
import { getCampingProfile, saveCampingProfile } from '@/actions/camping-profile';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ReservationFormProps {
    site: Site;
}

export default function ReservationForm({ site }: ReservationFormProps) {
    const router = useRouter();
    // Use calculatePrice instead of calculateTotalPrice
    const { selectedDateRange, setSelectedSite, calculatePrice, validateReservation, siteConfig, fetchSiteConfig, createReservationSafe, rebookData, clearRebookData, fetchUserContactInfo, userContactInfo, sites, reservations } = useReservationStore();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [familyCount, setFamilyCount] = useState(1);
    const [visitorCount, setVisitorCount] = useState(0);
    const [vehicleCount, setVehicleCount] = useState(1);

    // [Phase 1: Smart Camping Plan] 세분화된 인원
    const [adults, setAdults] = useState(2);
    const [seniors, setSeniors] = useState(0);
    const [kidsPreschool, setKidsPreschool] = useState(0);
    const [kidsElementary, setKidsElementary] = useState(0);
    const [kidsTeen, setKidsTeen] = useState(0);
    const [hasPet, setHasPet] = useState(false);

    const [requests, setRequests] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [termsDialogOpen, setTermsDialogOpen] = useState(false);
    const { config: fullConfig } = useSiteConfig();

    // 에어컨 선택 전용 상태
    const [airOptions, setAirOptions] = useState<{ id: string; name: string; available: boolean }[]>([]);
    const [selectedAirId, setSelectedAirId] = useState('');

    useEffect(() => {
        setIsMounted(true);
        setSelectedSite(site);
        fetchSiteConfig();

        const loadInitialData = async () => {
            // 0. 2차 실시간 예약 가능 여부 검증 (Double Guard - 가상 대표 카드는 우회)
            if (site.id !== 'air-group' && selectedDateRange.from && selectedDateRange.to) {
                const supabaseClient = createClient();
                const checkInStr = format(new Date(selectedDateRange.from), 'yyyy-MM-dd');
                const checkOutStr = format(new Date(selectedDateRange.to), 'yyyy-MM-dd');

                try {
                    const { data: overlapping, error: checkErr } = await supabaseClient
                        .from('reservations')
                        .select('id')
                        .eq('site_id', site.id)
                        .neq('status', 'CANCELLED')
                        .lt('check_in_date', checkOutStr)
                        .gt('check_out_date', checkInStr);

                    if (checkErr) {
                        console.error('[ReservationForm] Real-time check error', checkErr);
                    }

                    if (overlapping && overlapping.length > 0) {
                        toast.error('죄송합니다. 방금 다른 분이 먼저 이 사이트의 예약을 선점하셨습니다.');
                        router.push('/reservation');
                        return;
                    }
                } catch (err) {
                    console.error('[ReservationForm] Real-time validation catch error', err);
                }
            }

            // 1. 공통 캠핑 프로필 로드 (최우선순위)
            try {
                const profile = await getCampingProfile();
                if (profile) {
                    setAdults(profile.adults);
                    setSeniors(profile.seniors || 0);
                    setKidsPreschool(profile.kidsPreschool);
                    setKidsElementary(profile.kidsElementary);
                    setKidsTeen(profile.kidsTeen);
                    setHasPet(profile.hasPet);
                }
            } catch (err) {
                console.error('[ReservationForm] Profile load failed', err);
            }

            // 2. 예약자 기본 연락처 정보 로드
            fetchUserContactInfo();

            // 3. 재예약(Re-book) 데이터가 있으면 특정 필드 덮어쓰기 (성함, 연락처 등)
            if (rebookData) {
                setFamilyCount(rebookData.familyCount);
                setVisitorCount(rebookData.visitorCount);
                setVehicleCount(rebookData.vehicleCount);
                if (rebookData.guestName) setName(rebookData.guestName);
                if (rebookData.guestPhone) setPhone(rebookData.guestPhone);
                
                // 재예약 데이터에 상세 인원 정보가 포함되어 있다면 덮어씀 (예약별 특수성 반영)
                if (rebookData.guestDetails) {
                    if (rebookData.guestDetails.adults !== undefined) setAdults(rebookData.guestDetails.adults);
                    if (rebookData.guestDetails.seniors !== undefined) setSeniors(rebookData.guestDetails.seniors);
                    if (rebookData.guestDetails.kids) {
                        if (rebookData.guestDetails.kids.preschool !== undefined) setKidsPreschool(rebookData.guestDetails.kids.preschool);
                        if (rebookData.guestDetails.kids.elementary !== undefined) setKidsElementary(rebookData.guestDetails.kids.elementary);
                        if (rebookData.guestDetails.kids.teen !== undefined) setKidsTeen(rebookData.guestDetails.kids.teen);
                    }
                    if (rebookData.guestDetails.hasPet !== undefined) setHasPet(rebookData.guestDetails.hasPet);
                }
            }
        };

        loadInitialData();

        // 언마운트 시 rebookData 클리어
        return () => {
            clearRebookData();
        };
    }, [site, setSelectedSite, fetchSiteConfig, rebookData, clearRebookData, fetchUserContactInfo]);

    // userContactInfo가 로드되면 폼에 적용 (이미 입력된 값이 없을 때만)
    useEffect(() => {
        if (!rebookData && userContactInfo) {
            if (!name && userContactInfo.guestName) setName(name => name || userContactInfo.guestName);
            if (!phone && userContactInfo.guestPhone) setPhone(phone => phone || userContactInfo.guestPhone);
        }
    }, [userContactInfo, rebookData]);

    // 에어컨 가용 번호 조회 및 자동 선택 연동
    useEffect(() => {
        if (site.id === 'air-group' && selectedDateRange.from && selectedDateRange.to) {
            const checkIn = new Date(selectedDateRange.from);
            const checkOut = new Date(selectedDateRange.to);

            const options = sites
                .filter(s => s.id.startsWith('air-') && s.id !== 'air-group' && s.isActive)
                .map(s => {
                    const hasOverlap = reservations.some(r => {
                        if (r.siteId !== s.id || r.status === 'CANCELLED') return false;
                        const rCheckIn = new Date(r.checkInDate);
                        const rCheckOut = new Date(r.checkOutDate);
                        return rCheckIn < checkOut && rCheckOut > checkIn;
                    });
                    return {
                        id: s.id,
                        name: s.name,
                        available: !hasOverlap
                    };
                });
            setAirOptions(options);

            const firstAvail = options.find(o => o.available);
            if (firstAvail) {
                setSelectedAirId(firstAvail.id);
            } else {
                setSelectedAirId('');
            }
        }
    }, [site, selectedDateRange, sites, reservations]);

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
        if (!fromDate || !toDate || fromDate.getTime() === toDate.getTime()) {
            toast.error('퇴실일을 선택하세요.');
            return;
        }
        if (!agreed) {
            toast.error('이용 규정에 동의해주세요.');
            return;
        }
        if (!name.trim()) {
            toast.error('예약자 성함을 입력해주세요.');
            return;
        }
        if (!phone.trim()) {
            toast.error('연락처를 입력해주세요.');
            return;
        }

        const targetSiteId = site.id === 'air-group' ? selectedAirId : site.id;
        
        if (site.id === 'air-group' && !targetSiteId) {
            toast.error('대여할 에어컨 기기 번호를 선택해 주세요.');
            return;
        }

        const validationError = validateReservation(targetSiteId, fromDate, toDate);
        if (validationError) {
            toast.error(validationError);
            return;
        }

        try {
            // 동시성 제어가 적용된 안전한 예약 생성 (DB RPC)
            const result = await createReservationSafe({
                siteId: targetSiteId,
                checkIn: fromDate,
                checkOut: toDate,
                familyCount,
                visitorCount,
                vehicleCount,
                totalPrice,
                guestName: name,
                guestPhone: phone,
                requests: requests || undefined,
                guestDetails: {
                    adults,
                    seniors,
                    kids: {
                        preschool: kidsPreschool,
                        elementary: kidsElementary,
                        teen: kidsTeen,
                    },
                    hasPet
                }
            });

            if (result.success) {
                // 캠핑 프로필 동기화 (Awaited for stability) — 인원 구성 정보 업데이트
                try {
                    await saveCampingProfile({
                        originLabel: null, originLat: null, originLng: null,
                        adults, seniors, kidsPreschool, kidsElementary, kidsTeen, hasPet,
                    });
                } catch (saveErr) {
                    console.error('[ReservationForm] Profile sync failed', saveErr);
                }

                // [Phase 2] Dispatch Persona Actions safely in the background
                try {
                    const supabase = createClient();
                    const { data: { session } } = await supabase.auth.getSession();
                    const userId = session?.user?.id;
                    if (userId) {
                        if (kidsPreschool > 0 || kidsElementary > 0) {
                            dispatchPersonaAction(userId, 'RESERVATION_KIDS_INCLUDED').catch(console.error);
                        }
                        if (hasPet) {
                            dispatchPersonaAction(userId, 'RESERVATION_PET_INCLUDED').catch(console.error);
                        }
                        if (familyCount > 1) {
                            dispatchPersonaAction(userId, 'RESERVATION_FAMILY_ADDED').catch(console.error);
                        }
                        if (nights >= 2) {
                            dispatchPersonaAction(userId, 'RESERVATION_MULTIPLE_NIGHTS').catch(console.error);
                        }
                        if (adults === 1 && (kidsPreschool + kidsElementary + kidsTeen) === 0 && familyCount === 1) {
                            dispatchPersonaAction(userId, 'RESERVATION_SOLO_CAMPER').catch(console.error);
                        }
                        const dayOfWeekIn = fromDate.getDay();
                        const dayOfWeekOut = toDate.getDay();
                        // 주말 판단: 금(5), 토(6), 일(0)
                        const isWeekend = [0, 5, 6].includes(dayOfWeekIn) || [0, 5, 6].includes(dayOfWeekOut);
                        if (isWeekend) {
                            dispatchPersonaAction(userId, 'RESERVATION_WEEKEND_PEAK').catch(console.error);
                        } else {
                            dispatchPersonaAction(userId, 'RESERVATION_WEEKDAY_LEISURE').catch(console.error);
                        }
                    }
                } catch (err) {
                    console.error('[Persona] Failed to dispatch reservation actions', err);
                }

                router.push('/reservation/complete');
            } else {
                // 동시성 충돌 또는 중복 예약
                if (result.error === 'ALREADY_BOOKED') {
                    toast.error('죄송합니다. 방금 다른 분이 먼저 예약을 완료했습니다.\n다른 날짜를 선택해주세요.');
                } else if (result.error === 'CONCURRENT_REQUEST') {
                    toast.error('다른 예약이 처리 중입니다. 잠시 후 다시 시도해주세요.');
                } else {
                    toast.error(result.message || '예약 중 오류가 발생했습니다.');
                }
            }
        } catch (error: any) {
            toast.error(error.message || '예약 중 오류가 발생했습니다.');
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

                {/* 에어컨 기기 선택 UI (2-Step) */}
                {site.id === 'air-group' && (
                    <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/10 mb-6">
                        <label className="block text-sm font-bold text-white/90">대여할 에어컨 기기 번호 선택</label>
                        <div className="grid grid-cols-4 gap-2">
                            {airOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    disabled={!opt.available}
                                    onClick={() => setSelectedAirId(opt.id)}
                                    className={`
                                        h-12 text-sm font-semibold rounded-lg border transition-all flex items-center justify-center touch-manipulation
                                        ${!opt.available 
                                            ? 'bg-red-950/20 text-red-400/60 border-red-900/30 cursor-not-allowed opacity-30 line-through' 
                                            : selectedAirId === opt.id
                                                ? 'bg-[#2F5233] text-white border-[#2F5233] ring-2 ring-[#2F5233]/30 shadow-md'
                                                : 'bg-white/10 text-white/90 border-white/20 hover:bg-white/20 active:scale-[0.97]'
                                        }
                                    `}
                                >
                                    {opt.name.replace('에어컨 ', '')}
                                </button>
                            ))}
                        </div>
                        {selectedAirId ? (
                            <p className="text-xs text-green-400">✓ 선택된 기기: {airOptions.find(o => o.id === selectedAirId)?.name} (예약 가능)</p>
                        ) : (
                            <p className="text-xs text-red-400">⚠️ 선택한 일정에 대여 가능한 에어컨 기기가 없습니다.</p>
                        )}
                    </div>
                )}

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

                {/* [Phase 1: Smart Camping Plan] 세분화된 인원 정보 */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                    <h4 className="text-sm font-bold text-white mb-2">상세 인원 구성 <span className="text-xs font-normal text-white/50">(스마트 추천용)</span></h4>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-white/70 mb-1">성인</label>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setAdults(Math.max(0, adults - 1))} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/20">-</button>
                                <span className="text-white flex-1 text-center">{adults}명</span>
                                <button type="button" onClick={() => setAdults(adults + 1)} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/20">+</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-white/70 mb-1">부모님/어르신</label>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setSeniors(Math.max(0, seniors - 1))} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/20">-</button>
                                <span className="text-white flex-1 text-center">{seniors}명</span>
                                <button type="button" onClick={() => setSeniors(seniors + 1)} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/20">+</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-white/70 mb-1">미취학 아동</label>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setKidsPreschool(Math.max(0, kidsPreschool - 1))} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/20">-</button>
                                <span className="text-white flex-1 text-center">{kidsPreschool}명</span>
                                <button type="button" onClick={() => setKidsPreschool(kidsPreschool + 1)} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/20">+</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-white/70 mb-1">초등학생</label>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setKidsElementary(Math.max(0, kidsElementary - 1))} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/20">-</button>
                                <span className="text-white flex-1 text-center">{kidsElementary}명</span>
                                <button type="button" onClick={() => setKidsElementary(kidsElementary + 1)} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/20">+</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-white/70 mb-1">청소년</label>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setKidsTeen(Math.max(0, kidsTeen - 1))} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/20">-</button>
                                <span className="text-white flex-1 text-center">{kidsTeen}명</span>
                                <button type="button" onClick={() => setKidsTeen(kidsTeen + 1)} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/20">+</button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 bg-white/5 p-3 rounded-lg border border-white/10">
                        <input
                            type="checkbox"
                            id="hasPet"
                            checked={hasPet}
                            onChange={(e) => setHasPet(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-[#2F5233] focus:ring-[#2F5233] cursor-pointer"
                        />
                        <label htmlFor="hasPet" className="text-sm text-white/80 cursor-pointer select-none">
                            🐾 반려견과 함께 방문합니다. <span className="text-xs text-white/50 ml-1">(현재 사이트 규정에 따름)</span>
                        </label>
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
                        disabled={!fromDate || !toDate || fromDate.getTime() === toDate.getTime() || !agreed}
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

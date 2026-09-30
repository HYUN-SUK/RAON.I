'use client';

import { useReservationStore } from '@/store/useReservationStore';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { useEffect, useState } from 'react';
import { Site } from '@/types/reservation';
import WaitlistButton from './WaitlistButton';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function SiteList() {
    const router = useRouter();
    const { selectedSite, setSelectedSite, selectedDateRange, reservations, calculatePrice, sites, fetchSites } = useReservationStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
        fetchSites(); // 실시간 DB 사이트 상태 동기화
    }, [fetchSites]);

    // Check availability based on reservations and rules
    const isSiteAvailable = (siteId: string) => {
        if (!selectedDateRange.from || !selectedDateRange.to) return true;

        const checkIn = new Date(selectedDateRange.from);
        const checkOut = new Date(selectedDateRange.to);

        // 1. Check for overlapping reservations
        const hasOverlap = reservations.some(r => {
            if (r.siteId !== siteId || r.status === 'CANCELLED' || r.status === 'REFUNDED' || r.status === 'REFUND_PENDING') return false;
            const rCheckIn = new Date(r.checkInDate);
            const rCheckOut = new Date(r.checkOutDate);
            return rCheckIn < checkOut && rCheckOut > checkIn;
        });

        if (hasOverlap) return false;

        // 2. Check End-cap Rule (Friday 1-night) & Start-cap Rule (Saturday 1-night)
        // If selecting Fri-Sat (1 night) or Sat-Sun (1 night), check rules.
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        const isFri = checkIn.getDay() === 5;
        const isSat = checkIn.getDay() === 6;

        if ((isFri || isSat) && nights < 2) {
            // Check D-N
            const D_N_DAYS = 7; // Should import this, but hardcoding for now to match rule
            const diffDays = Math.ceil((checkIn.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
            const isWithinDN = diffDays <= D_N_DAYS;

            if (isWithinDN) return true; // Allowed by D-N

            if (isFri) {
                // Check End-cap (Is Saturday booked?)
                const nextDay = new Date(checkIn);
                nextDay.setDate(checkIn.getDate() + 1);

                const isSaturdayBooked = reservations.some(r => {
                    if (r.siteId !== siteId || r.status === 'CANCELLED' || r.status === 'REFUNDED' || r.status === 'REFUND_PENDING') return false;
                    const rCheckIn = new Date(r.checkInDate);
                    const rCheckOut = new Date(r.checkOutDate);
                    return rCheckIn <= nextDay && rCheckOut > nextDay;
                });

                // If Saturday is NOT booked, then this 1-night reservation is blocked by the 2-night rule
                if (!isSaturdayBooked) return false;
            } else if (isSat) {
                // Check Start-cap (Is Friday booked?)
                const prevDay = new Date(checkIn);
                prevDay.setDate(checkIn.getDate() - 1);

                const isFridayBooked = reservations.some(r => {
                    if (r.siteId !== siteId || r.status === 'CANCELLED' || r.status === 'REFUNDED' || r.status === 'REFUND_PENDING') return false;
                    const rCheckIn = new Date(r.checkInDate);
                    const rCheckOut = new Date(r.checkOutDate);
                    return rCheckIn <= prevDay && rCheckOut > prevDay;
                });

                // If Friday is NOT booked, then this 1-night reservation is blocked by the 2-night rule
                if (!isFridayBooked) return false;
            }
        }

        return true;
    };

    const isAirGroupAvailable = () => {
        const airSites = sites.filter(s => s.id.startsWith('air-') && s.isActive !== false);
        if (airSites.length === 0) return false;
        return airSites.some(s => isSiteAvailable(s.id));
    };

    const isAvailableExtended = (siteId: string) => {
        if (siteId === 'air-group') {
            return isAirGroupAvailable();
        }
        return isSiteAvailable(siteId);
    };

    // 1. 운영 활성화된(isActive !== false) 사이트만 필터링 (기본값 true)
    const activeSites = sites.filter(s => s.isActive !== false);

    // 2. 일반 사이트와 에어컨 대표 사이트 필터링
    // air-1 ~ air-8 개별 기기들은 사용자 사이트 목록에서 노출 제외 (상세 화면에서 기기 번호를 2-Step으로 선택하므로)
    const normalSites = activeSites.filter(s => !s.id.startsWith('air-'));
    const airGroupInDb = activeSites.find(s => s.id === 'air-group');

    const finalSitesToRender = [...normalSites];
    if (airGroupInDb) {
        finalSitesToRender.push(airGroupInDb);
    }

    const sortedSites = finalSitesToRender.sort((a, b) => {
        const aAvailable = isAvailableExtended(a.id);
        const bAvailable = isAvailableExtended(b.id);
        if (aAvailable === bAvailable) return 0;
        return aAvailable ? -1 : 1;
    });

    const handleSiteClick = (site: Site) => {
        // 0-night validation (Check-in == Check-out or no Check-out)
        if (!selectedDateRange.from || !selectedDateRange.to || new Date(selectedDateRange.from).getTime() === new Date(selectedDateRange.to).getTime()) {
            toast.error('퇴실일을 선택하세요');
            return;
        }

        if (!isAvailableExtended(site.id)) {
            toast.error('선택하신 날짜에 예약할 수 없는 사이트입니다.');
            return;
        }

        setSelectedSite(site);
        router.push(`/reservation/${site.id}`);
    };

    const getPriceDisplay = (site: Site) => {
        if (!mounted || !selectedDateRange.from || !selectedDateRange.to) {
            return `${site.price.toLocaleString()}원 / 1박`;
        }

        const fromDate = new Date(selectedDateRange.from);
        const toDate = new Date(selectedDateRange.to);

        // Validate dates
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            return `${site.price.toLocaleString()}원 / 1박`;
        }

        const prices: number[] = [];
        const oneDay = 24 * 60 * 60 * 1000;
        const start = fromDate.getTime();
        const end = toDate.getTime();
        const nights = Math.ceil((end - start) / oneDay);

        if (nights <= 0) return `${site.price.toLocaleString()}원 / 1박`;

        for (let i = 0; i < nights; i++) {
            const currentCheckIn = new Date(start + (i * oneDay));
            const currentCheckOut = new Date(start + ((i + 1) * oneDay));
            // Calculate price for 1 night, 1 family, 0 visitors
            const price = calculatePrice(site, currentCheckIn, currentCheckOut, 1, 0).totalPrice;
            prices.push(price);
        }

        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        if (minPrice === maxPrice) {
            return `${minPrice.toLocaleString()}원 / 1박`;
        } else {
            return `${minPrice.toLocaleString()}원 ~ ${maxPrice.toLocaleString()}원 / 1박`;
        }
    };

    return (
        <div className="grid grid-cols-2 gap-3.5 pb-20">
            {sortedSites.map((site) => {
                const available = isAvailableExtended(site.id);
                const priceText = getPriceDisplay(site);

                return (
                    <div
                        key={site.id}
                        onClick={() => handleSiteClick(site)}
                        className={`
            relative overflow-hidden rounded-3xl border transition-all duration-150 group bg-white shadow-xs touch-manipulation
            ${available ? 'cursor-pointer hover:shadow-md hover:border-[#68A678] hover:-translate-y-0.5 active:scale-[0.98] active:brightness-95' : 'cursor-not-allowed opacity-75'}
            ${selectedSite?.id === site.id
                                ? 'border-[#2E7D47] ring-2 ring-[#2E7D47]/25'
                                : 'border-[#EAEFEA]'}
          `}
                    >

                        <div className={`relative h-44 w-full ${!available ? 'grayscale' : ''}`}>
                            <Image
                                src={site.imageUrl}
                                alt={site.name}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                            <div className="absolute bottom-3 left-3.5 right-3.5 text-white">
                                <h3 className="text-lg font-black tracking-tight drop-shadow-sm">{site.name}</h3>
                            </div>
                            <div className="absolute top-3 left-3 right-3 flex justify-between items-center pointer-events-none">
                                <span className="bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full text-xs text-[#2E7D47] font-bold shadow-xs flex items-center gap-1">
                                    ⚡ {site.type}
                                </span>
                                {!available && (
                                    <span className="bg-[#E06B62] px-2 py-0.5 rounded-full text-[11px] text-white font-bold shadow-xs">
                                        마감
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="p-3.5">
                            {/* 가격 배지 (웜 크림 골드) */}
                            <div className="bg-[#FBEFD9] text-[#9A6B2F] font-black text-xs px-2.5 py-1 rounded-lg w-fit mb-2">
                                {priceText}
                            </div>
                            <p className="text-xs text-[#556B5C] mb-2.5 line-clamp-2 leading-relaxed font-normal">{site.description}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {site.features.map((feature, idx) => (
                                    <span key={idx} className="text-[11px] px-2 py-0.5 rounded-md bg-[#EBF3ED] text-[#2D5A3D] font-semibold">
                                        {feature}
                                    </span>
                                ))}
                            </div>

                            {/* 개별 사이트 빈자리 알림 버튼 */}
                            {!available && selectedDateRange.from && (
                                <div className="mt-3 pt-2.5 border-t border-[#F0F4F1]" onClick={(e) => e.stopPropagation()}>
                                    <p className="text-[11px] text-[#7A8B7E] mb-1.5 text-center font-medium">
                                        이 사이트에 빈자리가 나면 알려드릴게요!
                                    </p>
                                    <WaitlistButton
                                        targetDate={format(selectedDateRange.from, 'yyyy-MM-dd')}
                                        siteId={site.id}
                                        siteName={site.name}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    );
}

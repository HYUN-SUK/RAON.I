'use client';

import { SITES } from '@/constants/sites';
import { useReservationStore } from '@/store/useReservationStore';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { useEffect, useState } from 'react';
import { calculatePrice } from '@/utils/pricing';

export default function SiteList() {
    const router = useRouter();
    const { selectedSite, setSelectedSite, selectedDateRange, reservations } = useReservationStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Check availability based on reservations and rules
    const isSiteAvailable = (siteId: string) => {
        if (!selectedDateRange.from || !selectedDateRange.to) return true;

        const checkIn = new Date(selectedDateRange.from);
        const checkOut = new Date(selectedDateRange.to);
        const now = new Date();

        // 1. Check for overlapping reservations
        const hasOverlap = reservations.some(r => {
            if (r.siteId !== siteId || r.status === 'CANCELLED') return false;
            const rCheckIn = new Date(r.checkInDate);
            const rCheckOut = new Date(r.checkOutDate);
            return rCheckIn < checkOut && rCheckOut > checkIn;
        });

        if (hasOverlap) return false;

        // 2. Check End-cap Rule (Friday 1-night)
        // If selecting Fri-Sat (1 night), only allow sites that are:
        // - Booked on Saturday (End-cap)
        // - OR within D-N days (Imminent)
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        const isFri = checkIn.getDay() === 5;

        if (isFri && nights < 2) {
            // Check D-N
            const D_N_DAYS = 7; // Should import this, but hardcoding for now to match rule
            const diffDays = Math.ceil((checkIn.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
            const isWithinDN = diffDays <= D_N_DAYS;

            if (isWithinDN) return true; // Allowed by D-N

            // Check End-cap (Is Saturday booked?)
            const nextDay = new Date(checkIn);
            nextDay.setDate(checkIn.getDate() + 1);

            const isSaturdayBooked = reservations.some(r => {
                if (r.siteId !== siteId || r.status === 'CANCELLED') return false;
                const rCheckIn = new Date(r.checkInDate);
                const rCheckOut = new Date(r.checkOutDate);
                return rCheckIn <= nextDay && rCheckOut > nextDay;
            });

            // If Saturday is NOT booked, then this 1-night reservation is blocked by the 2-night rule
            if (!isSaturdayBooked) return false;
        }

        return true;
    };

    const sortedSites = [...SITES].sort((a, b) => {
        const aAvailable = isSiteAvailable(a.id);
        const bAvailable = isSiteAvailable(b.id);
        if (aAvailable === bAvailable) return 0;
        return aAvailable ? -1 : 1;
    });

    const handleSiteClick = (site: any) => {
        if (!isSiteAvailable(site.id)) {
            alert('선택하신 날짜에 예약할 수 없는 사이트입니다.');
            return;
        }
        setSelectedSite(site);
        router.push(`/reservation/${site.id}`);
    };

    const getPriceDisplay = (site: any) => {
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
            {sortedSites.map((site) => {
                const available = isSiteAvailable(site.id);
                const priceText = getPriceDisplay(site);

                return (
                    <div
                        key={site.id}
                        onClick={() => handleSiteClick(site)}
                        className={`
            relative overflow-hidden rounded-2xl border transition-all duration-300 group
            ${available ? 'cursor-pointer hover:bg-white/10' : 'cursor-not-allowed'}
            ${selectedSite?.id === site.id
                                ? 'border-[#2F5233] ring-2 ring-[#2F5233]/50 bg-white/10'
                                : 'border-white/10 bg-white/5'}
          `}
                    >
                        <div className={`relative h-48 w-full ${!available ? 'grayscale brightness-50' : ''}`}>
                            <Image
                                src={site.imageUrl}
                                alt={site.name}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute bottom-3 left-4 text-white">
                                <h3 className="text-xl font-bold">{site.name}</h3>
                                <p className="text-sm text-white/80">{priceText}</p>
                            </div>
                            <div className="absolute top-3 right-3 flex gap-2">
                                {!available && (
                                    <span className="bg-red-500/80 backdrop-blur-md px-2 py-1 rounded-lg text-xs text-white border border-white/10 font-bold">
                                        마감
                                    </span>
                                )}
                                <span className="bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg text-xs text-white border border-white/10">
                                    {site.type}
                                </span>
                            </div>
                        </div>

                        <div className={`p-4 ${!available ? 'opacity-50' : ''}`}>
                            <p className="text-sm text-white/70 mb-3 line-clamp-2">{site.description}</p>
                            <div className="flex flex-wrap gap-2">
                                {site.features.map((feature, idx) => (
                                    <span key={idx} className="text-xs px-2 py-1 rounded-md bg-white/5 text-white/60 border border-white/5">
                                        {feature}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    );
}

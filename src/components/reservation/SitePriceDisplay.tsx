'use client';

import { useReservationStore } from '@/store/useReservationStore';
import { calculatePrice } from '@/utils/pricing';
import { Site } from '@/types/reservation';
import { useEffect, useState } from 'react';

interface SitePriceDisplayProps {
    site: Site;
}

export default function SitePriceDisplay({ site }: SitePriceDisplayProps) {
    const { selectedDateRange } = useReservationStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const getPriceDisplay = () => {
        if (!mounted || !selectedDateRange.from || !selectedDateRange.to) {
            return `${site.price.toLocaleString()}원`;
        }

        const fromDate = new Date(selectedDateRange.from);
        const toDate = new Date(selectedDateRange.to);

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            return `${site.price.toLocaleString()}원`;
        }

        const prices: number[] = [];
        const oneDay = 24 * 60 * 60 * 1000;
        const start = fromDate.getTime();
        const end = toDate.getTime();
        const nights = Math.ceil((end - start) / oneDay);

        if (nights <= 0) return `${site.price.toLocaleString()}원`;

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
            return `${minPrice.toLocaleString()}원`;
        } else {
            return `${minPrice.toLocaleString()}원 ~ ${maxPrice.toLocaleString()}원`;
        }
    };

    return (
        <p className="text-xl font-bold">{getPriceDisplay()}</p>
    );
}

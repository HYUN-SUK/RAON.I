import { Site, PriceBreakdown } from '@/types/reservation';

// Pricing Constants (SSOT 6.1)
const PRICE_WEEKDAY = 40000;
const PRICE_WEEKEND = 70000; // Fri, Sat, Sun, Holiday
const PRICE_PEAK_WEEKDAY = 50000;
const PRICE_PEAK_WEEKEND = 70000;

const PRICE_EXTRA_GUEST = 35000; // Per family (not person) per night, excluding first family
const PRICE_VISITOR = 10000; // Per person (one-time)
const DISCOUNT_LONG_STAY = 10000; // Per night for long stay (Fri-Sun)

// Mock Season Data (SSOT 6.1 - Seasonality)
const isPeakSeason = (date: Date): boolean => {
    const month = date.getMonth(); // 0-indexed
    return month === 6 || month === 7; // July, August
};

const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 5 || day === 6 || day === 0; // Fri, Sat, Sun
};

export const calculatePrice = (
    site: Site,
    checkIn: Date,
    checkOut: Date,
    familyCount: number,
    visitorCount: number
): PriceBreakdown => {
    const oneDay = 24 * 60 * 60 * 1000;
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / oneDay);

    if (nights <= 0) {
        return {
            basePrice: 0,
            options: { extraFamily: 0, visitor: 0 },
            discount: { consecutive: 0, package: 0 },
            totalPrice: 0,
            nights: 0
        };
    }

    let basePrice = 0;
    let consecutiveDiscount = 0;
    let packageDiscount = 0;

    // 1. Base Price Calculation per Night
    for (let i = 0; i < nights; i++) {
        const currentDate = new Date(checkIn.getTime() + (i * oneDay));
        const isPeak = isPeakSeason(currentDate);
        const isWknd = isWeekend(currentDate);

        if (isWknd) {
            basePrice += isPeak ? PRICE_PEAK_WEEKEND : PRICE_WEEKEND;
        } else {
            basePrice += isPeak ? PRICE_PEAK_WEEKDAY : PRICE_WEEKDAY;
        }
    }

    // 2. Discounts
    // SSOT 5.12: 2-night package (Fri-Sun) -> 130,000 (10k discount)
    // Normal: 70+70=140. Package=130.
    if (checkIn.getDay() === 5 && nights === 2) {
        packageDiscount = 10000;
    }

    // SSOT 6.2.3: Consecutive Stay Discount
    // "10,000 won / per extra night"
    // Applied if not the package?
    // Let's assume package discount takes precedence for Fri-Sun.
    // For other consecutive stays (e.g. Sat-Mon), if applicable.
    // For now, we only implement the explicit package discount to avoid double counting.

    // 3. Extra Costs
    // Extra Family: 35,000 per family per night (excluding the first family)
    const extraFamilyCost = Math.max(0, (familyCount - 1) * PRICE_EXTRA_GUEST * nights);

    // Visitor: 10,000 per person (one-time)
    const visitorCost = visitorCount * PRICE_VISITOR;

    const totalDiscount = packageDiscount + consecutiveDiscount;
    const totalPrice = basePrice + extraFamilyCost + visitorCost - totalDiscount;

    return {
        basePrice,
        options: {
            extraFamily: extraFamilyCost,
            visitor: visitorCost
        },
        discount: {
            consecutive: consecutiveDiscount,
            package: packageDiscount
        },
        totalPrice,
        nights
    };
};

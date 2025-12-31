import { Site, PriceBreakdown, PricingConfig } from '@/types/reservation';

// Helper to check if date is in any peak season
const isPeakSeason = (date: Date, config: PricingConfig): boolean => {
    const month = date.getMonth() + 1; // 1-12
    const day = date.getDate(); // 1-31

    return config.seasons.some(season => {
        // Simple case: start and end in same year
        // e.g. 7.1 ~ 8.31
        if (season.startMonth < season.endMonth) {
            return (month > season.startMonth || (month === season.startMonth && day >= season.startDay)) &&
                (month < season.endMonth || (month === season.endMonth && day <= season.endDay));
        }
        // Cross-year case (if needed, though simple seasons usually fit in year)
        // e.g. 12.20 ~ 2.10
        // ... simplistic implementation for now assuming same-year seasons as per current requirements
        return (month > season.startMonth || (month === season.startMonth && day >= season.startDay)) &&
            (month < season.endMonth || (month === season.endMonth && day <= season.endDay));
    });
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
    visitorCount: number,
    config: PricingConfig
): PriceBreakdown => {
    const oneDay = 24 * 60 * 60 * 1000;
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / oneDay);

    if (nights <= 0) {
        return {
            basePrice: 0,
            options: { extraFamily: 0, visitor: 0 },
            discount: { consecutive: 0, pkg: 0 },
            totalPrice: 0,
            nights: 0
        };
    }

    let basePrice = 0;
    let consecutiveDiscount = 0;
    let pkgDiscount = 0;

    // 1. Base Price Calculation per Night
    for (let i = 0; i < nights; i++) {
        const currentDate = new Date(checkIn.getTime() + (i * oneDay));
        const isPeak = isPeakSeason(currentDate, config);
        const isWknd = isWeekend(currentDate);

        if (isWknd) {
            basePrice += isPeak ? config.peakWeekend : config.weekend;
        } else {
            basePrice += isPeak ? config.peakWeekday : config.weekday;
        }
    }

    // 2. Discounts
    // SSOT 6.2.3: Consecutive Stay Discount
    // Applied if ALL nights are weekend nights (Fri, Sat, Sun).
    let isAllWeekend = true;
    for (let i = 0; i < nights; i++) {
        const currentDate = new Date(checkIn.getTime() + (i * oneDay));
        if (!isWeekend(currentDate)) {
            isAllWeekend = false;
            break;
        }
    }

    if (isAllWeekend && nights >= 2) {
        consecutiveDiscount = (nights - 1) * config.longStayDiscount;
    }

    // 3. Extra Costs
    // Extra Family: per family per night (excluding the first family)
    const extraFamilyCost = Math.max(0, (familyCount - 1) * config.extraFamily * nights);

    // Visitor: per person (one-time)
    const visitorCost = visitorCount * config.visitor;

    const totalDiscount = pkgDiscount + consecutiveDiscount;
    const totalPrice = basePrice + extraFamilyCost + visitorCost - totalDiscount;

    return {
        basePrice,
        options: {
            extraFamily: extraFamilyCost,
            visitor: visitorCost
        },
        discount: {
            consecutive: consecutiveDiscount,
            pkg: pkgDiscount
        },
        totalPrice,
        nights
    };
};

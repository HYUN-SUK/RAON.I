import { Site, PriceBreakdown, PricingConfig } from '@/types/reservation';



import { addDays, format } from 'date-fns';

// Helper to check if date is in any peak season
const isPeakSeason = (date: Date, config: PricingConfig): boolean => {
    const month = date.getMonth() + 1; // 1-12
    const day = date.getDate(); // 1-31

    return config.seasons.some(season => {
        if (season.startMonth < season.endMonth) {
            return (month > season.startMonth || (month === season.startMonth && day >= season.startDay)) &&
                (month < season.endMonth || (month === season.endMonth && day <= season.endDay));
        }
        return (month > season.startMonth || (month === season.startMonth && day >= season.startDay)) &&
            (month < season.endMonth || (month === season.endMonth && day <= season.endDay));
    });
};

const checkIsHoliday = (date: Date, holidays: Set<string>): boolean => {
    if (!holidays || !(holidays instanceof Set)) return false;
    return holidays.has(format(date, 'yyyy-MM-dd'));
};

const checkIsPreHoliday = (date: Date, holidays: Set<string>): boolean => {
    if (!holidays || !(holidays instanceof Set)) return false;
    const nextDay = addDays(date, 1);
    return holidays.has(format(nextDay, 'yyyy-MM-dd'));
};

const isHighDemandDay = (date: Date, holidays: Set<string>): boolean => {
    const day = date.getDay();
    const isFriSatSun = day === 5 || day === 6 || day === 0;

    // User Rule: Weekend / Holiday / Pre-Holiday -> 70,000 (Weekend Price)
    return isFriSatSun || checkIsHoliday(date, holidays) || checkIsPreHoliday(date, holidays);
};

export const calculatePrice = (
    site: Site,
    checkIn: Date,
    checkOut: Date,
    familyCount: number,
    visitorCount: number,
    config: PricingConfig,
    holidays: Set<string> = new Set()
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

    // 0. 에어컨 대여 요금 계산 예외 가드 (1박당 10,000원 고정, 다른 요인 일체 제외)
    if (site.id.startsWith('air-') || site.type === 'AIR_CON' || site.id === 'air-group') {
        const airPrice = 10000 * nights;
        return {
            basePrice: airPrice,
            options: { extraFamily: 0, visitor: 0 },
            discount: { consecutive: 0, pkg: 0 },
            totalPrice: airPrice,
            nights
        };
    }

    let basePrice = 0;
    let consecutiveDiscount = 0;
    const pkgDiscount = 0;

    // 1. Base Price Calculation per Night
    // 일요일 입실 특별 규칙: 입실일(checkIn)이 일요일인 예약에 한해
    // 일요일 날짜를 평일 요금으로 적용. 금/토 입실 예약에서 일요일이
    // 포함되는 경우에는 기존 주말 요금(7만)을 유지한다.
    const checkInDay = checkIn.getDay();
    
    // 개별 사이트 요금 덮어쓰기 적용 (값이 지정되어 있다면 사용, 비어있다면 전체 설정 config 적용)
    const weekday = site.weekday !== undefined && site.weekday !== null ? site.weekday : config.weekday;
    const weekend = site.weekend !== undefined && site.weekend !== null ? site.weekend : config.weekend;
    const peakWeekday = site.peakWeekday !== undefined && site.peakWeekday !== null ? site.peakWeekday : config.peakWeekday;
    const peakWeekend = site.peakWeekend !== undefined && site.peakWeekend !== null ? site.peakWeekend : config.peakWeekend;

    for (let i = 0; i < nights; i++) {
        const currentDate = new Date(checkIn.getTime() + (i * oneDay));
        const isPeak = isPeakSeason(currentDate, config);
        const isHigh = isHighDemandDay(currentDate, holidays);

        // 일요일이면서 입실일이 일요일인 경우 → 평일 취급
        const isSundayAsWeekday = currentDate.getDay() === 0 && checkInDay === 0;

        if (isHigh && !isSundayAsWeekday) {
            basePrice += isPeak ? peakWeekend : weekend;
        } else {
            basePrice += isPeak ? peakWeekday : weekday;
        }
    }

    // 2. Discounts
    // SSOT 6.2.3: Consecutive Stay Discount
    // Applied if ALL nights are High Demand nights (Weekend/Holiday/Pre-Holiday).
    // User Clarification: Holidays count for discount.
    // 2. Discounts
    // SSOT 6.2.3: Consecutive Stay Discount (Modified by User Feedback)
    // Rule: Apply 10,000 KRW discount for EACH pair of consecutive "High Demand" nights.
    // Example: Sat(H)-Sun(H)-Mon(L) -> Sat-Sun is a pair (10k off). Sun-Mon is not. Total 10k discount.

    // We iterate through nights and check i and i+1
    for (let i = 0; i < nights - 1; i++) {
        const currentNightDate = new Date(checkIn.getTime() + (i * oneDay));
        const nextNightDate = new Date(checkIn.getTime() + ((i + 1) * oneDay));

        const isCurrentHigh = isHighDemandDay(currentNightDate, holidays);
        const isNextHigh = isHighDemandDay(nextNightDate, holidays);

        if (isCurrentHigh && isNextHigh) {
            consecutiveDiscount += config.longStayDiscount;
        }
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

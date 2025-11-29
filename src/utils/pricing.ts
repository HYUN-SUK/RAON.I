import { Site } from '@/types/reservation';

// Pricing Constants (SSOT 6.1)
const PRICE_WEEKDAY = 40000;
const PRICE_WEEKEND = 70000; // Fri, Sat, Sun, Holiday
const PRICE_PEAK_WEEKDAY = 50000;
const PRICE_PEAK_WEEKEND = 70000;

const PRICE_EXTRA_GUEST = 35000; // Per person per night
const PRICE_VISITOR = 10000; // Per person (one-time)
const DISCOUNT_LONG_STAY = 10000; // Per night for long stay (Fri-Sun)

// Mock Season Data (SSOT 6.1 - Seasonality)
// For MVP, let's assume July and August are peak seasons.
const isPeakSeason = (date: Date): boolean => {
    const month = date.getMonth(); // 0-indexed
    return month === 6 || month === 7; // July, August
};

const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 5 || day === 6 || day === 0; // Fri, Sat, Sun
};

export const calculateTotalPrice = (
    site: Site,
    checkIn: Date,
    checkOut: Date,
    guests: number,
    visitorCount: number
): number => {
    let totalPrice = 0;
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    if (nights <= 0) return 0;

    // 1. Base Price Calculation per Night
    let currentDate = new Date(checkIn);
    let weekendNights = 0;

    for (let i = 0; i < nights; i++) {
        const isPeak = isPeakSeason(currentDate);
        const isWknd = isWeekend(currentDate);

        if (isWknd) {
            totalPrice += isPeak ? PRICE_PEAK_WEEKEND : PRICE_WEEKEND;
            weekendNights++;
        } else {
            totalPrice += isPeak ? PRICE_PEAK_WEEKDAY : PRICE_WEEKDAY;
        }

        // Advance to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // 2. Extra Guest Fee (SSOT 6.1)
    // Standard capacity is usually 4 (implied in SSOT 6.1 "1 family").
    // If guests > 4, charge extra per night.
    // However, Site interface has maxOccupancy but not baseOccupancy.
    // Let's assume baseOccupancy is 4 for now as per SSOT.
    const BASE_OCCUPANCY = 4;
    if (guests > BASE_OCCUPANCY) {
        const extraGuests = guests - BASE_OCCUPANCY;
        totalPrice += extraGuests * PRICE_EXTRA_GUEST * nights;
    }

    // 3. Visitor Fee (SSOT 6.1)
    // One-time fee per visitor
    if (visitorCount > 0) {
        totalPrice += visitorCount * PRICE_VISITOR;
    }

    // 4. Long Stay Discount (SSOT 6.2.3)
    // Applied to weekend consecutive stays (Fri->Sun implies 2 nights).
    // Logic: If it includes Fri and Sat nights, apply discount.
    // Simple check: if weekendNights >= 2, apply discount for the extra weekend nights?
    // SSOT says "10,000 won / additional night".
    // Let's apply if nights >= 2 and it involves weekend.
    // Refined SSOT 6.2.3: "Weekend consecutive stay (Fri->Sat->Sun)".
    // If checkIn is Fri and nights >= 2, apply discount.
    if (checkIn.getDay() === 5 && nights >= 2) {
        // Discount applies to the 2nd night onwards? SSOT is slightly vague "10,000 / additional 1 night".
        // Usually means 2 nights = -10,000.
        totalPrice -= DISCOUNT_LONG_STAY;
    }

    return totalPrice;
};

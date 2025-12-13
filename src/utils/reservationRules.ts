import { differenceInCalendarDays, isFriday, startOfDay } from 'date-fns';

export const D_N_DAYS = 7;

export interface ReservationRuleResult {
    isFridayOneNight: boolean;
    isWithinDN: boolean;
    isEndCap: boolean;
    isBlocked: boolean;
}

/**
 * Validates reservation rules:
 * 1. Strict Weekend Rule: Friday check-in requires 2+ nights.
 * 2. D-N Exception: If within D-7, Friday 1-night is allowed.
 * 3. End-cap Exception: If Saturday is full OR next day is blocked, Friday 1-night is allowed.
 * 
 * @param from Check-in date
 * @param to Check-out date
 * @param now Current date (default: new Date())
 * @param options Additional conditions (hasEndCapAvailability, isNextDayBlocked)
 * @returns Object containing rule evaluation results
 */
export function checkReservationRules(
    from: Date | undefined,
    to: Date | undefined,
    now: Date = new Date(),
    options: { hasEndCapAvailability?: boolean; isSaturdayFull?: boolean; isNextDayBlocked?: boolean } = {}
): ReservationRuleResult {
    if (!from) {
        return { isFridayOneNight: false, isWithinDN: false, isEndCap: false, isBlocked: false };
    }

    // Calculate nights
    // If 'to' is undefined, nights is 0.
    const nights = (from && to) ? differenceInCalendarDays(to, from) : 0;

    const isFri = isFriday(from);
    const isSat = from.getDay() === 6; // 6 is Saturday

    // Condition: (Friday OR Saturday) Check-in AND (Selection is incomplete OR Selection is less than 2 nights)
    const isWeekendOneNight = (isFri || isSat) && nights < 2;

    // D-N Calculation
    // We compare start of days to avoid time issues
    const currentDay = startOfDay(now);
    const checkInDay = startOfDay(from);
    const diffDays = differenceInCalendarDays(checkInDay, currentDay);

    const isWithinDN = diffDays <= D_N_DAYS;

    // End-cap Calculation (Friday only)
    // "End-cap" at this high level mainly determines if we should unblock the SITE LIST.
    // Individual sites are checked in SiteList component.
    const isEndCap = isFri && (options.hasEndCapAvailability || options.isSaturdayFull || options.isNextDayBlocked || false);

    // Blocked if: Weekend 1-night attempt AND NOT within D-N exception AND NOT End-cap exception
    const isBlocked = isWeekendOneNight && !isWithinDN && !isEndCap;

    return {
        isFridayOneNight: isWeekendOneNight, // Mapped for compatibility
        isWithinDN,
        isEndCap,
        isBlocked
    };
}

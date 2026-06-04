import { differenceInCalendarDays, isFriday, startOfDay } from 'date-fns';

export const D_N_DAYS = 7;

export interface ReservationRuleResult {
    isFridayOneNight: boolean;
    isWithinDN: boolean;
    isEndCap: boolean;
    isStartCap: boolean;
    isBlocked: boolean;
    isNightsZero: boolean;
}

/**
 * Validates reservation rules:
 * 1. Strict Weekend Rule: Friday check-in requires 2+ nights.
 * 2. D-N Exception: If within D-7, Friday 1-night is allowed.
 * 3. End-cap Exception: If Saturday is full OR next day is blocked, Friday 1-night is allowed.
 * 4. Start-cap Exception: If Friday is full OR previous day is blocked, Saturday 1-night is allowed.
 * 5. General Rule: 1+ night required (check-in != check-out).
 * 
 * @param from Check-in date
 * @param to Check-out date
 * @param now Current date (default: new Date())
 * @param options Additional conditions (hasEndCapAvailability, isSaturdayFull, isNextDayBlocked, hasStartCapAvailability, isFridayFull, isPrevDayBlocked)
 * @returns Object containing rule evaluation results
 */
export function checkReservationRules(
    from: Date | undefined,
    to: Date | undefined,
    now: Date = new Date(),
    options: { 
        hasEndCapAvailability?: boolean; 
        isSaturdayFull?: boolean; 
        isNextDayBlocked?: boolean;
        hasStartCapAvailability?: boolean;
        isFridayFull?: boolean;
        isPrevDayBlocked?: boolean;
    } = {}
): ReservationRuleResult {
    if (!from) {
        return { isFridayOneNight: false, isWithinDN: false, isEndCap: false, isStartCap: false, isBlocked: false, isNightsZero: true };
    }

    // Calculate nights
    const nights = (from && to) ? differenceInCalendarDays(to, from) : 0;
    const isNightsZero = nights < 1;

    const isFri = isFriday(from);
    const isSat = from.getDay() === 6; // 6 is Saturday

    // Condition: (Friday OR Saturday) Check-in AND (Selection is incomplete OR Selection is less than 2 nights)
    const isWeekendOneNight = (isFri || isSat) && (nights > 0 && nights < 2);

    // D-N Calculation
    const currentDay = startOfDay(now);
    const checkInDay = startOfDay(from);
    const diffDays = differenceInCalendarDays(checkInDay, currentDay);

    const isWithinDN = diffDays <= D_N_DAYS;

    // End-cap Calculation (Friday only)
    const isEndCap = isFri && (options.hasEndCapAvailability || options.isSaturdayFull || options.isNextDayBlocked || false);

    // Start-cap Calculation (Saturday only)
    const isStartCap = isSat && (options.hasStartCapAvailability || options.isFridayFull || options.isPrevDayBlocked || false);

    // Blocked if: Weekend 1-night attempt AND NOT within D-N exception AND NOT End-cap exception AND NOT Start-cap exception
    // OR if nights is zero (incomplete range)
    const isBlocked = (isWeekendOneNight && !isWithinDN && !isEndCap && !isStartCap);

    return {
        isFridayOneNight: isWeekendOneNight,
        isWithinDN,
        isEndCap,
        isStartCap,
        isBlocked,
        isNightsZero
    };
}

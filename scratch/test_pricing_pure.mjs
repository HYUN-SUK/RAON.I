import { addDays, format } from 'date-fns';

const isPeakSeason = (date, config) => {
    if (!config || !Array.isArray(config.seasons)) return false;
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return config.seasons.some(season => {
        const startMonth = Number(season.startMonth);
        const startDay = Number(season.startDay);
        const endMonth = Number(season.endMonth);
        const endDay = Number(season.endDay);

        return (month > startMonth || (month === startMonth && day >= startDay)) &&
            (month < endMonth || (month === endMonth && day <= endDay));
    });
};

const checkIsHoliday = (date, holidays) => {
    if (!holidays || !(holidays instanceof Set)) return false;
    return holidays.has(format(date, 'yyyy-MM-dd'));
};

const checkIsPreHoliday = (date, holidays) => {
    if (!holidays || !(holidays instanceof Set)) return false;
    const nextDay = addDays(date, 1);
    return holidays.has(format(nextDay, 'yyyy-MM-dd'));
};

const isHighDemandDay = (date, holidays) => {
    const day = date.getDay();
    const isFriSatSun = day === 5 || day === 6 || day === 0;
    return isFriSatSun || checkIsHoliday(date, holidays) || checkIsPreHoliday(date, holidays);
};

const calculatePrice = (
    site,
    checkIn,
    checkOut,
    familyCount,
    visitorCount,
    config,
    holidays = new Set()
) => {
    const oneDay = 24 * 60 * 60 * 1000;
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / oneDay);

    if (nights <= 0) {
        return { totalPrice: 0, nights: 0 };
    }

    if (site.id.startsWith('air-') || site.type === 'AIR_CON' || site.id === 'air-group') {
        const airPrice = 10000 * nights;
        return {
            basePrice: airPrice,
            totalPrice: airPrice,
            nights
        };
    }

    let basePrice = 0;
    let consecutiveDiscount = 0;
    const checkInDay = checkIn.getDay();
    
    const weekday = site.weekday !== undefined && site.weekday !== null ? site.weekday : config.weekday;
    const weekend = site.weekend !== undefined && site.weekend !== null ? site.weekend : config.weekend;
    const peakWeekday = site.peakWeekday !== undefined && site.peakWeekday !== null ? site.peakWeekday : config.peakWeekday;
    const peakWeekend = site.peakWeekend !== undefined && site.peakWeekend !== null ? site.peakWeekend : config.peakWeekend;

    for (let i = 0; i < nights; i++) {
        const currentDate = new Date(checkIn.getTime() + (i * oneDay));
        const isPeak = isPeakSeason(currentDate, config);
        const isHigh = isHighDemandDay(currentDate, holidays);

        const isCurrentSunday = currentDate.getDay() === 0;
        const isCurrentHoliday = checkIsHoliday(currentDate, holidays);
        const isSundayOrHoliday = isCurrentSunday || isCurrentHoliday;

        const nextDate = addDays(currentDate, 1);
        const isNextDayHoliday = checkIsHoliday(nextDate, holidays);
        const isNextDayWeekend = nextDate.getDay() === 6 || nextDate.getDay() === 0;
        const isNextDayWorkday = !isNextDayHoliday && !isNextDayWeekend;

        const currentDayOfWeek = currentDate.getDay();
        const isTargetDayOfWeek = currentDayOfWeek >= 0 && currentDayOfWeek <= 3;

        const isSpeciallyWeekday = 
            isSundayOrHoliday && 
            isNextDayWorkday && 
            isTargetDayOfWeek && 
            checkInDay === currentDayOfWeek;

        if (isHigh && !isSpeciallyWeekday) {
            basePrice += isPeak ? peakWeekend : weekend;
        } else {
            basePrice += isPeak ? peakWeekday : weekday;
        }
    }

    for (let i = 0; i < nights - 1; i++) {
        const currentNightDate = new Date(checkIn.getTime() + (i * oneDay));
        const nextNightDate = new Date(checkIn.getTime() + ((i + 1) * oneDay));

        const isCurrentHigh = isHighDemandDay(currentNightDate, holidays);
        const isNextHigh = isHighDemandDay(nextNightDate, holidays);

        if (isCurrentHigh && isNextHigh) {
            consecutiveDiscount += config.longStayDiscount;
        }
    }

    const extraFamilyCost = Math.max(0, (familyCount - 1) * config.extraFamily * nights);
    const visitorCost = visitorCount * config.visitor;
    const totalPrice = basePrice + extraFamilyCost + visitorCost - consecutiveDiscount;

    return {
        basePrice,
        consecutiveDiscount,
        totalPrice,
        nights
    };
};

const config = {
  weekday: 40000,
  weekend: 70000,
  peakWeekday: 50000,
  peakWeekend: 70000,
  extraFamily: 35000,
  visitor: 10000,
  longStayDiscount: 10000,
  seasons: [
    { name: 'Summer Peak', startMonth: 6, startDay: 1, endMonth: 9, endDay: 26 }
  ]
};

const holidays = new Set(['2026-10-03', '2026-10-09']);
const site1 = { id: 'site-1', name: '철수네' };
const airGroup = { id: 'air-group', name: '에어컨 대여' };

console.log('=== [10월 요금 계산 시뮬레이션] ===\n');

const p1 = calculatePrice(site1, new Date('2026-10-16'), new Date('2026-10-18'), 1, 0, config, holidays);
console.log('1. 일반 주말 2박 (10/16~10/18):', p1, '->', p1.totalPrice === 130000 ? '✅ 일치' : '❌ 불일치');

const p2 = calculatePrice(site1, new Date('2026-10-08'), new Date('2026-10-11'), 1, 0, config, holidays);
console.log('2. 한글날 연휴 3박 (10/8 목 ~ 10/11 일):', p2, '->', p2.totalPrice === 190000 ? '✅ 일치' : '❌ 불일치');

const p3 = calculatePrice(site1, new Date('2026-10-12'), new Date('2026-10-14'), 1, 0, config, holidays);
console.log('3. 평일 2박 (10/12~10/14):', p3, '->', p3.totalPrice === 80000 ? '✅ 일치' : '❌ 불일치');

const p4 = calculatePrice(airGroup, new Date('2026-10-16'), new Date('2026-10-18'), 1, 0, config, holidays);
console.log('4. 에어컨 2박 (10/16~10/18):', p4, '->', p4.totalPrice === 20000 ? '✅ 일치' : '❌ 불일치');

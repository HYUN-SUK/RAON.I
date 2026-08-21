import { calculatePrice } from '../src/utils/pricing.ts';

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

// 2026년 10월 공휴일: 10/3(개천절), 10/9(한글날)
const holidays = new Set(['2026-10-03', '2026-10-09']);

const site1 = { id: 'site-1', name: '철수네', is_active: true };
const airGroup = { id: 'air-group', name: '에어컨 대여', is_active: true };

console.log('=== [10월 요금 계산 시뮬레이션] ===\n');

// 케이스 1: 일반 주말 2박 (10/16 금 ~ 10/18 일)
const p1 = calculatePrice(site1, new Date('2026-10-16'), new Date('2026-10-18'), 1, 0, config, holidays);
console.log('1. 일반 주말 2박 (10/16~10/18):', {
  nights: p1.nights,
  basePrice: p1.basePrice,
  consecutiveDiscount: p1.discount.consecutive,
  totalPrice: p1.totalPrice,
  expected: 130000
});

// 케이스 2: 한글날 연휴 3박 (10/8 목 ~ 10/11 일) - 목(전야)+금(한글날)+토
const p2 = calculatePrice(site1, new Date('2026-10-08'), new Date('2026-10-11'), 1, 0, config, holidays);
console.log('\n2. 한글날 연휴 3박 (10/8 목 ~ 10/11 일):', {
  nights: p2.nights,
  basePrice: p2.basePrice,
  consecutiveDiscount: p2.discount.consecutive,
  totalPrice: p2.totalPrice,
  expected: 190000
});

// 케이스 3: 평일 2박 (10/12 월 ~ 10/14 수)
const p3 = calculatePrice(site1, new Date('2026-10-12'), new Date('2026-10-14'), 1, 0, config, holidays);
console.log('\n3. 평일 2박 (10/12~10/14):', {
  nights: p3.nights,
  basePrice: p3.basePrice,
  totalPrice: p3.totalPrice,
  expected: 80000
});

// 케이스 4: 에어컨 2박
const p4 = calculatePrice(airGroup, new Date('2026-10-16'), new Date('2026-10-18'), 1, 0, config, holidays);
console.log('\n4. 에어컨 2박 (10/16~10/18):', {
  nights: p4.nights,
  totalPrice: p4.totalPrice,
  expected: 20000
});

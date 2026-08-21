import { addMonths, endOfMonth, isBefore, format } from 'date-fns';

function evaluateReservationPageState(simulatedNowISO, dbRule) {
  const now = new Date(simulatedNowISO);
  
  // 1. fetchOpenDayRule 계산 재현
  let calculatedCloseAt = new Date(dbRule.close_at);
  const config = dbRule.automation_config;

  // Trigger Moment for THIS month
  const currentTrigger = new Date(now);
  currentTrigger.setDate(config.triggerDay || 1);
  currentTrigger.setHours(9, 0, 0, 0);

  const baseDate = new Date(now);
  const isBeforeTrigger = isBefore(now, currentTrigger);
  if (isBeforeTrigger) {
    baseDate.setMonth(baseDate.getMonth() - 1);
  }

  const targetMonthDate = addMonths(baseDate, config.monthsToAdd);

  if (config.targetDay === 'END') {
    calculatedCloseAt = endOfMonth(targetMonthDate);
    calculatedCloseAt.setHours(23, 59, 59, 999);
  } else {
    calculatedCloseAt = new Date(targetMonthDate);
    calculatedCloseAt.setDate(parseInt(config.targetDay));
    calculatedCloseAt.setHours(23, 59, 59, 999);
  }

  const openAt = new Date(dbRule.open_at);
  const closeAt = calculatedCloseAt;

  // 2. ReservationPage.tsx 상태 계산
  const isOpen = now >= openAt && now <= closeAt;
  const isPreOpen = now < openAt;
  const isClosed = now > closeAt;

  return {
    simulatedNow: format(now, 'yyyy-MM-dd HH:mm:ss'),
    openAt: format(openAt, 'yyyy-MM-dd HH:mm:ss'),
    closeAt: format(closeAt, 'yyyy-MM-dd HH:mm:ss'),
    isBeforeTrigger,
    isOpen,
    isPreOpen,
    isClosed,
    allowedBookingRange: isOpen ? `${format(now, 'yyyy-MM-dd')} ~ ${format(closeAt, 'yyyy-MM-dd')}` : '예약 불가'
  };
}

const currentDbRule = {
  open_at: '2026-08-19T03:35:02.497+00:00', // 오늘 12:35 KST
  close_at: '2099-12-31T00:00:00+00:00',
  repeat_rule: 'MONTHLY',
  automation_config: { targetDay: '2', triggerDay: 20, monthsToAdd: 3 }
};

console.log('=== [현재 상태 분석: 오늘 vs 내일 09시] ===\n');
console.log('1. [지금 현재] 2026-08-19 13:25 (KST):');
console.log(evaluateReservationPageState('2026-08-19T13:25:00+09:00', currentDbRule));

console.log('\n2. [내일 오픈 직전] 2026-08-20 08:59:59 (KST):');
console.log(evaluateReservationPageState('2026-08-20T08:59:59+09:00', currentDbRule));

console.log('\n3. [내일 오픈 정각] 2026-08-20 09:00:00 (KST):');
console.log(evaluateReservationPageState('2026-08-20T09:00:00+09:00', currentDbRule));

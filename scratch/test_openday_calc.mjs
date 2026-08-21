import { addMonths, endOfMonth, isBefore, format } from 'date-fns';

function simulateOpenDayLogic(simulatedNowDate, config) {
  const now = new Date(simulatedNowDate);
  let calculatedCloseAt = new Date('2099-12-31');

  // 1. Determine Trigger Moment for THIS month
  const currentTrigger = new Date(now);
  currentTrigger.setDate(config.triggerDay || 1);
  currentTrigger.setHours(9, 0, 0, 0);

  // 2. Base Date Calculation
  const baseDate = new Date(now);
  if (isBefore(now, currentTrigger)) {
    baseDate.setMonth(baseDate.getMonth() - 1);
  }

  // 3. Calculate Target Month
  const targetMonthDate = addMonths(baseDate, config.monthsToAdd);

  // 4. Calculate Target Date
  if (config.targetDay === 'END') {
    calculatedCloseAt = endOfMonth(targetMonthDate);
    calculatedCloseAt.setHours(23, 59, 59, 999);
  } else {
    calculatedCloseAt = new Date(targetMonthDate);
    calculatedCloseAt.setDate(parseInt(config.targetDay));
    calculatedCloseAt.setHours(23, 59, 59, 999);
  }

  return {
    simulatedNow: format(now, 'yyyy-MM-dd HH:mm:ss'),
    triggerMoment: format(currentTrigger, 'yyyy-MM-dd HH:mm:ss'),
    isBeforeTrigger: isBefore(now, currentTrigger),
    baseMonth: format(baseDate, 'yyyy-MM'),
    targetMonth: format(targetMonthDate, 'yyyy-MM'),
    calculatedCloseAt: format(calculatedCloseAt, 'yyyy-MM-dd HH:mm:ss')
  };
}

console.log('--- [1. 현재 DB 설정값: { targetDay: "2", triggerDay: 20, monthsToAdd: 3 }] ---');
console.log('오늘 8/19 13:00:', simulateOpenDayLogic('2026-08-19T13:00:00', { targetDay: '2', triggerDay: 20, monthsToAdd: 3 }));
console.log('내일 8/20 08:59 (오픈 직전):', simulateOpenDayLogic('2026-08-20T08:59:59', { targetDay: '2', triggerDay: 20, monthsToAdd: 3 }));
console.log('내일 8/20 09:00 (오픈 순간):', simulateOpenDayLogic('2026-08-20T09:00:01', { targetDay: '2', triggerDay: 20, monthsToAdd: 3 }));

console.log('\n--- [2. 올바른 10월 오픈 설정 비교: monthsToAdd 및 targetDay=END] ---');
console.log('A) monthsToAdd=2, targetDay="END":');
console.log('내일 8/20 09:00:', simulateOpenDayLogic('2026-08-20T09:00:01', { targetDay: 'END', triggerDay: 20, monthsToAdd: 2 }));

console.log('\nB) monthsToAdd=3, targetDay="END":');
console.log('내일 8/20 09:00:', simulateOpenDayLogic('2026-08-20T09:00:01', { targetDay: 'END', triggerDay: 20, monthsToAdd: 3 }));

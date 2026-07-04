export interface PlaceFormatterInput {
  category: string;
  metadata?: Record<string, any>;
  description?: string;
}

/**
 * 축제 날짜 포맷팅 (예: 20260701 -> 07.01)
 */
function formatFestivalDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr || '';
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  return `${month}.${day}`;
}

/**
 * 전화번호 포맷팅 (0311234567 -> 031-123-4567)
 */
function formatPhoneNumber(tel: string): string {
  if (!tel) return '';
  const digits = tel.replace(/[^0-9]/g, '');
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  return tel;
}

/**
 * 요일별 날짜 괄호 제거 및 평일/주말 운영시간 단순화 핵심 정제기
 */
export function cleanOperatingHours(hoursStr: string): string {
  if (!hoursStr) return '';
  
  // 1. 날짜 괄호 패턴 (M/D) 제거: "(6/18)" -> ""
  let cleaned = hoursStr.replace(/\(\d{1,2}\/\d{1,2}\)/g, '').replace(/\s+/g, ' ').trim();
  
  // 2. "요일 시간 요일 시간" 형태로 요일별 패턴이 반복되는 경우 (예: "목 06:00 ~ 21:00 금 06:00 ~ 21:00...")
  // 요일별 시간 추출 시도
  const dayTimeRegex = /([월화수목금토일])요일?\s*(\d{2}:\d{2}\s*[-~-]\s*\d{2}:\d{2})/g;
  const matches: { day: string; time: string }[] = [];
  let match;
  
  while ((match = dayTimeRegex.exec(cleaned)) !== null) {
    matches.push({ day: match[1], time: match[2].replace(/\s+/g, '') });
  }
  
  if (matches.length >= 3) {
    const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];
    const timeMap = new Map<string, string>();
    matches.forEach(m => timeMap.set(m.day, m.time));
    
    const uniqueTimes = Array.from(new Set(matches.map(m => m.time)));
    
    if (uniqueTimes.length === 1) {
      return `매일 ${uniqueTimes[0]}`;
    }
    
    const weekdayTimes = dayOrder.slice(0, 5).map(d => timeMap.get(d)).filter(Boolean);
    const weekendTimes = dayOrder.slice(5, 7).map(d => timeMap.get(d)).filter(Boolean);
    
    const uniqueWeekday = Array.from(new Set(weekdayTimes));
    const uniqueWeekend = Array.from(new Set(weekendTimes));
    
    if (uniqueWeekday.length === 1 && uniqueWeekend.length === 1) {
      return `평일 ${uniqueWeekday[0]} | 주말 ${uniqueWeekend[0]}`;
    }
    
    const timeCounts = new Map<string, number>();
    matches.forEach(m => timeCounts.set(m.time, (timeCounts.get(m.time) || 0) + 1));
    
    let mostCommonTime = '';
    let maxCount = 0;
    timeCounts.forEach((count, time) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonTime = time;
      }
    });
    
    if (maxCount >= 5) {
      const exceptions = matches.filter(m => m.time !== mostCommonTime);
      const exceptionStr = exceptions.map(e => `${e.day} ${e.time}`).join(', ');
      return `매일 ${mostCommonTime} (${exceptionStr} 제외)`;
    }
  }
  
  return cleaned;
}

/**
 * 전화번호 획득 헬퍼
 */
export function getPlacePhoneNumber(place: PlaceFormatterInput): string {
  const { metadata = {} } = place;
  return metadata.전화번호 || metadata.tel || metadata.dutyTel3 || metadata.sponsor1tel || '';
}

/**
 * 카테고리별 동적 1줄 설명 생성 핵심 헬퍼
 */
export function formatPlaceDetailText(place: PlaceFormatterInput): string {
  const { category, metadata = {}, description = '' } = place;
  
  // 1. 축제 카테고리 (FESTIVAL)
  if (category === 'FESTIVAL') {
    const start = formatFestivalDate(metadata.event_start_date);
    const end = formatFestivalDate(metadata.event_end_date);
    const usefee = metadata.usefee || '';
    
    const parts = [];
    if (start && end) parts.push(`📅 ${start}~${end}`);
    if (usefee && !usefee.includes('정보 없음')) parts.push(`🎫 ${usefee}`);
    if (metadata.parking_available && metadata.parking_available !== '확인 불가') {
      parts.push(`🚗 주차 ${metadata.parking_available}`);
    }

    if (parts.length > 0) return parts.join(' | ');
    return `터치해서 축제 일정을 확인하세요!`;
  }

  // 2. 체인형 템플릿 판정
  const hours = metadata.operating_hours || '';
  const closed = metadata.closed_days || '';
  const parking = metadata.parking_available || '';
  
  const isChain = hours.includes('점포별 상이') || 
                  hours.includes('지자체별 상이') || 
                  closed.includes('지자체별 상이') ||
                  parking.includes('일부 소형 마트 제외');

  if (isChain) {
    const hoursMatch = hours.match(/(\d{1,2}):?(\d{2})\s*[-~]\s*(\d{1,2}):?(\d{2})/);
    const hoursStr = hoursMatch ? `${hoursMatch[1]}-${hoursMatch[3]}시` : '09-22시';
    return `기본 ${hoursStr}, 2·4주 일요일 휴무(지역별 상이). 방문 전 확인 권장`;
  }

  // 3. 주소 오염 판정
  const isAddressCorrupted = hours.includes('지번 :') || hours.includes('복사');

  // 4. 상세 데이터가 실제로 있는 경우 (REAL_DATA)
  const hasRealHours = hours.length > 0 && !hours.includes('정보 없음') && !hours.includes('상시 개방') && !isAddressCorrupted;
  const hasRealClosed = closed.length > 0 && !closed.includes('정보 없음') && !closed.includes('연중무휴 또는 정보 없음');
  const hasRealParking = parking.length > 0 && !parking.includes('확인 불가');

  if (hasRealHours || hasRealClosed || hasRealParking) {
    const parts = [];
    if (hasRealHours) {
      const cleanHours = cleanOperatingHours(hours);
      parts.push(`⏰ ${cleanHours}`);
    }
    if (hasRealClosed) parts.push(`🗓️ ${closed}`);
    if (hasRealParking) parts.push(`🚗 주차 ${parking}`);

    // 식당/카페의 대표 메뉴 1개 추가 결합
    if (['RESTAURANT', 'ROUTE_RESTAURANT', 'ROUTE_CAFE'].includes(category)) {
      const menu = metadata.representative_menu;
      if (Array.isArray(menu) && menu.length > 0) {
        const menuName = menu[0].split('(')[0].trim();
        parts.push(`🍴 ${menuName}`);
      }
    }

    return parts.join(' | ');
  }

  // 5. 상세 데이터 전무 (NO_DETAIL) -> "터치해서 상세정보를 확인하세요!"
  const tel = getPlacePhoneNumber(place);
  if (tel) {
    return `방문 전 유선 확인을 권장합니다.`;
  }
  return `터치해서 상세정보를 확인하세요!`;
}

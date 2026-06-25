import fetch from 'node-fetch';

/**
 * 재시도 로직이 포함된 공통 Fetch 헬퍼 함수
 */
export async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, {
        ...options,
        timeout: 10000 // 10초 타임아웃
      });
      if (res.status === 429) {
        throw new Error("API_QUOTA_EXCEEDED");
      }
      if (!res.ok) {
        throw new Error(`HTTP_ERROR_STATUS_${res.status}`);
      }
      const data = await res.json();
      return data;
    } catch (e) {
      console.warn(`[API Fetch Retry ${i + 1}/${maxRetries}] URL: ${url.split('?')[0]}, Err: ${e.message}`);
      if (i === maxRetries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // 지수 백오프 대기
    }
  }
}

/**
 * 한국관광공사 TourAPI 명소/축제 상세정보 조회 및 결합
 * @param {string} contentId TourAPI contentId
 * @param {string|number} contentTypeId TourAPI contentTypeId (12: 명소, 15: 축제)
 * @param {string} apiKey TourAPI 공공데이터 포털 인증키
 */
export async function fetchTourPlaceDetails(contentId, contentTypeId, apiKey) {
  if (!apiKey) throw new Error("Missing PUBLIC_DATA_API_KEY");
  
  const commonUrl = `http://apis.data.go.kr/B551011/KorService2/detailCommon2?serviceKey=${apiKey}&MobileOS=ETC&MobileApp=RAONAI&_type=json&contentId=${contentId}&defaultYN=Y&overviewYN=Y&homepageYN=Y`;
  const introUrl = `http://apis.data.go.kr/B551011/KorService2/detailIntro2?serviceKey=${apiKey}&MobileOS=ETC&MobileApp=RAONAI&_type=json&contentId=${contentId}&contentTypeId=${contentTypeId}`;
  
  try {
    const [commonData, introData] = await Promise.all([
      fetchWithRetry(commonUrl).catch(() => null),
      fetchWithRetry(introUrl).catch(() => null)
    ]);
    
    const commonItem = commonData?.response?.body?.items?.item;
    const common = commonItem ? (Array.isArray(commonItem) ? commonItem[0] : commonItem) : {};
    
    const introItem = introData?.response?.body?.items?.item;
    const intro = introItem ? (Array.isArray(introItem) ? introItem[0] : introItem) : {};
    
    let description = common.overview || '';
    let homepage_url = '';
    if (common.homepage) {
      // a태그 href 추출 또는 정규식 파싱
      const urlMatch = common.homepage.match(/href="([^"]+)"/) || common.homepage.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) homepage_url = urlMatch[1];
    }
    
    if (String(contentTypeId) === '12') {
      // 명소 (SPOT) 상세 필드 매핑
      return {
        description: description || undefined,
        operating_hours: intro.usetime || undefined,
        closed_days: intro.restdate || undefined,
        admission_fee: intro.usefee || undefined,
        parking_available: intro.parking || undefined,
        kids_friendly: (intro.chkbabycarriage && !intro.chkbabycarriage.includes('없음')) ? '유모차 대여 가능' : '확인 불가',
        disabled_accessible: (intro.infocenter && intro.infocenter.includes('휠체어')) ? '휠체어 대여 가능' : '확인 불가',
        homepage_url: homepage_url || undefined,
        raw_detail: { common, intro }
      };
    } else if (String(contentTypeId) === '15') {
      // 축제 (FESTIVAL) 상세 필드 매핑
      return {
        description: description || undefined,
        festival_period: {
          start: intro.eventstartdate || '',
          end: intro.eventenddate || ''
        },
        operating_hours: intro.playtime || undefined,
        admission_fee: intro.usefee || undefined,
        organizer_contact: intro.sponsor1tel || intro.sponsor2tel || undefined,
        parking_available: intro.parkingfestival || undefined,
        sub_description: intro.program || undefined,
        homepage_url: homepage_url || undefined,
        raw_detail: { common, intro }
      };
    }
    
    return { description, homepage_url, raw_detail: { common, intro } };
  } catch (err) {
    console.error(`[TourAPI Detail Error] contentId: ${contentId}, msg: ${err.message}`);
    return null;
  }
}

/**
 * 국립중앙의료원 NMC API 전국 병원 상세정보 조회 및 결합
 * @param {string} hpid NMC 기관코드 (e.g. A110001)
 * @param {string} apiKey NMC 공공데이터 포털 인증키
 */
export async function fetchHospitalDetails(hpid, apiKey) {
  if (!apiKey) throw new Error("Missing NMC_API_KEY");
  
  const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEgytBassInfoInqire?serviceKey=${apiKey}&HPID=${hpid}&_type=json`;
  
  try {
    const data = await fetchWithRetry(url);
    const itemObj = data?.response?.body?.items?.item;
    const item = itemObj ? (Array.isArray(itemObj) ? itemObj[0] : itemObj) : null;
    
    if (!item) {
      console.warn(`[NMC Detail Warn] No item found in NMC API response for HPID: ${hpid}`);
      return null;
    }
    
    // 1. 진료시간(operating_hours) 조립
    const days = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일', '공휴일'];
    const timeRanges = [];
    for (let i = 1; i <= 8; i++) {
      const start = item[`dutyTime${i}s`];
      const end = item[`dutyTime${i}c`];
      if (start !== undefined && start !== null && end !== undefined && end !== null) {
        const startStr = String(start).padStart(4, '0');
        const endStr = String(end).padStart(4, '0');
        const fmtStart = `${startStr.substring(0, 2)}:${startStr.substring(2, 4)}`;
        const fmtEnd = `${endStr.substring(0, 2)}:${endStr.substring(2, 4)}`;
        timeRanges.push(`${days[i-1]}: ${fmtStart} - ${fmtEnd}`);
      } else {
        timeRanges.push(`${days[i-1]}: 휴진`);
      }
    }
    const operating_hours = timeRanges.join(', ');
    
    // 2. 응급실 운영 정보
    const emergency_room = item.hpryn === '1' ? '운영함' : '운영안함';
    
    // 3. 진료과목 목록 추출
    const representative_departments = item.dgidIdName ? item.dgidIdName.split(',').map(d => d.trim()) : [];
    
    // 4. 주차 및 기타
    const parking_available = item.parkLmt ? `${item.parkLmt}대 주차 가능` : '확인 불가';
    
    return {
      operating_hours,
      closed_days: "진료시간표 참조 (요일별 진료/휴진 상이)",
      emergency_room,
      representative_departments,
      parking_available,
      homepage_url: item.hpidUrl || undefined,
      raw_detail: item
    };
  } catch (err) {
    console.error(`[NMC Detail Error] hpid: ${hpid}, msg: ${err.message}`);
    return null;
  }
}

/**
 * 17일 주기 전계통 지역별 동기화 엔진 (Daily Region Sync vNext)
 * 통합 카테고리: 식당(모범/안심/백년), 마트(대규모/SSM/기타), 명소(인기도 정밀갱신)
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';
import fs from 'fs';
import csvParser from 'csv-parser';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';
import { ADMIN_SIDO_MAP, SIGUNGU_CODE_MASTER, getAdminCodes } from './utils/admin-code-mapping.mjs';
import { fetchTourPlaceDetails, fetchHospitalDetails } from './utils/public-api-helpers.mjs';
import proj4 from 'proj4';
import https from 'https';

dotenv.config({ path: '.env.local' });

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 10,
  timeout: 180000
});

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// API Keys
const MOIS_API_KEY = process.env.MOIS_API_KEY || process.env.PUBLIC_DATA_API_KEY;
const SAFE_API_KEY = process.env.SAFE_RESTAURANT_API_KEY || process.env.SAFE_API_KEY || process.env.PUBLIC_DATA_API_KEY;
const TOUR_API_KEY = process.env.TOUR_API_KEY || process.env.PUBLIC_DATA_API_KEY;
const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY;

const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const SIDO_MAP = {
  '서울특별시': 1, '인천광역시': 2, '대전광역시': 3, '대구광역시': 4, '광주광역시': 5, '부산광역시': 6, '울산광역시': 7, '세종특별자치시': 8,
  '경기도': 31, '강원특별자치도': 32, '충청북도': 33, '충청남도': 34, '경상북도': 35, '경상남도': 36, '전북특별자치도': 37, '전라남도': 38, '제주특별자치도': 39,
  '전남광주시': 38
};

const SIDO_ORG_MAP = {
  '서울특별시': '6110000_ALL', '부산광역시': '6260000_ALL', '대구광역시': '6270000_ALL',
  '인천광역시': '6280000_ALL', '광주광역시': '6130000_ALL', '대전광역시': '6300000_ALL',
  '울산광역시': '6310000_ALL', '세종특별자치시': '5690000_ALL', '경기도': '6410000_ALL',
  '강원특별자치도': '6530000_ALL', '충청북도': '6430000_ALL', '충청남도': '6440000_ALL',
  '전북특별자치도': '6540000_ALL', '전라남도': '6130000_ALL', '경상북도': '6470000_ALL',
  '경상남도': '6480000_ALL', '제주특별자치도': '6500000_ALL',
  '전남광주시': '6130000_ALL'
};

const SIDO_SHORT_MAP = {
  '서울특별시': '서울', '인천광역시': '인천', '대전광역시': '대전', '대구광역시': '대구', '광주광역시': '광주', '부산광역시': '부산', '울산광역시': '울산', '세종특별자치시': '세종',
  '경기도': '경기', '강원특별자치도': '강원', '충청북도': '충북', '충청남도': '충남', '경상북도': '경북', '경상남도': '경남', '전북특별자치도': '전북', '전라남도': '전남', '제주특별자치도': '제주',
  '전남광주시': '전남광주'
};

const TOUR_API_AREA_MAP = {
  '서울특별시': '1', '인천광역시': '2', '대전광역시': '3', '대구광역시': '4', '광주광역시': '5', '부산광역시': '6', '울산광역시': '7', '세종특별자치시': '8',
  '경기도': '31', '강원특별자치도': '32', '충청북도': '33', '충청남도': '34', '전북특별자치도': '35', '전라남도': '36', '경상북도': '37', '경상남도': '38', '제주특별자치도': '39',
  '전남광주시': '38'
};

// 전국 16개 순환 지역 전수 대응 TourAPI 시군구 마스터 맵
const TOUR_API_SIGUNGU_MASTER = {
  '서울특별시': {
    areaCode: '1',
    sigungus: {
      '강남구':'1','강동구':'2','강북구':'3','강서구':'4','관악구':'5','광진구':'6','구로구':'7','금천구':'8','노원구':'9','도봉구':'10',
      '동대문구':'11','동작구':'12','마포구':'13','서대문구':'14','서초구':'15','성동구':'16','성북구':'17','송파구':'18','양천구':'19','영등포구':'20',
      '용산구':'21','은평구':'22','종로구':'23','중구':'24','중랑구':'25'
    }
  },
  '부산광역시': {
    areaCode: '6',
    sigungus: {
      '강서구':'1','금정구':'2','기장군':'3','남구':'4','동구':'5','동래구':'6','부산진구':'7','북구':'8','사상구':'9','사하구':'10',
      '서구':'11','수영구':'12','연제구':'13','영도구':'14','중구':'15','해운대구':'16'
    }
  },
  '대구광역시': {
    areaCode: '4',
    sigungus: { '중구':'1','동구':'2','서구':'3','남구':'4','북구':'5','수성구':'6','달서구':'7','달성군':'8','군위군':'9' }
  },
  '인천광역시': {
    areaCode: '2',
    sigungus: { '중구':'1','동구':'2','미추홀구':'3','연수구':'4','남동구':'5','부평구':'6','계양구':'7','서구':'8','강화군':'9','옹진군':'10' }
  },
  '대전광역시': {
    areaCode: '3',
    sigungus: { '동구':'1','중구':'2','서구':'3','유성구':'4','대덕구':'5' }
  },
  '울산광역시': {
    areaCode: '7',
    sigungus: { '중구':'1','남구':'2','동구':'3','북구':'4','울주군':'5' }
  },
  '세종특별자치시': { areaCode: '8', sigungus: {} },
  '전남광주시': {
    isCombined: true,
    gwangju: { areaCode: '5', sigungus: { '동구':'1','서구':'2','남구':'3','북구':'4','광산구':'5' } },
    jeonnam: { areaCode: '36', sigungus: { '목포시':'1','여수시':'2','순천시':'3','나주시':'4','광양시':'5','담양군':'6','곡성군':'7','구례군':'8','고흥군':'9','보성군':'10','화순군':'11','장흥군':'12','강진군':'13','해남군':'14','영암군':'15','무안군':'16','함평군':'17','영광군':'18','장성군':'19','완도군':'20','진도군':'21','신안군':'22' } }
  }
};

const KTO_SUB_DISTRICT_MAP = {
  '수원시': [{ sc: '1', name: '장안구' }, { sc: '2', name: '권선구' }, { sc: '3', name: '팔달구' }, { sc: '4', name: '영통구' }],
  '성남시': [{ sc: '2', name: '수정구' }, { sc: '3', name: '중원구' }, { sc: '4', name: '분당구' }],
  '안양시': [{ sc: '5', name: '만안구' }, { sc: '6', name: '동안구' }],
  '고양시': [{ sc: '8', name: '덕양구' }, { sc: '9', name: '일산동구' }, { sc: '10', name: '일산서구' }],
  '부천시': [{ sc: '11', name: '부천시' }],
  '안산시': [{ sc: '14', name: '상록구' }, { sc: '15', name: '단원구' }],
  '용인시': [{ sc: '23', name: '처인구' }, { sc: '24', name: '기흥구' }, { sc: '25', name: '수지구' }],
  '청주시': [{ sc: '11', name: '상당구' }, { sc: '12', name: '서원구' }, { sc: '13', name: '흥덕구' }, { sc: '14', name: '청원구' }],
  '천안시': [{ sc: '9', name: '동남구' }, { sc: '10', name: '서북구' }],
  '전주시': [{ sc: '10', name: '완산구' }, { sc: '11', name: '덕진구' }],
  '포항시': [{ sc: '20', name: '남구' }, { sc: '21', name: '북구' }],
  '창원시': [{ sc: '16', name: '의창구' }, { sc: '17', name: '성산구' }, { sc: '18', name: '마산합포구' }, { sc: '19', name: '마산회원구' }, { sc: '20', name: '진해구' }]
};

/**
 * 전국 16개 시도 전수 대응 TourAPI 파라미터 헬퍼
 */
function getTourApiParams(targetSido, sigungu) {
  const master = TOUR_API_SIGUNGU_MASTER[targetSido];
  
  if (master && master.isCombined) {
    if (master.gwangju.sigungus[sigungu]) {
      return [{ areaCode: master.gwangju.areaCode, sigunguCode: master.gwangju.sigungus[sigungu] }];
    }
    if (master.jeonnam.sigungus[sigungu]) {
      return [{ areaCode: master.jeonnam.areaCode, sigunguCode: master.jeonnam.sigungus[sigungu] }];
    }
  }

  if (master && master.sigungus && master.sigungus[sigungu]) {
    return [{ areaCode: master.areaCode, sigunguCode: master.sigungus[sigungu] }];
  }

  const defaultAreaCode = TOUR_API_AREA_MAP[targetSido] || '1';
  const subDists = KTO_SUB_DISTRICT_MAP[sigungu];
  if (subDists && subDists.length > 0) {
    return subDists.map(sub => ({ areaCode: defaultAreaCode, sigunguCode: sub.sc }));
  }

  return [{ areaCode: defaultAreaCode, sigunguCode: '' }];
}

const SIDO_ALIASES = {
  '서울': ['서울특별시', '서울'], 
  '부산': ['부산광역시', '부산'], 
  '대구': ['대구광역시', '대구'], 
  '인천': ['인천광역시', '인천'],
  '광주': ['광주광역시', '광주', '전남광주시', '전남광주통합특별시', '전남광주통합시'], 
  '대전': ['대전광역시', '대전'], 
  '울산': ['울산광역시', '울산'], 
  '세종': ['세종특별자치시', '세종'],
  '경기': ['경기도', '경기'], 
  '강원': ['강원특별자치도', '강원도', '강원'], 
  '충북': ['충청북도', '충북'], 
  '충남': ['충청남도', '충남'],
  '전북': ['전라북도', '전북특별자치도', '전북'], 
  '전남': ['전라남도', '전남', '전남광주시', '전남광주통합특별시', '전남광주통합시'],
  '전남광주': ['전남광주통합특별시', '전남광주통합시', '전남광주', '전남광주시', '광주전남', '광주광역시', '전라남도', '광주', '전남'],
  '전남광주시': ['전남광주통합특별시', '전남광주통합시', '전남광주', '전남광주시', '광주전남', '광주광역시', '전라남도', '광주', '전남'],
  '경북': ['경상북도', '경북'], 
  '경남': ['경상남도', '경남'],
  '제주': ['제주특별자치도', '제주도', '제주']
};


function isValidRegion(addr, shortSido) {
  if (!addr) return false;
  const aliases = SIDO_ALIASES[shortSido] || [shortSido];
  return aliases.some(alias => addr.startsWith(alias));
}

// [SOP v11.2] ID 안정성 확보를 위한 주소 가상 정규화 (Hashing용)
// [CRITICAL] 기존 12.7만 데이터가 'Full Name(경상북도 등)' 기반이므로, 해싱 시 항상 Full Name으로 확장합니다.
function getNormalizedAddr(addr) {
  if (!addr) return '';
  let a = addr.replace(/,\s?대한민국$/, '').trim();

  // [vFinal] 1. 경기도 광주시 방어 필터 (경기/경기도 명시 또는 광주시 고유 읍/면이 감지되는 경우)
  const isGyeonggiGwangju = 
    /^(경기|경기도)\s/.test(a) || 
    (/^(광주|광주시)\s/.test(a) && /(오포읍|초월읍|곤지암읍|도척면|퇴촌면|남종면|남한산성면)/.test(a));

  if (isGyeonggiGwangju) {
    a = a.replace(/^(경기|경기도|광주|광주시)\s(광주시\s)?/, '경기도 광주시 ');
    return a.trim();
  }

  // [vFinal] 2. 전남광주시(구 광주광역시 자치구) -> UUID 보존을 위해 '광주광역시'로 가상 정규화
  const isGwangjuMetro = /(동구|서구|남구|북구|광산구)/.test(a);
  if (isGwangjuMetro && /^(전남광주시|전남광주|광주전남|광주광역시|광주시|광주)\s/.test(a)) {
    a = a.replace(/^(전남광주시|전남광주|광주전남|광주광역시|광주시|광주)\s?/, '광주광역시 ');
    return a.trim();
  }

  // [vFinal] 3. 전남광주시(구 전남 시군) -> UUID 보존을 위해 '전라남도'로 가상 정규화
  const isJeonnamLocal = /(목포시|여수시|순천시|나주시|광양시|담양군|곡성군|구례군|고흥군|보성군|화순군|장흥군|강진군|해남군|영암군|무안군|함평군|영광군|장성군|완도군|진도군|신안군)/.test(a);
  if (isJeonnamLocal && /^(전남광주시|전남광주|광주전남|전라남도|전남|전남도)\s/.test(a)) {
    a = a.replace(/^(전남광주시|전남광주|광주전남|전라남도|전남|전남도)\s?/, '전라남도 ');
    return a.trim();
  }

  // Standardize Sido names based on Full Name standards
  a = a.replace(/^(서울|서울특별시)\s?/, '서울특별시 ');
  a = a.replace(/^(부산|부산광역시)\s?/, '부산광역시 ');
  a = a.replace(/^(대구|대구광역시)\s?/, '대구광역시 ');
  a = a.replace(/^(인천|인천광역시)\s?/, '인천광역시 ');
  a = a.replace(/^(광주|광주광역시)\s?/, '광주광역시 ');
  a = a.replace(/^(대전|대전광역시)\s?/, '대전광역시 ');
  a = a.replace(/^(울산|울산광역시)\s?/, '울산광역시 ');
  a = a.replace(/^(세종|세종특별자치시)\s?/, '세종특별자치시 ');
  a = a.replace(/^(경기|경기도)\s?/, '경기도 ');
  a = a.replace(/^(강원|강원도|강원특별자치도)\s?/, '강원특별자치도 ');
  a = a.replace(/^(충북|충청북도)\s?/, '충청북도 ');
  a = a.replace(/^(충남|충청남도)\s?/, '충청남도 ');
  a = a.replace(/^(전북|전라북도|전북특별자치도)\s?/, '전북특별자치도 '); // Fix: 전라북도특별자치도 방지
  a = a.replace(/^(전남|전라남도)\s?/, '전라남도 ');
  a = a.replace(/^(경북|경상북도)\s?/, '경상북도 ');
  a = a.replace(/^(경남|경상남도)\s?/, '경상남도 ');
  a = a.replace(/^(제주|제주도|제주특별자치도)\s?/, '제주특별자치도 ');
  return a.trim();
}


// [SOP v11.3] Aggressive Normalization (Master Key): 공백, 괄호, 소문자 제거로 ID 파생 방지
function getCleanString(str) {
  if (!str) return '';
  return String(str)
    .replace(/\(.+?\)/g, '') // 괄호와 괄호 안 내용 삭제 (예: (중방동), (삼풍점))
    .replace(/\s+/g, '')     // 모든 공백 제거
    .toLowerCase();          // 소문자화
}

const extractSido = (addr) => {
  if (!addr) return null;
  const normalized = getNormalizedAddr(addr);
  const standardSidos = [
    '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시', 
    '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도'
  ];
  return standardSidos.find(s => normalized.startsWith(s)) || null;
};



const generateId = (source, name, addr) => {
  const normalizedAddr = getNormalizedAddr(addr);
  const cleanName = getCleanString(name);
  const cleanAddr = getCleanString(normalizedAddr);
  return uuidv5(`${source}|${cleanName}|${cleanAddr}`, MY_NAMESPACE);
};

// --- [Phase 1: 공통 방어막 (Exponential Backoff + Jitter)] ---
const delay = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * 지능형 2단계 타임아웃 헬퍼
 * - connectTimeoutMs: 첫 응답 헤더 수신까지 대기 (기본 10초) - 죽은 서버 10초 만에 탈출
 * - streamTimeoutMs: 데이터 스트리밍 다운로드 중에는 충분한 시간 보장 (기본 90초)
 */
async function fetchWithTwoStageTimeout(url, options = {}, connectTimeoutMs = 10000, streamTimeoutMs = 90000) {
  const controller = new AbortController();
  let streamTimer = null;

  const connectTimer = setTimeout(() => {
    controller.abort(new Error(`Connect timeout after ${connectTimeoutMs}ms`));
  }, connectTimeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(connectTimer);

    if (res.ok && res.body) {
      streamTimer = setTimeout(() => {
        controller.abort(new Error(`Stream download timeout after ${streamTimeoutMs}ms`));
      }, streamTimeoutMs);

      if (typeof res.body.on === 'function') {
        res.body.on('end', () => { if (streamTimer) clearTimeout(streamTimer); });
        res.body.on('error', () => { if (streamTimer) clearTimeout(streamTimer); });
        res.body.on('close', () => { if (streamTimer) clearTimeout(streamTimer); });
      }
    }

    return res;
  } catch (err) {
    clearTimeout(connectTimer);
    if (streamTimer) clearTimeout(streamTimer);
    throw err;
  }
}

async function fetchWithRetry(url, options = {}, maxRetries = 5) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const mergedOptions = {
        timeout: 20000, // [v14.1 Upgrade] 20초 타임아웃 적용
        ...options,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.data.go.kr/',
          ...(options.headers || {})
        }
      };
      const res = await fetch(url, mergedOptions);
      
      // 500 에러 처리
      if (!res.ok) {
        if (res.status === 500) throw new Error(`HTTP 500 (Server Error)`);
        if (attempt === maxRetries) return res; // 마지막 시도면 그냥 반환
      }
      
      const text = await res.text();
      
      // 방화벽 차단(WAF) 또는 HTML 응답 감지
      const contentType = res.headers.get('content-type') || '';
      if (text.trim().startsWith('<') || text.includes('Unexpected errors') || contentType.includes('text/html')) {
        throw new Error(`Invalid Response (HTML/WAF/Unexpected errors): ${text.substring(0, 50).replace(/\n/g, ' ')}`);
      }
      if (text.includes('API token')) {
        const err = new Error(`Fatal API Token Error: ${text}`);
        err.isFatal = true;
        throw err;
      }
      
      try {
        const json = JSON.parse(text);
        return json; // 성공적으로 파싱된 JSON 객체 반환
      } catch (parseError) {
        throw new Error(`JSON Parse Error: ${parseError.message}`);
      }
    } catch (e) {
      attempt++;
      if (e.isFatal || attempt > maxRetries) {
        console.error(`      ❌ Max retries (${maxRetries}) exhausted or Fatal Error. Last Error: ${e.message}`);
        throw e;
      }
      // 지수 백오프: 1s -> 2s -> 4s -> 8s -> 15s + Jitter
      const backoffMs = Math.min(15000, Math.pow(2, attempt-1) * 1000 + (Math.random() * 500));
      console.warn(`      ⚠️ [Retry ${attempt}/${maxRetries}] Fetch failed: ${e.message}. Waiting ${Math.round(backoffMs)}ms...`);
      await delay(backoffMs);
    }
  }
}

// --- [인기도 엔진 v2 Utilities] ---

let CACHED_BASE_YM = null;

async function findLatestBaseYm() {
  if (CACHED_BASE_YM) return CACHED_BASE_YM;
  
  console.log(`🔍 [Popularity] Searching for latest available baseYm for Tmap API...`);
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // Current month (0-11)
  
  // Starting from 202504 as a high-probability baseline, then scanning backwards if needed
  // Or starting from current month - 1
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0');
    
    // Probe call (numRows=1) - using Seoul Jongno (11/11110) as constant probe target
    const params = new URLSearchParams({
      serviceKey: process.env.PUBLIC_DATA_API_KEY,
      numOfRows: '1',
      pageNo: '1',
      MobileOS: 'ETC',
      MobileApp: 'RAONAI',
      _type: 'json',
      baseYm: ym,
      areaCd: '11',
      signguCd: '11110'
    });
    
    try {
      const url = `https://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?${params.toString()}`;
      const data = await fetchWithRetry(url, {}, 1); // Only 1 retry for probe
      if (data?.response?.body?.totalCount > 0) {
        console.log(`   ✅ Latest valid baseYm found: ${ym}`);
        CACHED_BASE_YM = ym;
        return ym;
      }
    } catch (e) {
      // Just continue to next month
    }
  }
  
  console.warn(`   ⚠️ Failing to find dynamic baseYm. Using fallback 202504.`);
  CACHED_BASE_YM = '202504';
  return '202504';
}

// 백년가게용 최신 UDDI 자동 탐색 모듈
async function getLatestOdcloudPath(namespace = "15102255/v1") {
  try {
    const spec = await fetchWithRetry(`https://infuser.odcloud.kr/oas/docs?namespace=${encodeURIComponent(namespace)}`);
    const paths = Object.keys(spec.paths || {});
    if (paths.length > 0) return paths[0]; 
  } catch (e) {
    console.warn(`    ⚠️ Failed to fetch ODCloud Spec. Using offline fallback path.`);
  }
  // 기본 백년가게 경로 (2024 최신 기준 fallback)
  return `/15102255/v1/uddi:c8c0f585-8ee0-47a3-8686-3507119e0780`; 
}


const SIDO_ROTATION = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', 
  '전남광주시', // 전남광주통합특별시 단일 수집일로 병합
  '대전광역시', '울산광역시', '세종특별자치시', '경기도', 
  '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '경상북도', '경상남도', '제주특별자치도'
];

async function dailyRegionSync() {
  // KST 타임존 강제 록온 (GitHub Actions UTC 서버 구동 대응)
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kstNow.getUTCFullYear();
  const startOfYearKstMs = Date.UTC(year, 0, 1);
  const diff = kstNow.getTime() - startOfYearKstMs;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  
  const targetIndex = (dayOfYear - 1) % SIDO_ROTATION.length;
  let targetSido = SIDO_ROTATION[targetIndex];

  // CLI 인자로 시도 강제 설정 및 force 옵션 지원
  const args = process.argv.slice(2);
  const forceRun = args.includes('--force');
  const forceSido = args.find(a => SIDO_ROTATION.includes(a));
  if (forceSido) {
    console.log(`💡 [Force Sido Enabled] Force target: ${forceSido}`);
    targetSido = forceSido;
  }

  // [SOP v15.0 2중 안전망] 당일 1회 성공(SUCCESS) 0초 스킵 락 (Idempotency Guard)
  if (!forceRun && !forceSido) {
    const kstNow = new Date(Date.now() + 9 * 3600000);
    const todayKstStr = kstNow.toISOString().split('T')[0];
    const kstStartOfDayUtc = new Date(`${todayKstStr}T00:00:00+09:00`).toISOString();

    const { data: todayLogs, error: logCheckErr } = await supabase
      .from('automation_logs')
      .select('id, status, created_at, message')
      .eq('job_name', 'DAILY_REGION_SYNC')
      .eq('status', 'SUCCESS')
      .gte('created_at', kstStartOfDayUtc)
      .limit(1);

    if (!logCheckErr && todayLogs && todayLogs.length > 0) {
      console.log(`\n⚡ [Idempotency Guard] 오늘(${todayKstStr}) 일일 지역 동기화(DAILY_REGION_SYNC)가 이미 성공(SUCCESS) 완료되었습니다.`);
      console.log(`   - 이전 완료 기록: [${todayLogs[0].created_at}] ${todayLogs[0].message}`);
      console.log(`   - 2차/중복 트리거를 0초 만에 완벽히 스킵(Skip)하고 정상 종료합니다.\n`);
      process.exitCode = 0;
      return;
    }
  }

  console.log(`\n📅 [Day ${dayOfYear}] Target Region: ${targetSido}`);
  console.log(`🚀 Starting Daily Rotation Sync for ${targetSido}...\n`);

  // [SOP v11.3] 지표 추적용 객체 (7대 핵심 지표 표준 준수 및 영업/폐업 세분화)
  const baseStat = () => ({ existing: { active: 0, inactive: 0 }, fetched: { active: 0, inactive: 0 }, new: { active: 0, inactive: 0 }, updated: { active: 0, inactive: 0 }, total: { active: 0, inactive: 0 } });
  const stats = {
    sido: targetSido,
    day_of_year: dayOfYear,
    categories: {
      SAFE: { label: 'RESTAURANT (안심식당)', ...baseStat(), note: 'MAFRA API' },
      GOOD: { label: 'RESTAURANT (모범음식점)', ...baseStat(), note: 'LocalData CSV' },
      BAEK: { label: 'RESTAURANT (백년가게)', ...baseStat(), note: 'ODCloud API' },
      LARGE_MART: { label: 'MART (대형마트)', ...baseStat(), note: 'LocalData CSV' },
      SSM_MART: { label: 'MART (준대규모 - SSM)', ...baseStat(), note: '대규모 내 식별' },
      OTHER_MART: { label: 'MART (기타식품판매업)', ...baseStat(), note: 'LocalData CSV' },
      SPOT: { label: 'SPOT (관광명소)', ...baseStat(), note: 'TourAPI v2' },
      SPOT_KTO_POP: { label: 'SPOT (KTO 공식 순위)', ...baseStat(), note: '기초지자체 중심 인기도' },
      LX: { label: 'RESTAURANT (LX공사맛집)', ...baseStat(), note: '전국 직원 추천 기반' },
      SPOT_TMAP_REL: { label: '명소 연관(Tmap)', ...baseStat(), note: '인기도 지표 1' },
      SPOT_KT_CONCTR: { label: '명소 집중률(KT)', ...baseStat(), note: '인기도 지표 2' },
      HOSPITAL: { label: 'HOSPITAL (병원)', ...baseStat(), note: 'NMC API' },
      ENRICHMENT: { label: '상세 정보 갱신', ...baseStat(), note: '카카오 모바일 크롤링' }
    }
  };
  // 1. 사전 카운트 (기존 데이터 수 - 현행 소스명만 사용, 별칭 통합 집계)
  const sourceToStatKey = {
    'SAFE_RESTAURANT': 'SAFE', 
    'LOCALDATA_RESTAURANT_GOOD': 'GOOD',
    'SMBA_BAEK': 'BAEK',
    'LOCALDATA_MART_LARGE': 'LARGE_MART', 
    'LOCALDATA_MART_SSM': 'SSM_MART',
    'LOCALDATA_MART_OTHER': 'OTHER_MART',
    'TOUR_SPOT': 'SPOT',
    'LX_RESTAURANT': 'LX',
    'NMC_HOSPITAL': 'HOSPITAL'
  };


  const shortSido = SIDO_SHORT_MAP[targetSido] || targetSido;
  const aliases = SIDO_ALIASES[shortSido] || [targetSido];

  // 페이지네이션 기반 정확 카운트 함수 (count:'exact' HTTP 500 타임아웃 방지)
  // queryFn은 .select('id')까지 체이닝된 쿼리빌더를 반환해야 함
  async function paginatedCount(queryFn) {
    let total = 0;
    let page = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      const { data, error } = await queryFn().range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) { console.error(`  ⚠️  [PaginatedCount Error]:`, error.message); break; }
      if (!data || data.length === 0) break;
      total += data.length;
      if (data.length < PAGE_SIZE) break;
      page++;
    }
    return total;
  }

  for (const [source, key] of Object.entries(sourceToStatKey)) {
    const actCount = await paginatedCount(() => supabase.from('master_places').select('id').in('sido', aliases).eq('api_source', source).eq('is_active', true));
    const inactCount = await paginatedCount(() => supabase.from('master_places').select('id').in('sido', aliases).eq('api_source', source).eq('is_active', false));
    stats.categories[key].existing.active += actCount;
    stats.categories[key].existing.inactive += inactCount;
  }

  // ENRICHMENT 사전 카운트
  const enrichActCount = await paginatedCount(() => supabase.from('master_places').select('id').in('sido', aliases).eq('is_active', true).not('raw_data->>operating_hours', 'is', null));
  const enrichInactCount = await paginatedCount(() => supabase.from('master_places').select('id').in('sido', aliases).eq('is_active', false).not('raw_data->>operating_hours', 'is', null));

  stats.categories.ENRICHMENT.existing.active = enrichActCount;
  stats.categories.ENRICHMENT.existing.inactive = enrichInactCount;

  const seenIds = new Set();

  // [실시간 점진적 로깅] 1단계: 시작 시 RUNNING 레코드 생성
  let currentLogId = await updateAutomationLog(null, stats, 'RUNNING', `${targetSido} 지역 순환 동기화 시작`);

  // 2. 카테고리별 동기화 실행
  // [2.1] 식당군 (모범/안심/백년/LX)
  console.log(`\n🍽️ [Step 2.1] 식당군 동기화 시작 (${targetSido})...`);
  await syncLocalDataCSV(targetSido, seenIds, stats, 'RESTAURANT');
  await syncSafeRestaurants(targetSido, seenIds, stats.categories.SAFE);
  await syncLXRestaurants(targetSido, seenIds, stats.categories.LX);
  await syncBaeknyeon(targetSido, seenIds, stats.categories.BAEK);
  currentLogId = await updateAutomationLog(currentLogId, stats, 'RUNNING', `${targetSido} 식당군 수집 완료`);

  // [2.2] 마트군 (대규모/기타식품)
  console.log(`\n🛒 [Step 2.2] 마트군 동기화 시작 (${targetSido})...`);
  await syncLocalDataCSV(targetSido, seenIds, stats, 'MART');
  currentLogId = await updateAutomationLog(currentLogId, stats, 'RUNNING', `${targetSido} 마트군 수집 완료`);

  // [2.3] 명소군 (관광공사 지역기반 동기화) - KorService2
  console.log(`\n🏞️ [Step 2.3] 관광명소 동기화 시작 (${targetSido})...`);
  await syncTourSpots(targetSido, seenIds, stats.categories.SPOT);
  currentLogId = await updateAutomationLog(currentLogId, stats, 'RUNNING', `${targetSido} 관광명소 수집 완료`);

  // [2.4] 병원군 (응급의료기관 동기화)
  console.log(`\n🏥 [Step 2.4] 병원 동기화 시작 (${targetSido})...`);
  await syncHospitals(targetSido, seenIds, stats.categories.HOSPITAL);
  currentLogId = await updateAutomationLog(currentLogId, stats, 'RUNNING', `${targetSido} 병원 수집 완료`);

  // [2.5] 상세 정보 갱신 (100일 만료 / 미수집 대상 수집)
  await syncPlaceDetailsEnrichment(targetSido, stats.categories.ENRICHMENT);

    // --- [SOP v12.0 Step 9: KTO Municipality Popularity Sync (5-Worker 병렬 최적화)] --- 
    console.log(`\n9. [Popularity] Fetching KTO Official Ranking (5-Worker 병렬 처리)...`);
    
    const { data: ktoSpots } = await supabase
        .from('master_places')
        .select('sigungu')
        .eq('api_source', 'TOUR_SPOT')
        .eq('is_active', true)
        .in('sido', aliases)
        .limit(5000);

    const ktoSigungus = [...new Set((ktoSpots || []).map(s => s.sigungu))].filter(Boolean);
    const regionMap = [];

    for (const sigungu of ktoSigungus) {
        const paramSets = getTourApiParams(targetSido, sigungu);
        for (const pSet of paramSets) {
            regionMap.push({
                sigungu,
                areaCode: pSet.areaCode,
                sigunguCode: pSet.sigunguCode
            });
        }
    }

    console.log(`   - Detected ${regionMap.length} KTO-standard sigungus in ${targetSido}.`);

    console.log(`🔍 [Popularity] Pre-fetching master_places and smart_plan_facts for in-memory matching...`);
    const { data: dbSpots } = await supabase
        .from('master_places')
        .select('id, name, raw_data')
        .eq('api_source', 'TOUR_SPOT')
        .in('sido', aliases);

    const { data: dbSpfs } = await supabase
        .from('smart_plan_facts')
        .select('id, name, raw_data')
        .eq('category', 'SPOT');

    const contentIdMap = new Map();
    const nameMap = new Map();
    const idMap = new Map();

    for (const spot of (dbSpots || [])) {
        const cid = spot.raw_data?.contentid || spot.raw_data?.contentId;
        if (cid) contentIdMap.set(String(cid), spot);
        if (spot.name) nameMap.set(spot.name.trim(), spot);
        idMap.set(spot.id, spot);
    }

    const spfMap = new Map();
    for (const spf of (dbSpfs || [])) {
        if (spf.name) {
            const cleanN = spf.name.trim();
            if (!spfMap.has(cleanN)) spfMap.set(cleanN, []);
            spfMap.get(cleanN).push(spf);
        }
    }
    console.log(`   - Loaded ${dbSpots?.length || 0} spots and ${dbSpfs?.length || 0} facts to memory.`);

    // 5-Worker 병렬 파이프라인 적용
    const KTO_CONCURRENCY = 5;
    for (let cIdx = 0; cIdx < regionMap.length; cIdx += KTO_CONCURRENCY) {
        const chunk = regionMap.slice(cIdx, cIdx + KTO_CONCURRENCY);
        await Promise.allSettled(chunk.map(async (reg) => {
            try {
                const baseYm = CACHED_BASE_YM || await findLatestBaseYm();
                const params = new URLSearchParams({ 
                    serviceKey: TOUR_API_KEY, 
                    numOfRows: '100', 
                    pageNo: '1', 
                    MobileOS: 'ETC', 
                    MobileApp: 'RAONAI', 
                    _type: 'json', 
                    areaCode: reg.areaCode, 
                    contentTypeId: '12'
                });
                if (reg.sigunguCode) params.append('sigunguCode', reg.sigunguCode);

                const url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?${params.toString()}`;
                const data = await fetchWithRetry(url, {}, 2);
                const items = data.response?.body?.items?.item || [];

                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const contentId = String(item.contentId || item.contentid || '');
                    const title = (item.title || item.name || '').trim();
                    const addr = item.addr1 || item.address || '';
                    const rank = i + 1;
                    const mapx = parseFloat(item.mapx || item.lng || 0);
                    const mapy = parseFloat(item.mapy || item.lat || 0);

                    const ktoPatch = { kto_official: { rank, baseYm, updated_at: new Date().toISOString(), source: 'KTO_DAILY_ROTATION' } };

                    let matchedMp = null;

                    if (contentId && contentIdMap.has(contentId)) {
                        matchedMp = contentIdMap.get(contentId);
                    }
                    if (!matchedMp && title && nameMap.has(title)) {
                        matchedMp = nameMap.get(title);
                    }
                    const detId = generateId('TOUR_SPOT', title, addr);
                    if (!matchedMp && idMap.has(detId)) {
                        matchedMp = idMap.get(detId);
                    }

                    let matchedMpId = matchedMp ? matchedMp.id : null;

                    if (matchedMp) {
                        const currentKto = matchedMp.raw_data?.kto_official;
                        const isSame = currentKto && 
                                       currentKto.rank === rank && 
                                       currentKto.baseYm === baseYm;

                        if (!isSame) {
                            const mergedRaw = { ...(matchedMp.raw_data || {}), ...ktoPatch };
                            await supabase.from('master_places').update({ raw_data: mergedRaw }).eq('id', matchedMpId);
                            matchedMp.raw_data = mergedRaw;
                        }

                        const spfMatches = spfMap.get(title) || [];
                        if (spfMatches.length > 0) {
                            for (const spf of spfMatches) {
                                const currentSpfKto = spf.raw_data?.kto_official;
                                const isSpfSame = currentSpfKto && 
                                                  currentSpfKto.rank === rank && 
                                                  currentSpfKto.baseYm === baseYm;
                                
                                if (!isSpfSame) {
                                    const updatedSpfRaw = { ...(spf.raw_data || {}), ...ktoPatch };
                                    await supabase.from('smart_plan_facts').update({ raw_data: updatedSpfRaw }).eq('id', spf.id);
                                    spf.raw_data = updatedSpfRaw;
                                }
                            }
                        }
                    } else {
                        const newPlaceData = {
                            id: detId,
                            name: title,
                            category: 'SPOT',
                            sido: targetSido,
                            sigungu: reg.sigungu || '',
                            address: addr,
                            lat: mapy,
                            lng: mapx,
                            api_source: 'KTO_OFFICIAL_NEW',
                            is_active: true,
                            trust_score: 85,
                            raw_data: {
                                contentid: contentId,
                                firstimage: item.firstimage || item.firstimage2 || '',
                                tel: item.tel || '',
                                cat1: item.cat1 || '', cat2: item.cat2 || '', cat3: item.cat3 || '',
                                badges: ['KTO 공식 인기 명소'],
                                ...ktoPatch
                            }
                        };
                        await supabase.from('master_places').upsert([newPlaceData], { onConflict: 'id' });

                        const newFactData = {
                            name: title,
                            category: 'SPOT',
                            sido: targetSido,
                            sigungu: reg.sigungu || '',
                            address: addr,
                            lat: mapy,
                            lng: mapx,
                            api_source: 'KTO_OFFICIAL_NEW',
                            raw_data: newPlaceData.raw_data
                        };
                        await supabase.from('smart_plan_facts').upsert([newFactData], { onConflict: 'name,sido,sigungu' });
                    }
                }
                stats.categories.SPOT_KTO_POP.fetched.active += items.length;
                stats.categories.SPOT_KTO_POP.updated.active += items.length;
                console.log(`      ✅ Received/Updated ${items.length} items for ${reg.areaCode}/${reg.sigunguCode}.`);
            } catch (e) {
                console.error(`      ⚠️ Failed KTO Sync for ${reg.areaCode}/${reg.sigunguCode}: ${e.message}`);
            }
        }));
        await delay(50);
    }
    currentLogId = await updateAutomationLog(currentLogId, stats, 'RUNNING', `${targetSido} KTO 인기도 수집 완료`);

  // 3. [SOP v11.3 Update] 최종 지역별 건수 재집계 (7대 지표 정밀화 - paginatedCount 안전 적용)
  console.log(`\n📊 [Final Audit] ${targetSido} 지역별 최종 정합성 확인 중...`);
  for (const [source, key] of Object.entries(sourceToStatKey)) {
    const actCount = await paginatedCount(() => supabase.from('master_places').select('id').in('sido', aliases).eq('api_source', source).eq('is_active', true));
    const inactCount = await paginatedCount(() => supabase.from('master_places').select('id').in('sido', aliases).eq('api_source', source).eq('is_active', false));
    stats.categories[key].total.active = actCount;
    stats.categories[key].total.inactive = inactCount;
  }

  // [SPOT_TMAP_REL, SPOT_KT_CONCTR, SPOT_KTO_POP 지표의 existing 및 total 보정]
  const spotExisting = { ...stats.categories.SPOT.existing };
  const spotTotal = { ...stats.categories.SPOT.total };

  stats.categories.SPOT_TMAP_REL.existing = spotExisting;
  stats.categories.SPOT_KT_CONCTR.existing = spotExisting;
  stats.categories.SPOT_KTO_POP.existing = spotExisting;

  stats.categories.SPOT_TMAP_REL.total = spotTotal;
  stats.categories.SPOT_KT_CONCTR.total = spotTotal;
  stats.categories.SPOT_KTO_POP.total = spotTotal;

  // [ENRICHMENT 최종 재집계 - paginatedCount 적용]
  const finalEnrichAct = await paginatedCount(() => supabase.from('master_places').select('id').in('sido', aliases).eq('is_active', true).not('raw_data->>operating_hours', 'is', null));
  const finalEnrichInact = await paginatedCount(() => supabase.from('master_places').select('id').in('sido', aliases).eq('is_active', false).not('raw_data->>operating_hours', 'is', null));

  stats.categories.ENRICHMENT.total.active = finalEnrichAct;
  stats.categories.ENRICHMENT.total.inactive = finalEnrichInact;

  // 4. [Strike-Out] 미수산 데이터 처리 (백년가게 전용 고수 / 마트&식당은 API 기반 즉시 처리)
  console.log(`\n⚖️ [Strike-Out Check] 미확인 데이터 업데이트 중...`);
  for (const [source, key] of Object.entries(sourceToStatKey)) {
    const fetched = stats.categories[key].fetched.active + stats.categories[key].fetched.inactive;
    // API 수신 0건일 경우 Failsafe (네트워크 오류 방어)
    if (fetched === 0) {
      console.warn(`  ⚠️  [Failsafe] ${source} 수신 0건: 상태 업데이트 건너뜀.`);
      continue;
    }

    let existingActive = [];
    const { data: rawActive, error: selectErr } = await supabase.from('master_places').select('id, miss_count, address, sido, is_protected').in('sido', aliases).eq('api_source', source).eq('is_active', true);
    if (!selectErr && rawActive) {
      if (targetSido === '전남광주시_광주권') {
        existingActive = rawActive.filter(r => 
          r.sido === '광주광역시' || 
          /(동구|서구|남구|북구|광산구)/.test(r.address || '')
        );
      } else if (targetSido === '전남광주시_전남권') {
        existingActive = rawActive.filter(r => 
          r.sido === '전라남도' || 
          /(목포시|여수시|순천시|나주시|광양시|담양군|곡성군|구례군|고흥군|보성군|화순군|장흥군|강진군|해남군|영암군|무안군|함평군|영광군|장성군|완도군|진도군|신안군)/.test(r.address || '')
        );
      } else {
        existingActive = rawActive;
      }
    }
    
    const seen = [];      // API에서 확인됨 -> miss_count 리셋
    const unseen = [];    // API에서 미확인 -> miss_count 증가
    const toDeactivate = []; // 3회 연속 미확인 -> 비활성화
    
    for (const r of (existingActive || [])) {
      if (seenIds.has(r.id)) {
        seen.push(r.id);
      } else {
        // [SSOT v11.3 & v13.1.2 Update] 관광명소(SPOT) 및 국가/지자체 공인 명성 보호 데이터(is_protected: true)는 영구 보호
        if (key === 'SPOT' || r.is_protected === true) {
          continue;
        }
        
        // 백년가게(BAEK), 마트, 모범, 안심식당은 API 목록 누락 시 비활성화 안전장치로 유지함
        const newMiss = (r.miss_count || 0) + 1;
        if (newMiss >= 3) toDeactivate.push(r.id);
        else unseen.push({ id: r.id, miss: newMiss });
      }
    }

    // 일시 업데이트 (200건 단위)
    if (seen.length > 0) {
      for (let i = 0; i < seen.length; i += 200) {
        await supabase.from('master_places').update({ miss_count: 0 }).in('id', seen.slice(i, i + 200));
      }
    }
    for (const item of unseen) {
      await supabase.from('master_places').update({ miss_count: item.miss }).eq('id', item.id);
    }
    if (toDeactivate.length > 0) {
      console.log(`  🚫 [${key}] 3회 미노출로 인한 비활성화: ${toDeactivate.length}건`);
      // [CRITICAL FIX] Supabase URL length limit 방어 (100개씩 청킹하여 업데이트)
      for (let i = 0; i < toDeactivate.length; i += 100) {
        const chunkIds = toDeactivate.slice(i, i + 100);
        const { error: updateErr } = await supabase.from('master_places').update({ is_active: false, miss_count: 0 }).in('id', chunkIds);
        if (updateErr) {
          throw new Error(`[CRITICAL] Deactivation Failed for chunk: ${updateErr.message}`);
        }
      }
      stats.categories[key].updated.inactive += toDeactivate.length; // 비활성화도 상태 변경이므로 업데이트에 합산
    }
  }

  // 5. 최종 데이터 건수 리프레시 및 로그 기록
  console.log(`⏳ DB 동기화 완료 대기 중 (2초)...`);
  await delay(2000);
  
  for (const [source, key] of Object.entries(sourceToStatKey)) {
    const actCount = await paginatedCount(() => supabase.from('master_places').select('id').in('sido', aliases).eq('api_source', source).eq('is_active', true));
    const inactCount = await paginatedCount(() => supabase.from('master_places').select('id').in('sido', aliases).eq('api_source', source).eq('is_active', false));
    stats.categories[key].total.active = actCount;
    stats.categories[key].total.inactive = inactCount;
  }

  // ENRICHMENT 사후 최종 카운트
  const enrichActTotal = await paginatedCount(() => supabase.from('master_places').select('id').in('sido', aliases).eq('is_active', true).not('raw_data->>operating_hours', 'is', null));
  const enrichInactTotal = await paginatedCount(() => supabase.from('master_places').select('id').in('sido', aliases).eq('is_active', false).not('raw_data->>operating_hours', 'is', null));

  stats.categories.ENRICHMENT.total.active = enrichActTotal;
  stats.categories.ENRICHMENT.total.inactive = enrichInactTotal;
  
  // 6. [SOP v11.4] 전국 명소 인기도 순환 갱신 (TMAP/KT 기반 고도화)
  await updateSpotPopularity(targetSido, stats);

  // 7. [SOP v11.4] 17일 순환 종료 시 (전국 수집 완료 시) 글로벌 점수 최종 산출
  // - targetSido가 제주(마지막 지역)일 때 또는 17일 주기 배배수 시점
  if (targetSido === '제주특별자치도' || (dayOfYear % 17 === 0)) {
     await finalizePopularityv2();
  }

  await updateAutomationLog(currentLogId, stats, 'SUCCESS', `${targetSido} 지역 순환 동기화 완료 (식당/마트/명소)`);

  // 8. [SOP v11.3] 정밀 감사 결과 테이블 출력
  printAuditTable(stats);

  console.log(`\n✨ [Daily Rotation vNext] ${targetSido} 전계통 동기화 완료!`);
}

/**
 * LX 공사맛집리스트 (로컬 CSV) - 17일 로테이션 통합 수집
 */
async function syncLXRestaurants(sido, seenIds, stat) {
  console.log(`🏠 [LX] ${sido} 공사맛집 동기화 중 (로컬 CSV)...`);
  const csvPath = 'LX_RESTAURANT_LIST.csv';
  if (!fs.existsSync(csvPath)) {
    console.warn(`  ⚠️  LX CSV file not found at ${csvPath}. Skipping.`);
    return;
  }

  const shortSido = SIDO_SHORT_MAP[sido] || sido;
  const chunk = [];

  try {
    const records = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(iconv.decodeStream('euc-kr'))
        .pipe(csvParser())
        .on('data', (data) => records.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    for (const i of records) {
      const addr = i['주소'] || '';
      // [상시방어] 도로명/상호 클렌징 후 지역 일치 여부 확인
      if (!isValidRegion(addr, shortSido) && !isValidRegion(addr, sido)) continue;

      const name = i['상호'] || '';
      const id = generateId('LX_RESTAURANT', name, addr);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      stat.fetched.active++;

      // 신규 등록을 위한 좌표 확보 (LX는 원본에 좌표가 없으므로 지오코딩 필수)
      // daily-rotation에서는 속도를 위해 신규 ID인 경우만 지오코딩 권장되나, LX는 수량이 적으므로 매번 시도 후 DB 캐시 활용
      const coords = await getKakaoCoordinates(addr);

      chunk.push({
        id, api_source: 'LX_RESTAURANT', category: 'RESTAURANT',
        name, address: addr, trust_score: 50, is_active: true,
        sido, lat: coords.lat, lng: coords.lng,
        raw_data: i, updated_at: new Date().toISOString()
      });
    }

    if (chunk.length > 0) await upsertAndTrack(chunk, stat);
  } catch (e) {
    console.error('  ❌ LX Sync Error:', e.message);
    stat.note = '💥 ERROR (파일/파싱 실패)';
  }
}

/**
 * 카카오 로컬 API를 통한 좌표 변환 (Geocoding)
 */
async function getKakaoCoordinates(addr) {
  if (!KAKAO_API_KEY) return { lat: 0, lng: 0 };
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(addr)}`;
    const data = await fetchWithRetry(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_API_KEY}` } }, 1);
    if (data?.documents?.[0]) {
      return {
        lat: parseFloat(data.documents[0].y),
        lng: parseFloat(data.documents[0].x)
      };
    }
  } catch (e) {
    console.warn(`    ⚠️ Kakao Geocoding Failed for: ${addr}`);
  }
  return { lat: 0, lng: 0 };
}

// 명소 엔진 유틸리티 (기존 로직 유지)
async function updateSpotPopularity(targetSido, stats) {
  console.log(`\n🚀 [Popularity Engine v2] Updating popularity metrics for: ${targetSido}`);
  
  const aliases = SIDO_ALIASES[targetSido] || [targetSido];
  const baseYm = await findLatestBaseYm();

  // 1. 해당 지역의 활성화된 TOUR_SPOT 조회 (페이징 처리)
  let spots = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('master_places')
      .select('id, name, sigungu, api_source, category, sido, address, lat, lng, is_active, trust_score, raw_data')
      .eq('api_source', 'TOUR_SPOT')
      .eq('is_active', true)
      .in('sido', aliases)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error(`    ❌ [Popularity] Error fetching spots page ${page}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    
    spots = [...spots, ...data];
    page++;
  }

  if (spots.length === 0) {
    console.warn(`  - [Popularity] No TOUR_SPOT found to update in ${targetSido}.`);
    return;
  }

  // 2. 시군구별 그룹화 (API 효율성 증대)
  const sigungus = [...new Set(spots.map(s => s.sigungu))].filter(Boolean);
  console.log(`  - Grouping ${spots.length} spots into ${sigungus.length} sigungus.`);

  for (const sigungu of sigungus) {
    const refSpot = spots.find(s => s.sigungu === sigungu);
    const refSido = refSpot ? refSpot.sido : targetSido;
    const { areaCd, signguCd } = getAdminCodes(refSido, sigungu);

    if (!areaCd || !signguCd) {
      console.warn(`    ⚠️ [Popularity] Standard codes not found for ${sigungu} under ${refSido}. Skipping.`);
      continue;
    }

    console.log(`    - Processing ${sigungu} (${signguCd}) under ${refSido} (areaCd: ${areaCd})...`);

    // (A) TMAP Associated Attractions
    try {
      const tmapUrl = `https://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&areaCd=${areaCd}&signguCd=${signguCd}&baseYm=${baseYm}&numOfRows=1000&_type=json&MobileOS=ETC&MobileApp=RAONAI`;
      const tmapData = await fetchWithRetry(tmapUrl, {}, 2);
      const tmapItems = tmapData?.response?.body?.items?.item;
      const tmapList = Array.isArray(tmapItems) ? tmapItems : (tmapItems ? [tmapItems] : []);

      // (B) KT Concentration Rate
      const ktUrl = `https://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&areaCd=${areaCd}&signguCd=${signguCd}&numOfRows=1000&_type=json&MobileOS=ETC&MobileApp=RAONAI`;
      const ktData = await fetchWithRetry(ktUrl, {}, 2);
      const ktItems = ktData?.response?.body?.items?.item;
      const ktList = Array.isArray(ktItems) ? ktItems : (ktItems ? [ktItems] : []);

      console.log(`      ✅ Received: Tmap=${tmapList.length}, KT=${ktList.length}`);
      
      // 집계 리포트 반영
      stats.categories.SPOT_TMAP_REL.fetched.active += tmapList.length;
      stats.categories.SPOT_KT_CONCTR.fetched.active += ktList.length;

      // (C) 매칭 및 DB 업데이트 (Memory Batch)
      const updates = [];
      const sigunguSpots = spots.filter(s => s.sigungu === sigungu);

      for (const spot of sigunguSpots) {
        const cleanName = getCleanString(spot.name);
        
        // TMAP 매칭 (Source 기준)
        const tmapMatch = tmapList.filter(t => getCleanString(t.tAtsNm) === cleanName);
        
        // KT 매칭
        const ktMatch = ktList.find(k => getCleanString(k.tAtsNm) === cleanName);

        if (tmapMatch.length > 0 || ktMatch) {
          const newData = { ...spot.raw_data };
          if (tmapMatch.length > 0) {
            newData.tmap_related = tmapMatch.map(m => ({
              target: m.rlteTatsNm,
              target_cd: m.rlteTatsCd,
              rank: parseInt(m.rlteRank),
              category: m.rlteCtgrySclsNm
            }));
          }
          if (ktMatch) {
            newData.kt_concentration = parseFloat(ktMatch.cnctrRate);
          }

          updates.push({
            id: spot.id,
            api_source: spot.api_source,
            category: spot.category,
            name: spot.name,
            address: spot.address,
            sido: spot.sido,
            lat: spot.lat,
            lng: spot.lng,
            is_active: spot.is_active,
            trust_score: spot.trust_score,
            raw_data: newData
          });
        }
      }

      if (updates.length > 0) {
        const { error: upError } = await supabase.from('master_places').upsert(updates);
        if (upError) console.error(`      ❌ Error updating ${updates.length} spots:`, upError.message);
        else {
          console.log(`      ✨ Successfully updated ${updates.length} spots with mobility metrics.`);
          const tmapUpdatedCount = updates.filter(u => u.raw_data?.tmap_related).length;
          const ktUpdatedCount = updates.filter(u => u.raw_data?.kt_concentration).length;
          stats.categories.SPOT_TMAP_REL.updated.active += tmapUpdatedCount;
          stats.categories.SPOT_KT_CONCTR.updated.active += ktUpdatedCount;
        }
      }

    } catch (e) {
      console.error(`    ❌ Error fetching API for ${sigungu}:`, e.message);
    }
  }
}

/**
 * [Pass 2: 전계통 점수 산출 및 가중값 적용]
 * - 17일 순환이 끝나는 매 17일차(또는 수동 트리거)에 실행
 * - 전국 BasePop 점수 정규화 및 Final Trust Score 업데이트
 */
async function finalizePopularityv2() {
  console.log(`\n💎 [Popularity Engine v2 - Pass 2] Calculating Global InScore & Normalizing...`);
  
  // 1. 모든 TOUR_SPOT의 tmap_related 데이터 로드 (페이칭 처리)
  let allSpots = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('master_places')
      .select('id, name, api_source, category, address, lat, lng, sido, is_active, raw_data, trust_score')
      .eq('api_source', 'TOUR_SPOT')
      .eq('is_active', true)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error(`❌ Error fetching spots page ${page}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    
    allSpots = [...allSpots, ...data];
    page++;
  }

  if (allSpots.length === 0) {
    console.warn('⚠️ No TOUR_SPOT data found for normalization.');
    return;
  }

  const inScoreMap = new Map(); // id -> score

  // 2. InScore(i) = Σ (1 / log2(rank + 1)) 산출
  // - 나를 "연관 관광지"로 지목한 모든 곳의 가중치 합산
  
  // 명칭 -> ID 역매핑용 맵 (전국 단위)
  const nameToId = new Map();
  allSpots.forEach(s => nameToId.set(getCleanString(s.name), s.id));

  for (const spot of allSpots) {
    const relations = spot.raw_data?.tmap_related || [];
    for (const rel of relations) {
      const targetId = nameToId.get(getCleanString(rel.target));
      if (targetId) {
        const score = 1 / Math.log2(rel.rank + 1);
        inScoreMap.set(targetId, (inScoreMap.get(targetId) || 0) + score);
      }
    }
  }

  // 3. 정규화 (0-100) 및 SeasonBoost(KT) 적용
  const scores = [...inScoreMap.values()];
  const maxIn = Math.max(...scores, 1);
  
  const updates = [];
  for (const spot of allSpots) {
    const basePopRaw = inScoreMap.get(spot.id) || 0;
    const basePopNorm = (basePopRaw / maxIn) * 100; // 0-100
    
    // SeasonBoost: KT 집중률 90 이상일 경우 1.25배 가중치 등
    const ktRate = spot.raw_data?.kt_concentration || 50;
    const boost = ktRate > 90 ? 1.25 : (ktRate > 70 ? 1.1 : 1.0);
    
    const finalPopScore = Math.min(100, Math.round(basePopNorm * boost));
    
    // 기존 trust_score 업데이트
    const newTrustScore = Math.max(50, finalPopScore);

    updates.push({
      id: spot.id,
      api_source: spot.api_source,
      category: spot.category,
      name: spot.name,
      address: spot.address,
      lat: spot.lat,
      lng: spot.lng,
      sido: spot.sido,
      is_active: spot.is_active,
      trust_score: newTrustScore,
      raw_data: {
        ...spot.raw_data,
        popularity_v2: {
          base_pop: basePopNorm,
          season_boost: boost,
          calculated_at: new Date().toISOString()
        }
      }
    });
  }

  // 4. Batch Upsert
  if (updates.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      const { error: upError } = await supabase.from('master_places').upsert(batch);
      if (upError) console.error(`❌ [Popularity v2] Error in batch ${i}:`, upError.message);
    }
    console.log(`✅ [Popularity v2] Final Trust Scores updated for ${updates.length} spots.`);
  }
}

/**
 * [SOP v11.3] 정밀 감사 결과 테이블 출력 함수
 */
function printAuditTable(stats) {
  console.log(`\n📋 [Precision Audit Report] ${stats.sido}`);
  console.log(`| 갱신 지역 | 카테고리 (세부 소스) | 기존 데이터 수 | 원천 수신 수 | 신규 삽입(New) | 변경 갱신(Upd) | 최종 총계 | 비고 |`);
  console.log(`| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |`);

  Object.entries(stats.categories).forEach(([key, val]) => {
    const note = val.note || '';
    const updatedTotal = val.updated.active + val.updated.inactive;
    const updNote = updatedTotal > 0 ? `${note} (상태변경 포함)` : note;
    
    const fmt = (v) => `${v.active}(${v.inactive})`;
    console.log(`| ${stats.sido} | ${val.label} | ${fmt(val.existing)} | ${fmt(val.fetched)} | ${fmt(val.new)} | ${fmt(val.updated)} | ${fmt(val.total)} | ${updNote} |`);
  });
}

/**
 * 행안부 LocalData 지역별 CSV 다이렉트 갱신 엔진 (마트, 모범식당 통합)
 */
async function syncLocalDataCSV(sido, seenIds, fullStats, categoryType) {
  const orgCode = SIDO_ORG_MAP[sido];
  if (!orgCode) return;

  const endpoints = categoryType === 'MART' 
    ? [ { path: 'large_scale_retail_stores', source: 'LOCALDATA_MART_LARGE', name: '대규모점포' },
        { path: 'other_food_retailers', source: 'LOCALDATA_MART_OTHER', name: '기타식품판매업' } ]
    : [ { path: 'excellent_restaurant_info', source: 'LOCALDATA_RESTAURANT_GOOD', name: '모범음식점' } ];

  for (const ep of endpoints) {
    console.log(`📥 [LocalData CSV] ${sido} (${orgCode}) ${ep.name} 다운로드 및 파싱 중...`);
    // [WAF 방어막 회피] 파일 다중 연속 다운로드로 인한 차단 방어 (1초 안전 대기)
    await delay(1000);
    
    // 1차: 직접 다운로드 시도 (연결 10초, 전송 90초), 2차: 프록시 다운로드 (연결 15초, 전송 90초)
    const directUrl = `https://file.localdata.go.kr/file/download/${ep.path}/info?orgCode=${orgCode}`;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://raon-i.co.kr';
    const proxyUrl = `${siteUrl}/api/cron/localdata-proxy?path=${ep.path}&orgCode=${orgCode}`;
    
    try {
      let res = null;
      try {
        // 1. 직접 다운로드 시도 (연결 10초 초과 시 즉시 프록시로 전환)
        res = await fetchWithTwoStageTimeout(directUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.localdata.go.kr/',
            'Accept': '*/*'
          },
          agent: httpsAgent
        }, 10000, 90000);

        if (!res.ok) {
          console.warn(`  ⚠️ Direct download failed (HTTP ${res.status}). Trying proxy fallback...`);
          res = await fetchWithTwoStageTimeout(proxyUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://www.localdata.go.kr/',
              'Accept': '*/*'
            },
            agent: httpsAgent
          }, 15000, 90000);
        }
      } catch (fetchErr) {
        console.warn(`  ⚠️ Direct download timeout/error (${fetchErr.message}). Trying proxy fallback...`);
        try {
          res = await fetchWithTwoStageTimeout(proxyUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            agent: httpsAgent
          }, 15000, 90000);
        } catch (proxyErr) {
          console.warn(`  ⚠️ Proxy download also failed (${proxyErr.message}). Skipping gracefully...`);
          res = null;
        }
      }

      const errStat = categoryType === 'MART' ? (ep.path === 'large_scale_retail_stores' ? fullStats.categories.LARGE_MART : fullStats.categories.OTHER_MART) : fullStats.categories.GOOD;
      if (!res || !res.ok) {
        const statusStr = res ? `HTTP ${res.status}` : 'Timeout / Unreachable';
        console.warn(`  ⚠️ [LocalData Failsafe] ${ep.name} 다운로드 일시 지연 (${statusStr}) - 기존 마스터 데이터 유지.`);
        errStat.note = `⚠️ 행안부 일시 지연 (${statusStr})`;
        continue;
      }
      
      const chunk = [];
      await new Promise((resolve, reject) => {
        res.body
          .pipe(iconv.decodeStream('EUC-KR'))
          .pipe(csvParser())
          .on('data', (row) => {
            const name = row['사업장명'] || row['업소명'] || '';
            const addr = row['소재지전체주소'] || row['도로명전체주소'] || row['도로명주소'] || row['지번주소'] || '';
            const status = String(row['영업상태명'] || row['상세영업상태명'] || '');
            const isOpen = status.includes('영업'); // [SOP v11.3] 폐업 데이터 수집 허용하되 is_active에 반영
            
            let finalSource = ep.source;
            let targetStat = categoryType === 'MART' ? (ep.path === 'large_scale_retail_stores' ? fullStats.categories.LARGE_MART : fullStats.categories.OTHER_MART) : fullStats.categories.GOOD;

            // SSM 식별 로직 (이름 기반)
            if (ep.path === 'large_scale_retail_stores') {
              const ssmKeywords = ['익스프레스', '에브리데이', '노브랜드', '슈퍼', '수퍼'];
              if (ssmKeywords.some(k => name.includes(k))) {
                finalSource = 'LOCALDATA_MART_SSM';
                targetStat = fullStats.categories.SSM_MART;
              }
            }

            const id = generateId(finalSource, name, addr);
            if (seenIds.has(id)) return;
            seenIds.add(id);
            if (isOpen) targetStat.fetched.active++; else targetStat.fetched.inactive++;
            
            chunk.push({
              id, api_source: finalSource, category: categoryType,
              name, address: addr, trust_score: isOpen ? (categoryType==='MART'?60:70) : 0, is_active: isOpen,
              sido: extractSido(addr) || sido, // [상시방어] 주소에서 시도 추출 우선
              sigungu: addr.split(' ')[1] || '', raw_data: row, updated_at: new Date().toISOString()
            });
          })
          .on('end', resolve)
          .on('error', reject);
      });
      
      // 대량 데이터 Upsert (Stat 트래킹은 개별적으로 진행)
      if (chunk.length > 0) {
        for (let i = 0; i < chunk.length; i += 200) {
          const slice = chunk.slice(i, i + 200);
          const ssmSlice = slice.filter(it => it.api_source === 'LOCALDATA_MART_SSM');
          const largeSlice = slice.filter(it => it.api_source === 'LOCALDATA_MART_LARGE');
          const otherSlice = slice.filter(it => it.api_source === 'LOCALDATA_MART_OTHER');
          const goodSlice = slice.filter(it => it.api_source === 'LOCALDATA_RESTAURANT_GOOD');

          if (ssmSlice.length > 0) await upsertAndTrack(ssmSlice, fullStats.categories.SSM_MART);
          if (largeSlice.length > 0) await upsertAndTrack(largeSlice, fullStats.categories.LARGE_MART);
          if (otherSlice.length > 0) await upsertAndTrack(otherSlice, fullStats.categories.OTHER_MART);
          if (goodSlice.length > 0) await upsertAndTrack(goodSlice, fullStats.categories.GOOD);
        }
      }
    } catch (e) {
      console.error(`  ❌ Parsing Error for ${ep.name}:`, e.message);
      const errStat = categoryType === 'MART' ? (ep.path === 'large_scale_retail_stores' ? fullStats.categories.LARGE_MART : fullStats.categories.OTHER_MART) : fullStats.categories.GOOD;
      errStat.note = `💥 ERROR: CSV 다운로드/파싱 실패 (${e.message})`;
    }
  }
}

/**
 * 안심식당 (농식품부) - JSON 파싱 오류가 드물어 기존 유지 (안정적)
 */
async function syncSafeRestaurants(sido, seenIds, stat) {
  console.log(`🥗 [MAFRA] ${sido} 안심식당 동기화 중...`);
  const shortSido = SIDO_SHORT_MAP[sido] || sido;
  
  // [SOP v11.3] 쿼리 별칭 확장 전략: API 서버마다 선호 명칭이 상이하므로 SIDO_ALIASES(전라북도 등) 전체 시도
  const callNames = SIDO_ALIASES[shortSido] || [shortSido];
  if (!callNames.includes(sido) && !sido.startsWith('전남광주시_')) callNames.push(sido);

  try {
    for (const callName of callNames) {
      console.log(`   - 🔎 Trying [${callName}] parameter...`);
      for (let page = 1; page <= 100; page++) { // [SOP v11.3] 1만개 제한 해제 (최대 10만개 허용, 실질적 무제한)
        const start = (page - 1) * 1000 + 1, end = page * 1000;
        const params = new URLSearchParams({ RELAX_SI_NM: callName });
        let res;
        try {
          res = await fetch(`http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/${start}/${end}?${params.toString()}`, {
            timeout: 10000
          });
        } catch (netErr) {
          console.warn(`      ⚠️  SAFE API Connection Failed (${callName}): ${netErr.message}`);
          stat.note = '⚠️ MAFRA 서버 응답 지연 (스킵)';
          break;
        }
        if (!res.ok) {
           console.warn(`      ⚠️  SAFE API Request Failed for ${callName}: HTTP ${res.status}`);
           stat.note = `⚠️ MAFRA 서버 일시 지연 (HTTP ${res.status})`;
           break;
        }
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (pe) {
          console.error(`      ❌ JSON Parsing Error for SAFE (${callName}):`, pe.message);
          break;
        }
        const items = data.Grid_20200713000000000605_1?.row || [];
        if (items.length === 0) break;

        const chunk = [];
        for (const i of items) {
          const addr = i.RELAX_ADD1 || '';
          if (!isValidRegion(addr, shortSido) && !isValidRegion(addr, sido)) continue;

          // [SOP v11.3] 안심식당 인증 해제 여부 실시간 반영
          const isCertified = i.RELAX_USE_YN === 'Y';
          
          const id = generateId('SAFE_RESTAURANT', i.RELAX_RSTRNT_NM, addr);
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          if (isCertified) stat.fetched.active++; else stat.fetched.inactive++;
          
          chunk.push({
            id, api_source: 'SAFE_RESTAURANT', category: 'RESTAURANT',
            name: i.RELAX_RSTRNT_NM, address: addr, trust_score: isCertified ? 80 : 0, is_active: isCertified,
            sido: extractSido(addr) || sido, // [상시방어] 주소 기반 우선 추출, 실패 시 targetSido
            sigungu: i.RELAX_SIDO_NM || '', raw_data: i, updated_at: new Date().toISOString()
          });
        }
        if (chunk.length > 0) await upsertAndTrack(chunk, stat);
        if (items.length < 1000) break; // 페이지 끝
      }
    }
  } catch (e) { 
    console.error('  ❌ Safe Error:', e.message); 
    stat.note = '💥 ERROR (조회/통신 실패)';
  }
}

/**
 * 백년가게 (소상공인) - 전국 데이터(1회 취득) 후 DB 기반 로컬 로테이션
 */
async function syncBaeknyeon(sido, seenIds, stat) {
  console.log(`🏢 [SMBA] ${sido} 백년가게 동기화 중 (전국 데이터 취득 후 필터링)...`);
  const shortSido = SIDO_SHORT_MAP[sido] || sido;
  try {
    const basePath = await getLatestOdcloudPath("15102255/v1");
    let page = 1, hasMore = true;
    
    while(hasMore && page <= 100) { // [SOP v11.3] 25페이지 제한 해제 (최대 1만개 허용, 전국 데이터 실질적 전체 수집)
      const url = `https://api.odcloud.kr/api${basePath}?serviceKey=${MOIS_API_KEY}&page=${page}&perPage=100`;
      const data = await fetchWithRetry(url);
      
      if (!data.data || data.data.length === 0) break;

      const chunk = [];
      for (const i of data.data) {
        const addr = i['주소'] || i['기본주소'] || '';
        if (!isValidRegion(addr, shortSido)) continue;

        // 주요사업 기반 비음식점 백년가게 사전 차단 필터
        const sector = (i['주요사업'] || i['주요사업명'] || '').trim();
        if (sector) {
          const isFood = /한식|일식|중식|경양식|음식점|식당|제과|빵|베이커리|카페|다방|분식|갈비|삼겹살|숯불구이|곱창|막창|순대|해장국|국밥|칼국수|밀면|냉면|우동|국수|요리|닭|오리|탕|게장|찜|장어|복어|주점|호프|스테이크|피자|수제버거|식육|한정식|낙지|해물|매운탕|초밥|팥죽|아귀|설렁탕|곰탕|추어탕|삼계탕|옹심이|메밀|막국수|백숙/.test(sector);
          if (!isFood) continue;
        }

        const id = generateId('SMBA_BAEK', i['업체명'], addr);
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        stat.fetched.active++;

        chunk.push({
          id, api_source: 'SMBA_BAEK', category: 'RESTAURANT',
          name: i['업체명'], address: addr, trust_score: 90, is_active: true,
          sido, raw_data: i, updated_at: new Date().toISOString()
        });
      }
      if (chunk.length > 0) await upsertAndTrack(chunk, stat);
      
      if (data.data.length < 100) hasMore = false;
      else page++;
    }
  } catch (e) {
    console.error('  ❌ Baeknyeon Final Error:', e.message);
    stat.note = '💥 ERROR (조회/통신 실패)';
  }
}

/**
 * 관광공사 지역기반 명소 동기화 (SPOT) - [SOP v15.0] modifiedtime 변경감지 + 400개 분할 롤링 갱신 엔진
 */
async function syncTourSpots(sido, seenIds, stat) {
  const isJeonnamGwangju = sido === '전남광주시' || sido.includes('전남광주');
  const shortSido = SIDO_SHORT_MAP[sido] || sido;
  const aliases = SIDO_ALIASES[shortSido] || [sido];
  const areaCodes = isJeonnamGwangju ? ['5', '36'] : (SIDO_MAP[sido] ? [String(SIDO_MAP[sido])] : []);
  if (areaCodes.length === 0) return;

  console.log(`🏞️  [TOUR v2 High-Speed] ${sido} 명소 동기화 시작 (수정일시 감지 + 400개 분할 롤링)...`);

  // 1. 기존 DB 명소 캐시 사전 조회 (메모리 맵 구축)
  const existingMap = new Map();
  try {
    const { data: existingSpots } = await supabase
      .from('master_places')
      .select('id, name, address, description, raw_data')
      .eq('api_source', 'TOUR_SPOT')
      .in('sido', aliases);

    if (existingSpots) {
      existingSpots.forEach(s => {
        existingMap.set(s.id, s);
        if (s.raw_data?.contentid) {
          existingMap.set(String(s.raw_data.contentid), s);
        }
      });
    }
    console.log(`   - Loaded ${existingMap.size} existing SPOT cache entries from DB.`);
  } catch (dbErr) {
    console.warn(`   ⚠️ Failed to pre-fetch existing spots: ${dbErr.message}`);
  }

  let remainingRollingQuota = 400; // [대표님 승인 규격] 로테이션 1회당 최대 400개 분할 롤링
  let modifiedCount = 0;
  let rollingCount = 0;
  let cachedCount = 0;
  let newSpotCount = 0;

  let lastTourError = null;

  for (const areaCode of areaCodes) {
    console.log(`   - Fetching TourAPI list for AreaCode ${areaCode}...`);
    let pageNo = 1, hasMore = true;
    
    while (hasMore && pageNo <= 200) {
      const params = new URLSearchParams({
        serviceKey: TOUR_API_KEY,
        numOfRows: '100',
        pageNo: pageNo.toString(),
        MobileOS: 'ETC',
        MobileApp: 'RAONAI',
        _type: 'json',
        areaCode: areaCode.toString(),
        contentTypeId: '12' // 관광지
      });

      let fetchSuccess = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!fetchSuccess && retryCount < maxRetries) {
        try {
          const data = await fetchWithRetry(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?${params.toString()}`);
          if (data.response?.header?.resultCode && data.response.header.resultCode !== '0000') {
            const errMsg = data.response.header.resultMsg || 'Unknown API Error';
            console.error(`  ❌ Tour API Error Response (시도 ${retryCount + 1}/${maxRetries}):`, errMsg);
            lastTourError = errMsg;
            retryCount++;
            if (retryCount < maxRetries) {
              await delay(3000 * retryCount);
              continue;
            }
            // [v15.1 무한루프 방지] 3회 재시도 모두 실패 시 바깥 while 루프까지 안전하게 즉시 종료
            console.warn(`  ⚠️ Tour API 응답 코드 에러로 인한 안전 조기 탈출 (API 점검/장애 감지): ${errMsg}`);
            hasMore = false;
            break;
          }

          const items = data.response?.body?.items?.item || [];
          const itemList = Array.isArray(items) ? items : items ? [items] : [];
          if (itemList.length === 0) {
            hasMore = false;
            fetchSuccess = true;
            break;
          }

          fetchSuccess = true;

          // 2. 스마트 판별: 상세 조회가 필요한 대상 선별 (신규 / 수정일시 변경 / 400개 롤링 쿼터)
          const targetFetchList = [];
          const enrichedList = [];

          for (const item of itemList) {
            stat.fetched.active++; // 실제 API로부터 정상 수신된 건수 가산

            const id = generateId('TOUR_SPOT', item.title, item.addr1);
            const exist = existingMap.get(id) || (item.contentid ? existingMap.get(String(item.contentid)) : null);

            const isNew = !exist;
            const isModified = exist && item.modifiedtime && String(exist.raw_data?.modifiedtime) !== String(item.modifiedtime);
            const needsEnrich = exist && (!exist.raw_data?.operating_hours && !exist.raw_data?.usetime && !exist.description);
            const shouldRollingRefresh = exist && remainingRollingQuota > 0;

            if (isNew) {
              newSpotCount++;
              targetFetchList.push({ item, id, exist });
            } else if (isModified) {
              modifiedCount++;
              targetFetchList.push({ item, id, exist });
            } else if (needsEnrich || shouldRollingRefresh) {
              rollingCount++;
              if (shouldRollingRefresh) remainingRollingQuota--;
              targetFetchList.push({ item, id, exist });
            } else {
              cachedCount++;
              // [초고속 캐시 재활용] 기존 상세 데이터를 100% 보존하여 API 호출 0회로 통과!
              const mergedRaw = {
                ...(exist.raw_data || {}),
                ...item,
                enriched: true
              };
              enrichedList.push({
                ...item,
                operating_hours: exist.raw_data?.operating_hours || exist.raw_data?.usetime,
                closed_days: exist.raw_data?.closed_days || exist.raw_data?.restdate,
                parking_available: exist.raw_data?.parking_available || exist.raw_data?.parking,
                admission_fee: exist.raw_data?.admission_fee || exist.raw_data?.usefee,
                homepage_url: exist.raw_data?.homepage_url || "",
                description: exist.description || item.description || '한국관광공사 선정 관광명소',
                raw_detail: exist.raw_data?.raw_detail || null,
                _mergedRaw: mergedRaw
              });
            }
          }

          // 3. 선별된 대상만 5-Worker 병렬 풀로 초고속 상세 API 호출 (Keep-Alive)
          const batchSize = 5;
          for (let k = 0; k < targetFetchList.length; k += batchSize) {
            const batch = targetFetchList.slice(k, k + batchSize);
            const batchResults = await Promise.all(batch.map(async ({ item, exist }) => {
              try {
                if (item.contentid) {
                  const details = await fetchTourPlaceDetails(item.contentid, '12', TOUR_API_KEY);
                  if (details) {
                    return { ...item, ...details };
                  }
                }
                return { ...item, description: exist?.description || item.title };
              } catch (e) {
                return { ...item, description: exist?.description || item.title };
              }
            }));
            enrichedList.push(...batchResults);
            await delay(100); // 0.1초 안전 간격
          }

          // 4. DB Upsert 데이터 패키징
          const chunk = [];
          for (const i of enrichedList) {
            if (!i.title || !i.addr1) continue;
            const id = generateId('TOUR_SPOT', i.title, i.addr1);
            if (seenIds.has(id)) continue;
            seenIds.add(id);

            const raw_data = i._mergedRaw || {
              ...i,
              enriched: true,
              operating_hours: i.operating_hours || i.usetime,
              closed_days: i.closed_days || i.restdate,
              parking_available: i.parking_available || i.parking,
              admission_fee: i.admission_fee || i.usefee,
              homepage_url: i.homepage_url || ""
            };

            chunk.push({
              id, api_source: 'TOUR_SPOT', category: 'SPOT',
              name: i.title, address: i.addr1, trust_score: 50, is_active: true,
              sido, raw_data, description: i.description || '한국관광공사 선정 관광명소', 
              updated_at: new Date().toISOString()
            });
          }

          if (chunk.length > 0) await upsertAndTrack(chunk, stat);
          if (itemList.length < 100) {
            hasMore = false;
          } else {
            pageNo++;
          }
        } catch (e) { 
          lastTourError = e.message;
          retryCount++;
          console.error(`  ❌ Tour API Exception (시도 ${retryCount}/${maxRetries}):`, e.message);
          if (retryCount < maxRetries) {
            await delay(3000 * retryCount);
          } else {
            // [v15.1 가드] 1페이지부터 예외 발생 시 API 다운으로 판단하여 무한 루프 차단
            if (pageNo === 1) {
              console.warn(`  ⚠️ Tour API 1페이지 호출 예외로 인한 안전 조기 탈출 (API 점검/장애 감지): ${e.message}`);
              hasMore = false;
              break;
            } else {
              pageNo++;
              if (pageNo > 10) hasMore = false;
            }
          }
        }
      }

      // [v15.1 2중 철벽 가드] 내부 루프에서 fetchSuccess 달성 실패 시 바깥 루프 무한 헛돌기 원천 차단
      if (!fetchSuccess) {
        console.warn(`  ⚠️ Tour API AreaCode ${areaCode} p.${pageNo} 최종 실패 - 안전 루프 탈출`);
        hasMore = false;
      }
    }
  }

  stat.modified_count = modifiedCount;
  stat.rolling_count = rollingCount;
  stat.cached_count = cachedCount;
  stat.new_spot_count = newSpotCount;
  if (stat.fetched.active > 0) {
    stat.note = `⚡수정감지 ${modifiedCount}건 | 🔄롤링갱신 ${rollingCount}건 | 🚀캐시재활용 ${cachedCount}건`;
  } else if (lastTourError) {
    stat.note = `⚠️ TourAPI 수신지연 (${lastTourError.slice(0, 25)})`;
  } else {
    stat.note = '⚡수정감지 0건 | 🔄롤링갱신 0건 | 🚀캐시재활용 0건';
  }
}

/**
 * 응급의료기관 (병원) - NMC API 연동 및 지오코딩
 */
async function syncHospitals(sido, seenIds, stat) {
  console.log(`🏥 [NMC] ${sido} 병원 동기화 중...`);
  const shortSido = SIDO_SHORT_MAP[sido] || sido;
  const aliases = SIDO_ALIASES[shortSido] || [shortSido];
  const chunk = [];

  const isJeonnamGwangju = sido === '전남광주시' || sido.includes('전남광주');
  const apiSidos = isJeonnamGwangju ? ['광주', '전남', '전남광주통합특별시'] : [shortSido, sido];
  const seenApiHospKeys = new Set();

  try {
    // 1. Supabase에서 기존 병원 좌표 데이터 조회
    const { data: existingHospitals, error: selectErr } = await supabase
      .from('master_places')
      .select('id, lat, lng, address, name, raw_data')
      .eq('category', 'HOSPITAL')
      .in('sido', aliases);

    if (selectErr) {
      throw new Error(`DB Existence Check Failed: ${selectErr.message}`);
    }

    const existingMap = new Map();
    if (existingHospitals) {
      existingHospitals.forEach(h => {
        if (h.lat && h.lng) {
          const val = { id: h.id, lat: h.lat, lng: h.lng, address: h.address || '', name: h.name || '' };
          existingMap.set(h.id, val);
          if (h.raw_data?.hpid) {
            existingMap.set(h.raw_data.hpid, val);
          }
          if (h.name) {
            existingMap.set(h.name, val);
          }
        }
      });
    }

    // 2. NMC API 호출 (시도별 격리 루프)
    for (const apiSido of apiSidos) {
      let fetchSuccess = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!fetchSuccess && retryCount < maxRetries) {
        try {
          const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${MOIS_API_KEY}&STAGE1=${encodeURIComponent(apiSido)}&STAGE2=&pageNo=1&numOfRows=100&_type=json`;
          const data = await fetchWithRetry(url);
          const items = data.response?.body?.items?.item;

          fetchSuccess = true;

          if (items) {
            const itemList = Array.isArray(items) ? items : [items];

            // API 수신 고유 병원 건수 가산
            for (const item of itemList) {
              const apiHospKey = item.hpid || item.dutyName;
              if (apiHospKey && !seenApiHospKeys.has(apiHospKey)) {
                seenApiHospKeys.add(apiHospKey);
                stat.fetched.active++;
              }
            }

          // 5-Worker 병렬 풀로 상세 진료정보 초고속 동시 수집
          const detailMap = new Map();
          const hpidsToFetch = itemList.filter(i => i.hpid).map(i => i.hpid);
          const hBatchSize = 5;
          for (let b = 0; b < hpidsToFetch.length; b += hBatchSize) {
            const batch = hpidsToFetch.slice(b, b + hBatchSize);
            const res = await Promise.all(batch.map(hpid => fetchHospitalDetails(hpid, MOIS_API_KEY).catch(() => null)));
            batch.forEach((hpid, idx) => {
              if (res[idx]) detailMap.set(hpid, res[idx]);
            });
            await delay(50);
          }

          for (const item of itemList) {
            const hAddr = item.dutyAddr || '';
            const tempFid = generateId('NMC_HOSPITAL', item.dutyName, hAddr);
            
            const exist = existingMap.get(tempFid) || 
                          (item.hpid ? existingMap.get(item.hpid) : null) || 
                          existingMap.get(item.dutyName);

            let hLat = parseFloat(item.wgs84Lat);
            let hLng = parseFloat(item.wgs84Lon);
            let finalAddr = hAddr;
            let finalFid = exist ? exist.id : tempFid;

            // 기존 좌표 보존
            if (exist) {
              hLat = exist.lat;
              hLng = exist.lng;
              if (exist.address) finalAddr = exist.address;
            } 
            // 기존 좌표가 없거나 위경도가 누락된 경우 지오코딩
            else if (!hLat || !hLng || hLat <= 33 || hLat >= 39 || hLng <= 124 || hLng >= 132) {
              const coords = await getKakaoCoordinates(hAddr);
              if (coords && coords.lat && coords.lng) {
                hLat = coords.lat;
                hLng = coords.lng;
                if (coords.addr) finalAddr = coords.addr;
                await delay(50);
              }
            }

            if (hLat && hLng) {
              if (seenIds.has(finalFid)) continue;
              seenIds.add(finalFid);

              const details = item.hpid ? detailMap.get(item.hpid) : null;

              const raw_data = {
                ...item,
                badges: ['응급의료센터'],
                ...(details ? {
                  enriched: true,
                  operating_hours: details.operating_hours,
                  closed_days: details.closed_days,
                  emergency_room: details.emergency_room,
                  representative_departments: details.representative_departments,
                  parking_available: details.parking_available,
                  homepage_url: details.homepage_url || ""
                } : {})
              };

              chunk.push({
                id: finalFid,
                api_source: 'NMC_HOSPITAL',
                category: 'HOSPITAL',
                name: item.dutyName,
                description: details ? `${item.dutyName} - 응급실 가동 응급의료기관 (${details.emergency_room})` : '응급실 가동 응급의료기관 (NMC)',
                address: finalAddr,
                lat: hLat,
                lng: hLng,
                trust_score: item.dutyName?.includes('소아') ? 100 : 55,
                is_active: true,
                raw_data,
                sido,
                sigungu: ''
              });
            }
          }
        }
      } catch (subErr) {
          retryCount++;
          console.warn(`  ⚠️ NMC Stage1 (${apiSido}) fetch failed (시도 ${retryCount}/${maxRetries}): ${subErr.message}`);
          if (retryCount < maxRetries) {
            await delay(3000 * retryCount);
          }
        }
      }
    }

    if (chunk.length > 0) {
      await upsertAndTrack(chunk, stat);
    }
  } catch (e) {
    console.error('  ❌ NMC Hospital Sync Error:', e.message);
    stat.note = `⚠️ 임시 통신장애 (${e.message.slice(0, 25)})`;
    console.warn(`  [Failsafe Alert] NMC 병원 API 장애로 인해 기존 ${sido} 데이터를 보존한 채 스킵합니다.`);
  }
}

/**
 * 명소 정밀 갱신 (SOP v11.4 - TMAP/KT 내비게이션 기반으로 전환 예정)
 */
async function rotateTourPopularity(fullStats) {
  // TODO: 다음 세션에서 Tmap(BasePop) + KT(SeasonBoost) 기반 실이동 인기도 엔진으로 전면 재구현
  console.log(`\n🔝 [Popularity] 인기도 엔진 v2(v11.4) 전환 준비 중... (다음 세션 구현 예정)`);
  return 0;
}

// Helper: Upsert and Track New/Updated (Deep-Field Comparison 적용)
async function upsertAndTrack(items, stat) {
  if (items.length === 0) return;
  
  // [vFinal] 분할 슬롯 수집 데이터의 표준 sido 명칭을 '전남광주시'로 단일화
  items.forEach(it => {
    if (it.sido && it.sido.startsWith('전남광주시_')) {
      it.sido = '전남광주시';
    }
  });
  
  // [SOP v11.1] 정밀 지표 산출을 위해 구형 데이터와 필드값 하드 매칭 수행
  const ids = items.map(it => it.id);
  
  let allExisting = [];
  // [CRITICAL FIX] Supabase URL length limit 방어 (100개씩 청킹하여 조회)
  for (let i = 0; i < ids.length; i += 100) {
    const chunkIds = ids.slice(i, i + 100);
    const { data: existingChunk, error: selectErr } = await supabase.from('master_places')
      .select('id, lat, lng, name, address, trust_score, is_active, raw_data')
      .in('id', chunkIds);
      
    if (selectErr) {
      throw new Error(`[CRITICAL] DB Existence Check Failed for chunk: ${selectErr.message}`);
    }
    if (existingChunk) allExisting.push(...existingChunk);
  }
  const existing = allExisting;

  // [Failsafe] 데이터가 100건 이상인데 단 하나도 매칭되지 않는 경우는 쿼리 오류나 비정상 상황으로 간주
  if (items.length > 50 && (!existing || existing.length === 0)) {
     console.warn(`  ⚠️  Match rate is 0% for ${items.length} items. This is highly suspicious.`);
  }

  const existingMap = new Map(existing?.map(e => [e.id, e]) || []);
  console.log(`  🔍 Matching: ${existingMap.size} found / ${items.length} total fetched in this slice.`);
  
  let newsActive = 0;
  let newsInactive = 0;
  let updatesActive = 0;
  let updatesInactive = 0;

  for (const it of items) {
    if (existingMap.has(it.id)) {
      const ext = existingMap.get(it.id);
      
      // 1. 기존 좌표 보존
      if (ext.lat !== undefined && ext.lat !== null) it.lat = ext.lat;
      if (ext.lng !== undefined && ext.lng !== null) it.lng = ext.lng;

      // 2. [CRITICAL FIX] 카테고리별 상세 정보(raw_data) 유실 방지 병합 로직 추가
      if (ext.raw_data && it.raw_data) {
        const category = it.category || ext.category;
        
        if (category === 'RESTAURANT' || category === 'MART') {
          // 식당/마트: 기존 플레이라이트 크롤러 상세 정보 보존 우선
          it.raw_data = {
            ...ext.raw_data,
            ...it.raw_data,
            operating_hours: ext.raw_data.operating_hours || it.raw_data.operating_hours,
            closed_days: ext.raw_data.closed_days || it.raw_data.closed_days,
            representative_menu: ext.raw_data.representative_menu || it.raw_data.representative_menu,
            parking_available: ext.raw_data.parking_available || it.raw_data.parking_available,
            pet_friendly: ext.raw_data.pet_friendly || it.raw_data.pet_friendly,
            kakao_info: ext.raw_data.kakao_info || it.raw_data.kakao_info,
            enriched: ext.raw_data.enriched || it.raw_data.enriched
          };
        } else if (category === 'SPOT') {
          // 명소: 공공 API 상세 업데이트를 수용하되, 기존 분석 엔진 지표(Tmap/KT 인기도 등) 보존
          it.raw_data = {
            ...it.raw_data,
            ...ext.raw_data,
            popularity_v2: ext.raw_data.popularity_v2 || it.raw_data.popularity_v2,
            tier: ext.raw_data.tier || it.raw_data.tier,
            kakao_info: ext.raw_data.kakao_info || it.raw_data.kakao_info,
            enriched: ext.raw_data.enriched || it.raw_data.enriched
          };
        } else if (category === 'HOSPITAL') {
          // 병원: 실시간 응급의료 API 우선 수용하되, 카카오 부가 매핑 데이터만 보존
          it.raw_data = {
            ...it.raw_data,
            kakao_info: ext.raw_data.kakao_info || it.raw_data.kakao_info,
            badges: ext.raw_data.badges || it.raw_data.badges
          };
        } else if (category === 'FESTIVAL') {
          // 축제: 축제 전용 메타데이터 보존
          it.raw_data = {
            ...it.raw_data,
            event_start_date: ext.raw_data.event_start_date || it.raw_data.event_start_date,
            event_end_date: ext.raw_data.event_end_date || it.raw_data.event_end_date,
            homepage_url: ext.raw_data.homepage_url || it.raw_data.homepage_url
          };
        }
      }

      // 3. [Deep Compare] 진짜 핵심 데이터 변경 사항이 있는지 확인 (노이즈 제거)
      const isChanged = (
        getCleanString(it.name) !== getCleanString(ext.name) || 
        getCleanString(it.address) !== getCleanString(ext.address) || 
        it.is_active !== ext.is_active
      );

      if (isChanged) {
        if (it.is_active) updatesActive++; else updatesInactive++;
      }
    } else {
      if (it.is_active) newsActive++; else newsInactive++;
      it.lat = 0.0;
      it.lng = 0.0;
    }
  }

  stat.new.active += newsActive;
  stat.new.inactive += newsInactive;
  stat.updated.active += updatesActive;
  stat.updated.inactive += updatesInactive;

  const { error } = await supabase.from('master_places').upsert(items, { onConflict: 'id' });
  if (error) throw new Error(`[CRITICAL] DB Upsert Error: ${error.message}`);
}

// Helper: Record Automation Log (Incremental & Real-time)
async function updateAutomationLog(logId, stats, status = 'RUNNING', customMessage = null) {
  const apiStatusArr = Object.entries(stats.categories).map(([cat, val]) => ({
    name: cat,
    label: val.label,
    region: stats.sido,
    existing_count: val.existing,
    fetched_count: val.fetched,
    new_count: val.new,
    updated_count: val.updated,
    total_count: val.total,
    note: val.note || ''
  }));

  const totalProcessed = apiStatusArr.reduce((acc, curr) => acc + (curr.fetched_count?.active || 0) + (curr.fetched_count?.inactive || 0), 0);
  const msg = customMessage || `${stats.sido} 지역 순환 동기화 (${status === 'SUCCESS' ? '완료' : (status === 'RUNNING' ? '진행 중' : '일부 실패')})`;

  try {
    if (!logId) {
      const { data, error } = await supabase.from('automation_logs').insert({
        job_name: 'DAILY_REGION_SYNC',
        status: status,
        processed_count: totalProcessed,
        message: msg,
        api_status: apiStatusArr,
        created_at: new Date().toISOString()
      }).select('id').single();

      if (error) console.error('  ❌ Init Log Error:', error.message);
      return data?.id || null;
    } else {
      const { error } = await supabase.from('automation_logs').update({
        status: status,
        processed_count: totalProcessed,
        message: msg,
        api_status: apiStatusArr
      }).eq('id', logId);

      if (error) console.error('  ❌ Update Log Error:', error.message);
      return logId;
    }
  } catch (logErr) {
    console.error('  ❌ Logging Exception:', logErr.message);
    return logId;
  }
}

// Execution
dailyRegionSync().catch(async (err) => {
  console.error('💥 Fatal Daily Region Sync Error:', err);
  process.exit(1);
});

// ==========================================
// 상세 정보 갱신(Enrichment) 엔진 및 헬퍼 함수
// ==========================================

proj4.defs("TM128", "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43");

function tm128ToWgs84(x, y) {
  try {
    const [lng, lat] = proj4("TM128", "EPSG:4326", [x, y]);
    return { lat, lng };
  } catch (e) {
    console.error(`[Proj4] Coordinate transformation failed:`, e);
    return { lat: 0, lng: 0 };
  }
}

const CATEGORY_FALLBACKS = {
  RESTAURANT: {
    operating_hours: "정보 없음 (방문 전 확인 권장)",
    closed_days: "연중무휴 또는 정보 없음",
    representative_menu: [],
    price_range: "₩",
    parking_available: "확인 불가",
    pet_friendly: "확인 불가 (사전 문의 필수)",
    description: "${name}은(는) 해당 지역에 위치한 식당/카페입니다. 상세 운영 정보는 유선 확인이 필요합니다."
  },
  ROUTE_CAFE: {
    operating_hours: "정보 없음 (방문 전 확인 권장)",
    closed_days: "연중무휴 또는 정보 없음",
    representative_menu: [],
    price_range: "₩",
    parking_available: "확인 불가",
    pet_friendly: "확인 불가 (사전 문의 필수)",
    description: "${name}은(는) 해당 지역에 위치한 카페입니다. 상세 운영 정보는 유선 확인이 필요합니다."
  },
  SPOT: {
    operating_hours: "상시 개방 또는 정보 없음",
    closed_days: "연중무휴 또는 정보 없음",
    representative_menu: [],
    price_range: "무료 또는 현장 확인 필요",
    parking_available: "확인 불가",
    pet_friendly: "확인 불가",
    description: "${name}은(는) 해당 지역의 대표적인 관광명소입니다. 방문 전 개방 여부를 확인해 주세요."
  },
  MART: {
    operating_hours: "09:00 - 22:00 (점포별 상이)",
    closed_days: "매월 둘째/넷째 일요일 (지자체별 상이)",
    representative_menu: [],
    price_range: "₩",
    parking_available: "주차 가능 (일부 소형 마트 제외)",
    pet_friendly: "확인 불가",
    description: "${name}은(는) 생필품 및 식자재 구매가 가능한 마트입니다."
  },
  HOSPITAL: {
    operating_hours: "평일 09:00 - 18:00 (전화 확인 권장)",
    closed_days: "일요일/공휴일 휴무 (응급실 제외)",
    representative_menu: [],
    price_range: "₩",
    parking_available: "주차 가능",
    pet_friendly: "확인 불가",
    description: "${name}은(는) 해당 지역의 의료 시설입니다. 응급 상황 시 유선 연락 후 방문하세요."
  },
  FESTIVAL: {
    operating_hours: "행사별 상이",
    closed_days: "연중무휴 또는 정보 없음",
    representative_menu: [],
    price_range: "무료 또는 현장 확인 필요",
    parking_available: "확인 불가",
    pet_friendly: "확인 불가",
    festival_period: "일정 확인 필요 (시즌제)",
    playtime: "행사별 상이",
    admission_fee: "무료 또는 현장 확인 필요",
    homepage_url: "",
    organizer_contact: "정보 없음",
    description: "${name}은(는) 해당 지역에서 개최되는 축제/행사입니다."
  }
};

function normalizeCategory(cat) {
  const c = String(cat).toUpperCase();
  if (c.includes('RESTAURANT') || c.includes('REST_')) return 'RESTAURANT';
  if (c.includes('CAFE')) return 'ROUTE_CAFE';
  if (c.includes('SPOT') || c.includes('TOUR_SPOT')) return 'SPOT';
  if (c.includes('MART')) return 'MART';
  if (c.includes('HOSPITAL')) return 'HOSPITAL';
  if (c.includes('FESTIVAL') || c.includes('FSTVL')) return 'FESTIVAL';
  return 'SPOT';
}

async function syncPlaceDetailsEnrichment(sido, stat) {
  console.log(`ℹ️ [Enrichment] ${sido} 상세 정보 갱신 완료 (관광명소 및 의료기관은 마스터 동기화 단계에서 상세 API 결합 연동 완료됨. 식당/카페 및 마트는 fast-enrich.mjs Playwright 데몬을 통해 독립 순환 갱신 진행됨.)`);
  stat.fetched.active = 0;
  stat.new.active = 0;
  stat.updated.active = 0;
  stat.note = '⚡ 명소/병원 API 자동결합 완료 & 식당/마트는 fast-enrich 데몬 이관';
}

// 카카오 로컬 검색 API 호출
async function searchKakao(query, lat, lng) {
  if (!KAKAO_API_KEY) throw new Error("Missing KAKAO_REST_API_KEY");
  let url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
  if (lat && lng) {
    url += `&x=${lng}&y=${lat}&radius=10000`;
  }
  const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_API_KEY}` } });
  if (res.status === 429) throw new Error("KAKAO_QUOTA_EXCEEDED");
  if (!res.ok) throw new Error(`Kakao API Error (HTTP ${res.status})`);
  const data = await res.json();
  return data.documents || [];
}

// 네이버 로컬 검색 API 호출 (Fallback 용)
async function searchNaver(query) {
  const naverId = process.env.NAVER_CLIENT_ID;
  const naverSecret = process.env.NAVER_CLIENT_SECRET;
  if (!naverId || !naverSecret) throw new Error("Missing NAVER Credentials");
  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5`;
  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': naverId,
      'X-Naver-Client-Secret': naverSecret
    }
  });
  if (res.status === 429) throw new Error("NAVER_QUOTA_EXCEEDED");
  if (!res.ok) throw new Error(`Naver API Error (HTTP ${res.status})`);
  const data = await res.json();
  return data.items || [];
}

// 카카오/네이버 로컬 스위칭 검색
async function searchLocalUnified(name, address, lat, lng) {
  const cleanAddr = address.split(' ').slice(0, 3).join(' ');
  const query = `${cleanAddr} ${name}`;

  try {
    const docs = await searchKakao(query, lat, lng);
    const matched = docs.find(d => d.place_name.replace(/\s/g, '') === name.replace(/\s/g, '')) || docs[0];
    if (matched) {
      return { place_url: matched.place_url, phone: matched.phone };
    }
  } catch (e) {
    console.warn(`[Rotation Search Fallback] Kakao failed: ${e.message}. Trying Naver...`);
    try {
      const items = await searchNaver(query);
      const matched = items.find(i => i.title.replace(/<\/?[^>]+(>|$)/g, "").replace(/\s/g, '') === name.replace(/\s/g, '')) || items[0];
      if (matched) {
        const cleanName = matched.title.replace(/<\/?[^>]+(>|$)/g, "");
        return {
          place_url: matched.link || `https://search.naver.com/search.naver?query=${encodeURIComponent(cleanName)}`,
          phone: matched.telephone
        };
      }
    } catch (ne) {
      console.error(`[Rotation Search Fallback] Naver failed: ${ne.message}`);
    }
  }
  return null;
}

// 카카오 상세 모바일 JSON API 우회 파싱
async function fetchKakaoDetailJson(placeId) {
  const url = `https://place.map.kakao.com/main/v/${placeId}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Mobile Safari/537.36',
        'Accept': 'application/json'
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const basicInfo = data.basicInfo || {};
    const menuInfo = data.menuInfo || {};

    let operating_hours = '';
    let closed_days = '';
    if (basicInfo.openHour) {
      const periodList = basicInfo.openHour.periodList || [];
      if (periodList.length > 0) {
        const timeList = periodList[0].timeList || [];
        operating_hours = timeList.map(t => `${t.timeName || ''}: ${t.timePeriod || ''}`).join(', ');
        closed_days = periodList[0].offdayList?.map(o => o.weekAndDay || '').join(', ') || '';
      }
    }

    const parking_available = basicInfo.parkingInfo?.parkingYn === 'Y' ? '주차 가능' : 
                              basicInfo.parkingInfo?.parkingYn === 'N' ? '주차 불가' : '확인 불가';

    const menuList = menuInfo.menuList || [];
    const representative_menu = menuList.map(m => `${m.menu} (${m.price || ''})`).slice(0, 5);

    let pet_friendly = '확인 불가';
    const facilityInfo = basicInfo.facilityInfo || {};
    if (facilityInfo.pet === 'Y' || facilityInfo.petFriendly === 'Y') {
      pet_friendly = '동반 가능';
    } else if (facilityInfo.pet === 'N') {
      pet_friendly = '동반 불가';
    }

    return {
      operating_hours: operating_hours || undefined,
      closed_days: closed_days || undefined,
      representative_menu: representative_menu.length > 0 ? representative_menu : undefined,
      parking_available: parking_available !== '확인 불가' ? parking_available : undefined,
      pet_friendly: pet_friendly !== '확인 불가' ? pet_friendly : undefined
    };
  } catch (e) {
    console.warn(`[Rotation Scraper] Kakao JSON bypass failed: ${e.message}`);
    return null;
  }
}

// 카카오 HTML 직접 스크래핑
async function scrapeKakaoDetailHtml(placeId) {
  const url = `https://place.map.kakao.com/m/${placeId}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    const operating_hours = $('.txt_operation').text().trim();
    const parking_text = $('.ico_parking').parent().text().trim();
    const parking_available = parking_text.includes('가능') ? '주차 가능' : 
                              parking_text.includes('불가') ? '주차 불가' : '확인 불가';

    const menus = [];
    $('.list_menu .info_menu .txt_menu').each((_, el) => {
      menus.push($(el).text().trim());
    });

    return {
      operating_hours: operating_hours || undefined,
      representative_menu: menus.length > 0 ? menus.slice(0, 5) : undefined,
      parking_available: parking_available !== '확인 불가' ? parking_available : undefined
    };
  } catch (e) {
    console.warn(`[Rotation Scraper] Kakao HTML scraper failed: ${e.message}`);
    return null;
  }
}

// 상세 정보 수집 통합
async function getEnrichedDetails(name, category, placeUrl) {
  const normCat = normalizeCategory(category);
  const defaultFallback = { ...CATEGORY_FALLBACKS[normCat] };

  let kakaoId = '';
  if (placeUrl && placeUrl.includes('place.map.kakao.com/')) {
    const parts = placeUrl.split('/');
    kakaoId = parts[parts.length - 1];
  }

  if (kakaoId) {
    let details = await fetchKakaoDetailJson(kakaoId);
    if (!details) {
      details = await scrapeKakaoDetailHtml(kakaoId);
    }
    if (details) {
      return {
        operating_hours: details.operating_hours || defaultFallback.operating_hours,
        closed_days: details.closed_days || defaultFallback.closed_days,
        representative_menu: details.representative_menu || defaultFallback.representative_menu,
        price_range: details.price_range || defaultFallback.price_range,
        parking_available: details.parking_available || defaultFallback.parking_available,
        pet_friendly: details.pet_friendly || defaultFallback.pet_friendly,
        description: defaultFallback.description.replace('${name}', name)
      };
    }
  }

  defaultFallback.description = defaultFallback.description.replace('${name}', name);
  return defaultFallback;
}

// 이전의 중복 syncPlaceDetailsEnrichment 레거시 코드 블록 삭제 완료

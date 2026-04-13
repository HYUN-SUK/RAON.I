/**
 * 17일 주기 전계통 지역별 동기화 엔진 (Daily Region Sync vNext)
 * 통합 카테고리: 식당(모범/안심/백년), 마트(대규모/SSM/기타), 명소(인기도 정밀갱신)
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';
import csvParser from 'csv-parser';
import iconv from 'iconv-lite';
import { ADMIN_SIDO_MAP, SIGUNGU_CODE_MASTER, getAdminCodes } from './utils/admin-code-mapping.mjs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// API Keys
const MOIS_API_KEY = process.env.MOIS_API_KEY || process.env.PUBLIC_DATA_API_KEY;
const SAFE_API_KEY = process.env.SAFE_RESTAURANT_API_KEY || process.env.SAFE_API_KEY || process.env.PUBLIC_DATA_API_KEY;
const TOUR_API_KEY = process.env.TOUR_API_KEY || process.env.PUBLIC_DATA_API_KEY;

const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const SIDO_MAP = {
  '서울특별시': 1, '인천광역시': 2, '대전광역시': 3, '대구광역시': 4, '광주광역시': 5, '부산광역시': 6, '울산광역시': 7, '세종특별자치시': 8,
  '경기도': 31, '강원특별자치도': 32, '충청북도': 33, '충청남도': 34, '경상북도': 35, '경상남도': 36, '전북특별자치도': 37, '전라남도': 38, '제주특별자치도': 39
};

const SIDO_ORG_MAP = {
  '서울특별시': '6110000_ALL', '부산광역시': '6260000_ALL', '대구광역시': '6270000_ALL',
  '인천광역시': '6280000_ALL', '광주광역시': '6290000_ALL', '대전광역시': '6300000_ALL',
  '울산광역시': '6310000_ALL', '세종특별자치시': '5690000_ALL', '경기도': '6410000_ALL',
  '강원특별자치도': '6530000_ALL', '충청북도': '6430000_ALL', '충청남도': '6440000_ALL',
  '전북특별자치도': '6540000_ALL', '전라남도': '6460000_ALL', '경상북도': '6470000_ALL',
  '경상남도': '6480000_ALL', '제주특별자치도': '6500000_ALL'
};

const SIDO_SHORT_MAP = {
  '서울특별시': '서울', '인천광역시': '인천', '대전광역시': '대전', '대구광역시': '대구', '광주광역시': '광주', '부산광역시': '부산', '울산광역시': '울산', '세종특별자치시': '세종',
  '경기도': '경기', '강원특별자치도': '강원', '충청북도': '충북', '충청남도': '충남', '경상북도': '경북', '경상남도': '경남', '전북특별자치도': '전북', '전라남도': '전남', '제주특별자치도': '제주'
};

const SIDO_ALIASES = {
  '서울': ['서울'], '부산': ['부산'], '대구': ['대구'], '인천': ['인천'],
  '광주': ['광주'], '대전': ['대전'], '울산': ['울산'], '세종': ['세종'],
  '경기': ['경기'], '강원': ['강원', '강원도', '강원특별자치도'], 
  '충북': ['충북', '충청북도'], '충남': ['충남', '충청남도'],
  '전북': ['전북', '전라북도', '전북특별자치도'], '전남': ['전남', '전라남도'],
  '경북': ['경북', '경상북도'], '경남': ['경남', '경상남도'],
  '제주': ['제주', '제주도', '제주특별자치도']
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

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, options);
      
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
      // 지수 백오프: 1s -> 2s -> 4s + Jitter
      const backoffMs = Math.pow(2, attempt-1) * 1000 + (Math.random() * 500);
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
      const url = `http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?${params.toString()}`;
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
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시', 
  '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도'
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
  const targetSido = SIDO_ROTATION[targetIndex];

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
      SPOT_TMAP_REL: { label: '명소 연관(Tmap)', ...baseStat(), note: '인기도 지표 1' },
      SPOT_KT_CONCTR: { label: '명소 집중률(KT)', ...baseStat(), note: '인기도 지표 2' },
      SPOT_READCOUNT: { label: 'SPOT (인기도 갱신)', ...baseStat(), note: '전국 순환 정밀갱신' }
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
    'TOUR_SPOT': 'SPOT'
  };

  const SIDO_ALIASES = {
    '서울특별시': ['서울특별시', '서울'],
    '부산광역시': ['부산광역시', '부산'],
    '대구광역시': ['대구광역시', '대구'],
    '인천광역시': ['인천광역시', '인천'],
    '광주광역시': ['광주광역시', '광주'],
    '대전광역시': ['대전광역시', '대전'],
    '울산광역시': ['울산광역시', '울산'],
    '세종특별자치시': ['세종특별자치시', '세종시', '세종'],
    '경기도': ['경기도', '경기'],
    '강원특별자치도': ['강원특별자치도', '강원도', '강원'],
    '충청북도': ['충청북도', '충북'],
    '충청남도': ['충청남도', '충남'],
    '전라북도': ['전라북도', '전북특별자치도', '전북'],
    '전라남도': ['전라남도', '전남'],
    '경상북도': ['경상북도', '경북'],
    '경상남도': ['경상남도', '경남'],
    '제주특별자치도': ['제주특별자치도', '제주도', '제주']
  };

  const aliases = SIDO_ALIASES[targetSido] || [targetSido];

  for (const [source, key] of Object.entries(sourceToStatKey)) {
    const { count: actCount } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).in('sido', aliases).eq('api_source', source).eq('is_active', true);
    const { count: inactCount } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).in('sido', aliases).eq('api_source', source).eq('is_active', false);
    stats.categories[key].existing.active += (actCount || 0);
    stats.categories[key].existing.inactive += (inactCount || 0);
  }

  const seenIds = new Set();

  // 2. 카테고리별 동기화 실행
  // [2.1] 식당군 (모범/안심/백년)
  await syncLocalDataCSV(targetSido, seenIds, stats, 'RESTAURANT');
  await syncSafeRestaurants(targetSido, seenIds, stats.categories.SAFE);
  await syncBaeknyeon(targetSido, seenIds, stats.categories.BAEK);

  // [2.2] 마트군 (대규모/기타식품)
  await syncLocalDataCSV(targetSido, seenIds, stats, 'MART');

  // [2.3] 명소군 (관광공사 지역기반 동기화) - KorService2
  await syncTourSpots(targetSido, seenIds, stats.categories.SPOT);

  // 3. [SOP v11.3 Update] 최종 지역별 건수 재집계 (7대 지표 정밀화)
  console.log(`\n📊 [Final Audit] ${targetSido} 지역별 최종 정합성 확인 중...`);
  for (const [source, key] of Object.entries(sourceToStatKey)) {
    const { count: actCount } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).in('sido', aliases).eq('api_source', source).eq('is_active', true);
    const { count: inactCount } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).in('sido', aliases).eq('api_source', source).eq('is_active', false);
    stats.categories[key].total.active = (actCount || 0);
    stats.categories[key].total.inactive = (inactCount || 0);
  }

  // 4. [Strike-Out] 미수산 데이터 처리 (백년가게 전용 고수 / 마트&식당은 API 기반 즉시 처리)
  console.log(`\n⚖️ [Strike-Out Check] 미확인 데이터 업데이트 중...`);
  for (const [source, key] of Object.entries(sourceToStatKey)) {
    const fetched = stats.categories[key].fetched.active + stats.categories[key].fetched.inactive;
    // API 수신 0건일 경우 Failsafe (네트워크 오류 방어)
    if (fetched === 0) {
      console.warn(`  ⚠️  [Failsafe] ${source} 수신 0건: 상태 업데이트 건너뜀.`);
      continue;
    }

    const { data: existingActive } = await supabase.from('master_places').select('id, miss_count').in('sido', aliases).eq('api_source', source).eq('is_active', true);
    
    const seen = [];      // API에서 확인됨 -> miss_count 리셋
    const unseen = [];    // API에서 미확인 -> miss_count 증가
    const toDeactivate = []; // 3회 연속 미확인 -> 비활성화
    
    for (const r of (existingActive || [])) {
      if (seenIds.has(r.id)) {
        seen.push(r.id);
      } else {
        // [SOP v11.3 Update] 관광명소(SPOT)는 폐업/인증해제 개념이 없으므로 3진 아웃 로직에서 전면 예외 처리
        if (key === 'SPOT') {
          continue;
        }
        
        // 백년가게(BAEK), 마트, 모범, 안심식당은 API 목록 누락 시 비활성화 안전장치로 유지함
        const newMiss = (r.miss_count || 0) + 1;
        if (newMiss >= 3) toDeactivate.push(r.id);
        else unseen.push({ id: r.id, miss: newMiss });
      }
    }

    // 일시 업데이트 (500건 단위)
    if (seen.length > 0) {
      for (let i = 0; i < seen.length; i += 500) {
        await supabase.from('master_places').update({ miss_count: 0 }).in('id', seen.slice(i, i + 500));
      }
    }
    for (const item of unseen) {
      await supabase.from('master_places').update({ miss_count: item.miss }).eq('id', item.id);
    }
    if (toDeactivate.length > 0) {
      console.log(`  🚫 [${key}] 3회 미노출로 인한 비활성화: ${toDeactivate.length}건`);
      await supabase.from('master_places').update({ is_active: false, miss_count: 0 }).in('id', toDeactivate);
      stats.categories[key].updated.inactive += toDeactivate.length; // 비활성화도 상태 변경이므로 업데이트에 합산
    }
  }

  // 5. 최종 데이터 건수 리프레시 및 로그 기록
  for (const [source, key] of Object.entries(sourceToStatKey)) {
    const { count: actCount } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).in('sido', aliases).eq('api_source', source).eq('is_active', true);
    const { count: inactCount } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).in('sido', aliases).eq('api_source', source).eq('is_active', false);
    stats.categories[key].total.active = (actCount || 0);
    stats.categories[key].total.inactive = (inactCount || 0);
  }
  
  // 6. [SOP v11.4] 전국 명소 인기도 순환 갱신 (TMAP/KT 기반 고도화)
  await updateSpotPopularity(targetSido, stats);

  // 7. [SOP v11.4] 17일 순환 종료 시 (전국 수집 완료 시) 글로벌 점수 최종 산출
  // - targetSido가 제주(마지막 지역)일 때 또는 17일 주기 배배수 시점
  if (targetSido === '제주특별자치도' || (dayOfYear % 17 === 0)) {
     await finalizePopularityv2();
  }

  await recordAutomationLog(stats);

  // 6. [SOP v11.3] 정밀 감사 결과 테이블 출력
  printAuditTable(stats);

  console.log(`\n✨ [Daily Rotation vNext] ${targetSido} 전계통 동기화 완료!`);
}

/**
 * [명소 실질 인기도 엔진 v2 - Pass 1: 데이터 수집]
 * - 지역별(Sido) 순환 시점에 실행
 * - TMAP 연관 관광지 + KT 집중률 API 호출 및 raw_data 저장
 */
async function updateSpotPopularity(targetSido, stats) {
  console.log(`\n🚀 [Popularity Engine v2] Updating popularity metrics for: ${targetSido}`);
  
  const aliases = SIDO_ALIASES[targetSido] || [targetSido];
  const baseYm = await findLatestBaseYm();
  const { areaCd } = getAdminCodes(targetSido);
  
  if (!areaCd) {
    console.warn(`  - [Popularity] Admin areaCd not found for ${targetSido}. Skipping.`);
    return;
  }

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
    const { signguCd } = getAdminCodes(targetSido, sigungu);
    if (!signguCd) {
      console.warn(`    ⚠️ [Popularity] Standard signguCd not found for ${sigungu}. Probing might follow.`);
      continue;
    }

    console.log(`    - Processing ${sigungu} (${signguCd})...`);

    // (A) TMAP Associated Attractions
    try {
      const tmapUrl = `http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&areaCd=${areaCd}&signguCd=${signguCd}&baseYm=${baseYm}&numOfRows=1000&_type=json&MobileOS=ETC&MobileApp=RAONAI`;
      const tmapData = await fetchWithRetry(tmapUrl, {}, 2);
      const tmapItems = tmapData?.response?.body?.items?.item;
      const tmapList = Array.isArray(tmapItems) ? tmapItems : (tmapItems ? [tmapItems] : []);

      // (B) KT Concentration Rate
      const ktUrl = `http://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&areaCd=${areaCd}&signguCd=${signguCd}&numOfRows=1000&_type=json&MobileOS=ETC&MobileApp=RAONAI`;
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
        else console.log(`      ✨ Successfully updated ${updates.length} spots with mobility metrics.`);
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
    console.log(`📥 [LocalData CSV] ${sido} ${ep.name} 다운로드 및 파싱 중...`);
    // [WAF 방어막 회피] 파일 다중 연속 다운로드로 인한 403 Forbidden 상태 방어 (3초 대기)
    await delay(3000);
    const url = `https://file.localdata.go.kr/file/download/${ep.path}/info?orgCode=${orgCode}`;
    
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.data.go.kr/' } });
      if (!res.ok) {
        console.error(`  ❌ Failed to download ${ep.name}: HTTP ${res.status}`);
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
        for (let i = 0; i < chunk.length; i += 500) {
          const slice = chunk.slice(i, i + 500);
          // 실제 stat은 각 레코드의 api_source에 맞춰서 분배해야 하나 편의상 ep 기반으로 먼저 트래킹
          // 정밀도를 위해 소스별 stat 분산 호출
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
      errStat.note = `💥 ERROR (조회/통신 실패)`;
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
  if (!callNames.includes(sido)) callNames.push(sido);

  try {
    for (const callName of callNames) {
      console.log(`   - 🔎 Trying [${callName}] parameter...`);
      for (let page = 1; page <= 100; page++) { // [SOP v11.3] 1만개 제한 해제 (최대 10만개 허용, 실질적 무제한)
        const start = (page - 1) * 1000 + 1, end = page * 1000;
        const params = new URLSearchParams({ RELAX_SI_NM: callName });
        const res = await fetch(`http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/${start}/${end}?${params.toString()}`);
        if (!res.ok) {
           console.warn(`      ⚠️  SAFE API Request Failed for ${callName}: HTTP ${res.status}`);
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
 * 관광공사 지역기반 명소 동기화 (SPOT) - KorService2 마이그레이션 완료
 */
async function syncTourSpots(sido, seenIds, stat) {
  const areaCode = SIDO_MAP[sido];
  if (!areaCode) return;

  console.log(`🏞️  [TOUR v2] ${sido} 명소(관광지) 동기화 중 (AreaCode: ${areaCode})...`);
  let pageNo = 1, hasMore = true;
  
  while (hasMore && pageNo <= 200) { // [SOP v11.3] 10페이지(1천개) 제한 해제 (최대 2만개 허용, 명소 누락 완전 방지)
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

    try {
      const data = await fetchWithRetry(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?${params.toString()}`);
      if (data.response?.header?.resultCode && data.response.header.resultCode !== '0000') {
        console.error('  ❌ Tour API Error Response:', data.response.header.resultMsg);
        break;
      }
      const items = data.response?.body?.items?.item || [];
      const itemList = Array.isArray(items) ? items : items ? [items] : [];
      if (itemList.length === 0) break;

      const chunk = [];
      for (const i of itemList) {
        if (!i.title || !i.addr1) continue;
        const id = generateId('TOUR_SPOT', i.title, i.addr1);
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        stat.fetched.active++;

        chunk.push({
          id, api_source: 'TOUR_SPOT', category: 'SPOT',
          name: i.title, address: i.addr1, trust_score: 50, is_active: true,
          sido, raw_data: i, updated_at: new Date().toISOString()
        });
      }
      await upsertAndTrack(chunk, stat);
      if (itemList.length < 100) hasMore = false;
      else pageNo++;
    } catch (e) { 
        console.error('  ❌ Tour API Final Error:', e.message); 
        stat.note = '💥 ERROR (조회/통신 실패)';
        break; 
    }
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

      // 2. [Deep Compare] 진짜 핵심 데이터 변경 사항이 있는지 확인 (노이즈 제거)
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

// Helper: Record Automation Log
async function recordAutomationLog(stats) {
  const apiStatusArr = Object.entries(stats.categories).map(([cat, val]) => ({
    name: cat,
    label: val.label,
    region: stats.sido,
    existing_count: val.existing,
    fetched_count: val.fetched,
    new_count: val.new,
    updated_count: val.updated,
    total_count: val.total
  }));

  const { error } = await supabase.from('automation_logs').insert({
    job_name: 'DAILY_REGION_SYNC',
    status: 'SUCCESS',
    processed_count: apiStatusArr.reduce((acc, curr) => acc + (curr.fetched_count?.active || 0) + (curr.fetched_count?.inactive || 0), 0),
    message: `${stats.sido} 지역 순환 동기화 완료 (식당/마트/명소)`,
    api_status: apiStatusArr,
    created_at: new Date().toISOString()
  });
  if (error) console.error('  ❌ Log Error:', error.message);
}

// Execution
dailyRegionSync();

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

const generateId = (source, name, addr) => {
  return uuidv5(`${source}|${String(name || '').trim()}|${String(addr || '').trim()}`, MY_NAMESPACE);
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

  // 지표 추적용 객체 (사용자 요청에 따라 세분화)
  const stats = {
    sido: targetSido,
    day_of_year: dayOfYear,
    categories: {
      SAFE: { label: 'RESTAURANT (안심식당)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 },
      GOOD: { label: 'RESTAURANT (모범음식점)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 },
      BAEK: { label: 'RESTAURANT (백년가게)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 },
      LARGE_MART: { label: 'MART (대형마트)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 },
      SSM_MART: { label: 'MART (준대규모 - SSM)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 },
      OTHER_MART: { label: 'MART (기타식품판매업)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 },
      SPOT: { label: 'SPOT (관광명소)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 },
      SPOT_READCOUNT: { label: 'SPOT (전국 조회수 갱신)', existing: 0, fetched: 800, new: 0, updated: 0, total: 0 }
    }
  };

  // 1. 사전 카운트 (기존 데이터 수 - 현행 소스명만 사용, 과거 소스명 제거 완료)
  const sourceToStatKey = {
    'SAFE_RESTAURANT': 'SAFE', 
    'LOCALDATA_RESTAURANT_GOOD': 'GOOD',
    'SMBA_BAEK': 'BAEK',
    'LOCALDATA_MART_LARGE': 'LARGE_MART', 
    'LOCALDATA_MART_SSM': 'SSM_MART',
    'LOCALDATA_MART_OTHER': 'OTHER_MART',
    'TOUR_SPOT': 'SPOT'
  };

  for (const [source, key] of Object.entries(sourceToStatKey)) {
    const { count } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('sido', targetSido).eq('api_source', source).eq('is_active', true);
    stats.categories[key].existing += (count || 0);
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

  // 3. Multi-Strike Soft Delete (3진 아웃 방식)
  // - API에서 확인된 데이터: miss_count를 0으로 리셋
  // - API에서 미확인된 데이터: miss_count를 +1 증가
  // - miss_count >= 3 (3회 연속 미확인 = 51일): 비활성화 처리
  for (const [source, key] of Object.entries(sourceToStatKey)) {
    const fetched = stats.categories[key].fetched;
    if (fetched > 0) {
      // 해당 소스의 active 데이터 전체 조회
      const { data: existingActive } = await supabase.from('master_places').select('id, miss_count').eq('sido', targetSido).eq('api_source', source).eq('is_active', true);
      
      const seen = [];      // API에서 확인됨 → miss_count 리셋
      const unseen = [];    // API에서 미확인 → miss_count 증가
      const toDeactivate = []; // 3회 연속 미확인 → 비활성화
      
      for (const r of (existingActive || [])) {
        if (seenIds.has(r.id)) {
          seen.push(r.id);
        } else {
          const newMiss = (r.miss_count || 0) + 1;
          if (newMiss >= 3) {
            toDeactivate.push(r.id);
          } else {
            unseen.push({ id: r.id, miss: newMiss });
          }
        }
      }

      // 확인된 데이터: miss_count 리셋 (0으로)
      if (seen.length > 0) {
        for (let i = 0; i < seen.length; i += 500) {
          await supabase.from('master_places').update({ miss_count: 0 }).in('id', seen.slice(i, i + 500));
        }
      }

      // 미확인 데이터: miss_count 증가 (아직 active 유지)
      for (const item of unseen) {
        await supabase.from('master_places').update({ miss_count: item.miss }).eq('id', item.id);
      }

      // 3진 아웃 데이터: 비활성화
      if (toDeactivate.length > 0) {
        console.log(`\n♻️  [3-Strike] Deactivating ${toDeactivate.length} records in ${targetSido} for [${source}] (3회 연속 미확인)...`);
        for (let i = 0; i < toDeactivate.length; i += 100) {
          await supabase.from('master_places').update({ is_active: false, miss_count: 3, updated_at: new Date().toISOString() }).in('id', toDeactivate.slice(i, i + 100));
        }
      }

      console.log(`  📊 [${source}] 확인: ${seen.length} | 미확인(경고): ${unseen.length} | 비활성화(3진아웃): ${toDeactivate.length}`);
    } else {
      console.log(`\n⚠️  [Failsafe] miss_count 업데이트 생략: ${source} (${targetSido}) - API 수신 0건 (API 오류 의심)`);
    }
  }

  // 4. 명소 인기도 정밀 갱신 (전국 단위 800건, 지역 순환과는 별개로 매일 누적)
  const spotUpdated = await rotateTourPopularity();
  stats.categories.SPOT_READCOUNT.updated = spotUpdated;

  // 5. 최종 카운트 (총 데이터 수)
  for (const [source, key] of Object.entries(sourceToStatKey)) {
    const { count } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('sido', targetSido).eq('api_source', source).eq('is_active', true);
    stats.categories[key].total += (count || 0);
  }
  
  // SPOT_READCOUNT 의 기존/전체 데이터 수는 SPOT과 동일하게 매핑
  stats.categories.SPOT_READCOUNT.existing = stats.categories.SPOT.existing;
  stats.categories.SPOT_READCOUNT.total = stats.categories.SPOT.total;

  // 6. 자동화 로그 기록
  await recordAutomationLog(stats);

  console.log(`\n✨ [Daily Rotation vNext] ${targetSido} 전계통 동기화 완료!`);
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
            
            if (!name || !addr) return;
            // CSV는 이미 지역 코드로 다운받았으므로 sido 체크 생략 혹은 보완
            const isOpen = status.includes('영업');
            
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
            targetStat.fetched++;
            
            chunk.push({
              id, api_source: finalSource, category: categoryType,
              name, address: addr, trust_score: isOpen ? (categoryType==='MART'?60:70) : 0, is_active: isOpen,
              sido, sigungu: addr.split(' ')[1] || '', raw_data: row, updated_at: new Date().toISOString()
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
    }
  }
}

/**
 * 안심식당 (농식품부) - JSON 파싱 오류가 드물어 기존 유지 (안정적)
 */
async function syncSafeRestaurants(sido, seenIds, stat) {
  console.log(`🥗 [MAFRA] ${sido} 안심식당 동기화 중...`);
  const shortSido = SIDO_SHORT_MAP[sido] || sido;
  try {
    for (let page = 1; page <= 10; page++) {
      const start = (page - 1) * 1000 + 1, end = page * 1000;
      // [OPTIMIZATION] 지역 필터링 파라미터 추가 (RELAX_SI_NM)
      const params = new URLSearchParams({
        RELAX_SI_NM: shortSido // '충남' 등 단축명 우선 시도 (MAFRA 표준)
      });
      const res = await fetch(`http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/${start}/${end}?${params.toString()}`);
      const data = await res.json();
      const items = data.Grid_20200713000000000605_1?.row || [];
      if (items.length === 0) break;

      const chunk = [];
      for (const i of items) {
        const addr = i.RELAX_ADD1 || '';
        if (!isValidRegion(addr, shortSido)) continue;
        if (i.RELAX_USE_YN !== 'Y') continue;

        const id = generateId('SAFE_RESTAURANT', i.RELAX_RSTRNT_NM, addr);
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        stat.fetched++;
        
        chunk.push({
          id, api_source: 'SAFE_RESTAURANT', category: 'RESTAURANT',
          name: i.RELAX_RSTRNT_NM, address: addr, trust_score: 80, is_active: true,
          sido, raw_data: i, updated_at: new Date().toISOString()
        });
      }
      if (chunk.length > 0) await upsertAndTrack(chunk, stat);
    }
  } catch (e) { console.error('  ❌ Safe Error:', e.message); }
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
    
    while(hasMore && page <= 25) {
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
        stat.fetched++;

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
  
  while (hasMore && pageNo <= 10) {
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
        stat.fetched++;

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
        console.error('  ❌ Tour API Final Error:', e.message); break; 
    }
  }
}

/**
 * 명소 정밀 갱신 (detailCommon2) 
 */
async function rotateTourPopularity() {
  console.log(`\n🔝 [Popularity] 전국 명소 중 가장 오래된 800건 정밀 갱신 시작...`);
  const { data: spots } = await supabase.from('master_places').select('id, raw_data').eq('category', 'SPOT').order('raw_data->>readcount_updated_at', { ascending: true, nullsFirst: true }).limit(800);
  if (!spots || spots.length === 0) return 0;
  
  let updatedCount = 0;
  for (const spot of spots) {
    const contentId = spot.raw_data?.contentid;
    if (!contentId) continue;

    // [API 차단 방어] 1건당 상세 호출 시 공공데이터포털 초당 요청량(TPS) 초과 방지를 위한 1초 쓰로틀링
    await delay(1000);

    try {
      const url = `https://apis.data.go.kr/B551011/KorService2/detailCommon2?serviceKey=${TOUR_API_KEY}&_type=json&MobileOS=ETC&MobileApp=RAONAI&contentId=${contentId}&defaultYN=Y&firstImageYN=Y&areacodeYN=Y&catcodeYN=Y&addrinfoYN=Y&mapinfoYN=Y&overviewYN=Y&viewcountYN=Y`;
      const data = await fetchWithRetry(url, {}, 1); // 세부조회는 부하가 크므로 재시도 우선순위 낮춤
      const item = data.response?.body?.items?.item?.[0];
      if (item) {
        const realReadCount = parseInt(item.readcount || '0');
        await supabase.from('master_places').update({
          raw_data: { ...spot.raw_data, ...item, readcount: realReadCount.toString(), readcount_synthetic: false, readcount_updated_at: new Date().toISOString() },
          trust_score: 45 + Math.min(20, Math.floor(realReadCount / 1000))
        }).eq('id', spot.id);
        updatedCount++;
      }
    } catch (e) { /* ignore individual error */ }
  }
  console.log(`  ✅ Updated ${updatedCount} spots with real readcounts.`);
  return updatedCount;
}

// Helper: Upsert and Track New/Updated
async function upsertAndTrack(items, stat) {
  if (items.length === 0) return;
  
  // 신규 vs 갱신 판별 및 기존 좌표(lat/lng) 보존을 위해 ID 조회
  const ids = items.map(it => it.id);
  const { data: existing } = await supabase.from('master_places').select('id, lat, lng').in('id', ids);
  const existingMap = new Map(existing?.map(e => [e.id, { lat: e.lat, lng: e.lng }]) || []);
  
  const news = items.filter(it => !existingMap.has(it.id)).length;
  const updates = items.length - news;
  
  // 좌표 무결성 보존 및 땜방(Fallback) 로직
  for (const it of items) {
    if (existingMap.has(it.id)) {
      const ext = existingMap.get(it.id);
      if (ext.lat !== undefined && ext.lat !== null) it.lat = ext.lat; else it.lat = 0.0;
      if (ext.lng !== undefined && ext.lng !== null) it.lng = ext.lng; else it.lng = 0.0;
    } else {
      it.lat = 0.0;
      it.lng = 0.0;
    }
  }

  stat.new += news;
  stat.updated += updates;

  const { error } = await supabase.from('master_places').upsert(items, { onConflict: 'id' });
  if (error) console.error('  ❌ Upsert Error:', error.message);
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
    processed_count: apiStatusArr.reduce((acc, curr) => acc + curr.fetched_count, 0),
    message: `${stats.sido} 지역 순환 동기화 완료 (식당/마트/명소)`,
    api_status: apiStatusArr,
    created_at: new Date().toISOString()
  });
  if (error) console.error('  ❌ Log Error:', error.message);
}

// Execution
dailyRegionSync();

/**
 * 17일 주기 전계통 지역별 동기화 엔진 (Daily Region Sync v2.0)
 * 통합 카테고리: 식당(모범/안심/백년), 마트(대규모/SSM/기타), 명소(인기도 정밀갱신)
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// API Keys
const MOIS_API_KEY = process.env.MOIS_API_KEY || process.env.PUBLIC_DATA_API_KEY;
const SAFE_API_KEY = process.env.SAFE_API_KEY || process.env.PUBLIC_DATA_API_KEY;
const TOUR_API_KEY = process.env.TOUR_API_KEY || process.env.PUBLIC_DATA_API_KEY;

const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const SIDO_MAP = {
  '서울특별시': 1, '인천광역시': 2, '대전광역시': 3, '대구광역시': 4, '광주광역시': 5, '부산광역시': 6, '울산광역시': 7, '세종특별자치시': 8,
  '경기도': 31, '강원특별자치도': 32, '충청북도': 33, '충청남도': 34, '경상북도': 35, '경상남도': 36, '전북특별자치도': 37, '전라남도': 38, '제주특별자치도': 39
};

async function dailyRegionSync() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const diff = now - startOfYear;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay) + 1;
  
  const targetIndex = (dayOfYear - 1) % SIDO_ROTATION.length;
  const targetSido = SIDO_ROTATION[targetIndex];

  console.log(`\n📅 [Day ${dayOfYear}] Target Region: ${targetSido}`);
  console.log(`🚀 Starting Daily Rotation Sync for ${targetSido}...\n`);

  // 지표 추적용 객체
  const stats = {
    sido: targetSido,
    day_of_year: dayOfYear,
    categories: {
      RESTAURANT: { label: '식당(정적)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 },
      MART: { label: '마트(정적)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 },
      SPOT: { label: '명소(정밀갱신)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 }
    }
  };

  // 1. 사전 카운트 (기존 데이터 수)
  for (const cat of ['RESTAURANT', 'MART', 'SPOT']) {
    const { count } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('sido', targetSido).eq('category', cat).eq('is_active', true);
    stats.categories[cat].existing = count || 0;
  }

  const seenIds = new Set();

  // 2. 카테고리별 동기화 실행
  // [2.1] 식당군 (모범/안심/백년)
  await syncMoisGoodRestaurants(targetSido, seenIds, stats.categories.RESTAURANT);
  await syncSafeRestaurants(targetSido, seenIds, stats.categories.RESTAURANT);
  await syncBaeknyeon(targetSido, seenIds, stats.categories.RESTAURANT);

  // [2.2] 마트군 (대규모/준대규모/기타식품)
  await syncMoisMarts(targetSido, seenIds, stats.categories.MART);

  // [2.3] 명소군 (관광공사 지역기반 동기화) - 보정 추가
  await syncTourSpots(targetSido, seenIds, stats.categories.SPOT);

  // 3. Soft Delete 처리 (이전에는 활성 상태였으나 이번 API 응답에 없는 데이터)
  // [Failsafe] API 응답이 단 1건이라도 있는 경우에만 삭제 작업을 수행하여 데이터 증발 방지
  if (seenIds.size > 0) {
    const { data: existingActive } = await supabase.from('master_places').select('id').eq('sido', targetSido).in('category', ['RESTAURANT', 'MART']).eq('is_active', true);
    const toDeactivate = (existingActive || []).map(r => r.id).filter(id => !seenIds.has(id));
    
    if (toDeactivate.length > 0) {
      console.log(`\n♻️  Deactivating ${toDeactivate.length} closed businesses in ${targetSido}...`);
      for (let i = 0; i < toDeactivate.length; i += 100) {
        await supabase.from('master_places').update({ is_active: false, updated_at: new Date().toISOString() }).in('id', toDeactivate.slice(i, i + 100));
      }
    }
  } else {
    console.log(`\n⚠️  [Failsafe] Deletion skipped: 0 items received from API sources for ${targetSido}.`);
  }

  // 4. 명소 인기도 정밀 갱신 (전국 단위 800건, 지역 순환과는 별개로 매일 누적)
  const spotUpdated = await rotateTourPopularity();
  stats.categories.SPOT.fetched += 800; // 지역 동기화(syncTourSpots) 수치에 가산
  stats.categories.SPOT.updated += spotUpdated;

  // 5. 최종 카운트 (총 데이터 수)
  for (const cat of ['RESTAURANT', 'MART', 'SPOT']) {
    const { count } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('sido', targetSido).eq('category', cat).eq('is_active', true);
    stats.categories[cat].total = count || 0;
  }

  // 6. 자동화 로그 기록
  await recordAutomationLog(stats);

  console.log(`\n✨ [Daily Rotation] ${targetSido} 전계통 동기화 완료!`);
}

/**
 * 행안부 마트 동기화 (대규모/SSM/기타식품)
 */
async function syncMoisMarts(sido, seenIds, stat) {
  console.log(`🛒 [MOIS] ${sido} 마트(대규모/SSM/기타) 동기화 중...`);
  const endpoints = [
    { name: '대규모점포', path: 'LargeScaleRetailStore/info', api_source: 'LOCALDATA_MART_LARGE' },
    { name: '준대규모점포(SSM)', path: 'QuasiWholesaleRetailStore/info', api_source: 'LOCALDATA_MART_SSM' },
    { name: '기타식품판매업', path: 'OtherFoodSalesInd/info', api_source: 'LOCALDATA_MART_OTHER' }
  ];

  for (const ep of endpoints) {
    let pageNo = 1, hasMore = true;
    while (hasMore && pageNo <= 10) {
      const url = `http://apis.data.go.kr/1741000/${ep.path}?serviceKey=${MOIS_API_KEY}&pageNo=${pageNo}&numOfRows=100&returnType=json&CTPRVN_NM=${encodeURIComponent(sido)}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        const items = data.response?.body?.items?.item || [];
        const itemList = Array.isArray(items) ? items : items ? [items] : [];
        if (itemList.length === 0) break;

        const chunk = [];
        for (const i of itemList) {
          const name = i.BSNSSP_NM || i.BPLC_NM || '';
          const addr = i.ROAD_NM_ADDR || i.SITE_WHL_ADDR || '';
          if (!name || !addr) continue;

          const id = generateId(ep.api_source, name, addr);
          seenIds.add(id);
          stat.fetched++;

          const isOpen = String(i.SALS_STTS_NM || '').includes('영업');
          chunk.push({
            id, api_source: ep.api_source, category: 'MART',
            name, address: addr, trust_score: isOpen ? 60 : 0, is_active: isOpen,
            sido, sigungu: i.SIGNGU_NM || '', raw_data: i, updated_at: new Date().toISOString()
          });
        }
        await upsertAndTrack(chunk, stat);
        if (itemList.length < 100) hasMore = false;
        else pageNo++;
      } catch (e) { console.error(`  ❌ MOIS Mart (${ep.name}) Error:`, e.message); break; }
    }
  }
}

/**
 * 행안부 모범음식점
 */
async function syncMoisGoodRestaurants(sido, seenIds, stat) {
  console.log(`🍴 [MOIS] ${sido} 모범음식점 동기화 중...`);
  let pageNo = 1, hasMore = true;
  while (hasMore && pageNo <= 50) {
    const url = `http://apis.data.go.kr/1741000/GoodRestaurantInd/info?serviceKey=${MOIS_API_KEY}&pageNo=${pageNo}&numOfRows=100&returnType=json&CTPRVN_NM=${encodeURIComponent(sido)}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const items = data.response?.body?.items?.item || [];
      const itemList = Array.isArray(items) ? items : items ? [items] : [];
      if (itemList.length === 0) break;

      const chunk = [];
      for (const i of itemList) {
        const name = i.BSNSSP_NM || i.BPLC_NM || '';
        const addr = i.ROAD_NM_ADDR || i.SITE_WHL_ADDR || '';
        const id = generateId('MOIS_GOOD_RESTAURANT', name, addr);
        seenIds.add(id);
        stat.fetched++;

        const isOpen = String(i.SALS_STTS_NM || '').includes('영업');
        chunk.push({
          id, api_source: 'MOIS_GOOD_RESTAURANT', category: 'RESTAURANT',
          name, address: addr, trust_score: isOpen ? 70 : 0, is_active: isOpen,
          sido, sigungu: i.SIGNGU_NM || '', raw_data: i, updated_at: new Date().toISOString()
        });
      }
      await upsertAndTrack(chunk, stat);
      if (itemList.length < 100) hasMore = false;
      else pageNo++;
    } catch (e) { console.error('  ❌ MOIS Error:', e.message); break; }
  }
}

/**
 * 안심식당 (농식품부)
 */
async function syncSafeRestaurants(sido, seenIds, stat) {
  console.log(`🥗 [MAFRA] ${sido} 안심식당 동기화 중...`);
  try {
    for (let page = 1; page <= 50; page++) {
      const start = (page - 1) * 1000 + 1, end = page * 1000;
      const res = await fetch(`http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/${start}/${end}`);
      const data = await res.json();
      const items = data.Grid_20200713000000000605_1?.row || [];
      if (items.length === 0) break;

      const chunk = [];
      for (const i of items) {
        if (!i.RELAX_ADD1?.includes(sido)) continue;
        if (i.RELAX_USE_YN !== 'Y') continue;

        const id = generateId('SAFE_RESTAURANT', i.RELAX_RSTRNT_NM, i.RELAX_ADD1);
        seenIds.add(id);
        stat.fetched++;
        
        chunk.push({
          id, api_source: 'SAFE_RESTAURANT', category: 'RESTAURANT',
          name: i.RELAX_RSTRNT_NM, address: i.RELAX_ADD1, trust_score: 80, is_active: true,
          sido, raw_data: i, updated_at: new Date().toISOString()
        });
      }
      if (chunk.length > 0) await upsertAndTrack(chunk, stat);
    }
  } catch (e) { console.error('  ❌ Safe Error:', e.message); }
}

/**
 * 백년가게 (소상공인)
 */
async function syncBaeknyeon(sido, seenIds, stat) {
  console.log(`🏢 [SMBA] ${sido} 백년가게 동기화 중...`);
  try {
    for (let page = 1; page <= 10; page++) {
      const url = `https://api.odcloud.kr/api/15102255/v1/uddi:6ba7b810-9dad-11d1-80b4-00c04fd430c8?serviceKey=${MOIS_API_KEY}&page=${page}&perPage=100`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.data || data.data.length === 0) break;

      const chunk = [];
      for (const i of data.data) {
        const addr = i['주소'] || i['기본주소'] || '';
        if (!addr.includes(sido)) continue;

        const id = generateId('SMBA_BAEK', i['업체명'], addr);
        seenIds.add(id);
        stat.fetched++;

        chunk.push({
          id, api_source: 'SMBA_BAEK', category: 'RESTAURANT',
          name: i['업체명'], address: addr, trust_score: 90, is_active: true,
          sido, raw_data: i, updated_at: new Date().toISOString()
        });
      }
      if (chunk.length > 0) await upsertAndTrack(chunk, stat);
    }
  } catch (e) { console.error('  ❌ Baeknyeon Error:', e.message); }
}

/**
 * 관광공사 지역기반 명소 동기화 (SPOT)
 */
async function syncTourSpots(sido, seenIds, stat) {
  const areaCode = SIDO_MAP[sido];
  if (!areaCode) return;

  console.log(`🏞️  [TOUR] ${sido} 명소(관광지) 동기화 중 (AreaCode: ${areaCode})...`);
  let pageNo = 1, hasMore = true;
  
  while (hasMore && pageNo <= 10) {
    const params = new URLSearchParams({
      serviceKey: TOUR_API_KEY,
      numOfRows: '100',
      pageNo: pageNo.toString(),
      MobileOS: 'ETC',
      MobileApp: 'RAONAI',
      _type: 'json',
      listYN: 'Y',
      arrange: 'A',
      areaCode: areaCode.toString(),
      contentTypeId: '12' // 관광지
    });

    try {
      const res = await fetch(`https://apis.data.go.kr/B551011/KorService1/areaBasedList1?${params.toString()}`);
      const data = await res.json();
      const items = data.response?.body?.items?.item || [];
      const itemList = Array.isArray(items) ? items : items ? [items] : [];
      if (itemList.length === 0) break;

      const chunk = [];
      for (const i of itemList) {
        if (!i.title || !i.addr1) continue;
        const id = generateId('TOUR_SPOT', i.title, i.addr1);
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
    } catch (e) { console.error('  ❌ Tour API Error:', e.message); break; }
  }
}

/**
 * 명소 정밀 갱신
 */
async function rotateTourPopularity() {
  console.log(`\n🔝 [Popularity] 전국 명소 중 가장 오래된 800건 정밀 갱신 시작...`);
  const { data: spots } = await supabase.from('master_places').select('id, raw_data').eq('category', 'SPOT').order('raw_data->>readcount_updated_at', { ascending: true, nullsFirst: true }).limit(800);
  if (!spots || spots.length === 0) return 0;
  
  let updatedCount = 0;
  for (const spot of spots) {
    const contentId = spot.raw_data?.contentid;
    if (!contentId) continue;
    try {
      const url = `https://apis.data.go.kr/B551011/KorService1/detailCommon2?serviceKey=${TOUR_API_KEY}&_type=json&MobileOS=ETC&MobileApp=RAONAI&contentId=${contentId}&defaultYN=Y&firstImageYN=Y&areacodeYN=Y&catcodeYN=Y&addrinfoYN=Y&mapinfoYN=Y&overviewYN=Y&viewcountYN=Y`;
      const res = await fetch(url);
      const data = await res.json();
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
  
  // 신규 vs 갱신 판별을 위해 ID 존재 여부 확인
  const ids = items.map(it => it.id);
  const { data: existing } = await supabase.from('master_places').select('id').in('id', ids);
  const existingIdSet = new Set(existing?.map(e => e.id) || []);
  
  const news = items.filter(it => !existingIdSet.has(it.id)).length;
  const updates = items.length - news;
  
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

// UUID 및 기본 정보
const SIDO_ROTATION = ['서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도'];
function generateId(source, name, address) {
    return uuidv5(`${source}|${String(name||'').trim()}|${String(address||'').trim()}`, MY_NAMESPACE);
}

dailyRegionSync();

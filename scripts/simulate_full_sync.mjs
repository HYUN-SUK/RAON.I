/**
 * 시뮬레이션 전용: 일일 지역 로테이션 전체 로직 실행 스크립트
 * 사용법: node scripts/simulate_full_sync.mjs [시도명]
 * 예시: node scripts/simulate_full_sync.mjs 울산광역시
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';
import fs from 'fs';
import csvParser from 'csv-parser';
import iconv from 'iconv-lite';
import { ADMIN_SIDO_MAP, SIGUNGU_CODE_MASTER, getAdminCodes } from './utils/admin-code-mapping.mjs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MOIS_API_KEY = process.env.MOIS_API_KEY || process.env.PUBLIC_DATA_API_KEY;
const SAFE_API_KEY = process.env.SAFE_RESTAURANT_API_KEY || process.env.SAFE_API_KEY || process.env.PUBLIC_DATA_API_KEY;
const TOUR_API_KEY = process.env.TOUR_API_KEY || process.env.PUBLIC_DATA_API_KEY;
const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY;

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

const SIDO_ALIASES_SEARCH = {
  '서울': ['서울'], '부산': ['부산'], '대구': ['대구'], '인천': ['인천'],
  '광주': ['광주'], '대전': ['대전'], '울산': ['울산'], '세종': ['세종'],
  '경기': ['경기'], '강원': ['강원', '강원도', '강원특별자치도'], 
  '충북': ['충북', '충청북도'], '충남': ['충남', '충청남도'],
  '전북': ['전북', '전라북도', '전북특별자치도'], '전남': ['전남', '전라남도'],
  '경북': ['경북', '경상북도'], '경남': ['경남', '경상남도'],
  '제주': ['제주', '제주도', '제주특별자치도']
};

const SIDO_ROTATION = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', 
  '전남광주시', 
  '대전광역시', '울산광역시', '세종특별자치시', '경기도', 
  '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '경상북도', '경상남도', '제주특별자치도'
];

function isValidRegion(addr, shortSido) {
  if (!addr) return false;
  const aliases = SIDO_ALIASES_SEARCH[shortSido] || [shortSido];
  return aliases.some(alias => addr.startsWith(alias));
}

function getNormalizedAddr(addr) {
  if (!addr) return '';
  let a = addr.replace(/,\s?대한민국$/, '').trim();
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
  a = a.replace(/^(전북|전라북도|전북특별자치도)\s?/, '전북특별자치도 ');
  a = a.replace(/^(전남|전라남도)\s?/, '전라남도 ');
  a = a.replace(/^(경북|경상북도)\s?/, '경상북도 ');
  a = a.replace(/^(경남|경상남도)\s?/, '경상남도 ');
  a = a.replace(/^(제주|제주도|제주특별자치도)\s?/, '제주특별자치도 ');
  return a.trim();
}

function getCleanString(str) {
  if (!str) return '';
  return String(str).replace(/\(.+?\)/g, '').replace(/\s+/g, '').toLowerCase();
}

const extractSido = (addr) => {
  if (!addr) return null;
  const normalized = getNormalizedAddr(addr);
  const standardSidos = SIDO_ROTATION;
  return standardSidos.find(s => normalized.startsWith(s)) || null;
};

const generateId = (source, name, addr) => {
  const normalizedAddr = getNormalizedAddr(addr);
  return uuidv5(`${source}|${getCleanString(name)}|${getCleanString(normalizedAddr)}`, MY_NAMESPACE);
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        if (res.status === 500) throw new Error(`HTTP 500 (Server Error)`);
        if (attempt === maxRetries) return res;
      }
      const text = await res.text();
      const contentType = res.headers.get('content-type') || '';
      if (text.trim().startsWith('<') || contentType.includes('text/html')) {
        throw new Error(`Invalid Response (HTML/WAF)`);
      }
      return JSON.parse(text);
    } catch (e) {
      attempt++;
      if (attempt > maxRetries) throw e;
      const backoffMs = Math.pow(2, attempt-1) * 1000 + (Math.random() * 500);
      await delay(backoffMs);
    }
  }
}

async function getKakaoCoordinates(addr) {
  if (!KAKAO_API_KEY) return { lat: 0, lng: 0 };
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(addr)}`;
    const data = await fetchWithRetry(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_API_KEY}` } }, 1);
    if (data?.documents?.[0]) {
      return { lat: parseFloat(data.documents[0].y), lng: parseFloat(data.documents[0].x) };
    }
  } catch (e) {}
  return { lat: 0, lng: 0 };
}

async function upsertAndTrack(items, stat) {
  if (items.length === 0) return;
  const ids = items.map(it => it.id);
  let allExisting = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.from('master_places').select('id, lat, lng, name, address, is_active').in('id', ids.slice(i, i + 100));
    if (data) allExisting.push(...data);
  }
  const existingMap = new Map(allExisting.map(e => [e.id, e]));
  
  for (const it of items) {
    if (existingMap.has(it.id)) {
      const ext = existingMap.get(it.id);
      if (ext.lat) it.lat = ext.lat; if (ext.lng) it.lng = ext.lng;
      const isChanged = (getCleanString(it.name) !== getCleanString(ext.name) || getCleanString(it.address) !== getCleanString(ext.address) || it.is_active !== ext.is_active);
      if (isChanged) { if (it.is_active) stat.updated.active++; else stat.updated.inactive++; }
    } else {
      if (it.is_active) stat.new.active++; else stat.new.inactive++;
      if (!it.lat) it.lat = 0; if (!it.lng) it.lng = 0;
    }
  }
  await supabase.from('master_places').upsert(items, { onConflict: 'id' });
}

// --- Sync Functions ---

async function syncLXRestaurants(sido, seenIds, stat) {
  console.log(`🏠 [LX] ${sido} 공사맛집 동기화 중 (로컬 CSV)...`);
  const csvPath = 'LX_RESTAURANT_LIST.csv';
  if (!fs.existsSync(csvPath)) return;
  const shortSido = SIDO_SHORT_MAP[sido] || sido;
  const records = [];
  await new Promise((resolve) => {
    fs.createReadStream(csvPath).pipe(iconv.decodeStream('euc-kr')).pipe(csvParser()).on('data', d => records.push(d)).on('end', resolve);
  });
  const chunk = [];
  for (const i of records) {
    const addr = i['주소'] || '';
    if (!isValidRegion(addr, shortSido) && !isValidRegion(addr, sido)) continue;
    const name = i['상호'] || '';
    const id = generateId('LX_RESTAURANT', name, addr);
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    stat.fetched.active++;
    const coords = await getKakaoCoordinates(addr);
    chunk.push({ id, api_source: 'LX_RESTAURANT', category: 'RESTAURANT', name, address: addr, trust_score: 50, is_active: true, sido, lat: coords.lat, lng: coords.lng, raw_data: i, updated_at: new Date().toISOString() });
  }
  if (chunk.length > 0) await upsertAndTrack(chunk, stat);
}

async function syncLocalDataCSV(sido, seenIds, fullStats, categoryType) {
  const SIDO_ORG_MAP = { '울산광역시': '6310000_ALL', '세종특별자치시': '5690000_ALL' }; // 시뮬레이션용 축소
  const orgCode = SIDO_ORG_MAP[sido];
  if (!orgCode) { console.log(`  - [LocalData] OrgCode not found for ${sido} in simulation. skipping.`); return; }
  const endpoints = categoryType === 'MART' 
    ? [ { path: 'large_scale_retail_stores', source: 'LOCALDATA_MART_LARGE', name: '대규모점포' } ] 
    : [ { path: 'excellent_restaurant_info', source: 'LOCALDATA_RESTAURANT_GOOD', name: '모범음식점' } ];
    
  for (const ep of endpoints) {
    console.log(`📥 [LocalData CSV] ${sido} ${ep.name} 공공데이터 수집 중...`);
    const url = `https://file.localdata.go.kr/file/download/${ep.path}/info?orgCode=${orgCode}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.data.go.kr/' } });
      const chunk = [];
      await new Promise((resolve) => {
        res.body.pipe(iconv.decodeStream('EUC-KR')).pipe(csvParser()).on('data', (row) => {
          const name = row['사업장명'] || row['업소명'] || '';
          const addr = row['소재지전체주소'] || row['도로명전체주소'] || '';
          const status = String(row['영업상태명'] || '');
          const isOpen = status.includes('영업');
          const stat = categoryType === 'MART' ? fullStats.categories.LARGE_MART : fullStats.categories.GOOD;
          const id = generateId(ep.source, name, addr);
          if (seenIds.has(id)) return; seenIds.add(id);
          if (isOpen) stat.fetched.active++; else stat.fetched.inactive++;
          chunk.push({ id, api_source: ep.source, category: categoryType, name, address: addr, trust_score: 60, is_active: isOpen, sido, raw_data: row, updated_at: new Date().toISOString() });
        }).on('end', resolve);
      });
      if (chunk.length > 0) await upsertAndTrack(chunk, categoryType === 'MART' ? fullStats.categories.LARGE_MART : fullStats.categories.GOOD);
    } catch (e) { console.error(`  ❌ Parsing Error: ${e.message}`); }
  }
}

async function simulate() {
  const targetSido = process.argv[2] || '울산광역시';
  console.log(`\n🚀 Starting REAL simulation for: ${targetSido}`);
  
  const baseStat = () => ({ existing: { active: 0, inactive: 0 }, fetched: { active: 0, inactive: 0 }, new: { active: 0, inactive: 0 }, updated: { active: 0, inactive: 0 }, total: { active: 0, inactive: 0 } });
  const stats = {
    sido: targetSido,
    categories: {
      GOOD: { label: 'RESTAURANT (모범음식점)', ...baseStat() },
      LARGE_MART: { label: 'MART (대형마트)', ...baseStat() },
      LX: { label: 'RESTAURANT (LX공사맛집)', ...baseStat() }
    }
  };

  const aliases = [targetSido, SIDO_SHORT_MAP[targetSido]];
  // 1. Existing Counts
  const sourceMap = { 'LOCALDATA_RESTAURANT_GOOD': 'GOOD', 'LOCALDATA_MART_LARGE': 'LARGE_MART', 'LX_RESTAURANT': 'LX' };
  for (const [src, key] of Object.entries(sourceMap)) {
    const { count: a } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).in('sido', aliases).eq('api_source', src).eq('is_active', true);
    const { count: i } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).in('sido', aliases).eq('api_source', src).eq('is_active', false);
    stats.categories[key].existing = { active: a || 0, inactive: i || 0 };
  }

  const seenIds = new Set();
  await syncLocalDataCSV(targetSido, seenIds, stats, 'RESTAURANT');
  await syncLocalDataCSV(targetSido, seenIds, stats, 'MART');
  await syncLXRestaurants(targetSido, seenIds, stats.categories.LX);

  // Final Counts
  for (const [src, key] of Object.entries(sourceMap)) {
    const { count: a } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).in('sido', aliases).eq('api_source', src).eq('is_active', true);
    const { count: i } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).in('sido', aliases).eq('api_source', src).eq('is_active', false);
    stats.categories[key].total = { active: a || 0, inactive: i || 0 };
  }

  console.log(`\n📋 [Simulation Audit Report] ${stats.sido}`);
  console.log(`| 갱신 지역 | 카테고리 (세부 소스) | 기존 데이터 수 | 원천 수신 수 | 신규 삽입(New) | 변경 갱신(Upd) | 최종 총계 | 비고 |`);
  console.log(`| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |`);
  Object.values(stats.categories).forEach(val => {
    const f = (v) => `${v.active}(${v.inactive})`;
    console.log(`| ${stats.sido} | ${val.label} | ${f(val.existing)} | ${f(val.fetched)} | ${f(val.new)} | ${f(val.updated)} | ${f(val.total)} | SIMULATION |`);
  });
}

simulate();

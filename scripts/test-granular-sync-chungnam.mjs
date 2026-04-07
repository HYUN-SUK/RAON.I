import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';
import csvParser from 'csv-parser';
import iconv from 'iconv-lite';
import { readFileSync, writeFileSync } from 'fs';

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

const SIDO_MAP = { '충청남도': 34 };
const SIDO_ORG_MAP = { '충청남도': '6440000_ALL' };
const SIDO_SHORT_MAP = { '충청남도': '충남' };

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function fetchWithRetry(url, options = {}, maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return JSON.parse(text);
    } catch (e) {
      attempt++;
      if (attempt > maxRetries) throw e;
      await delay(1000 * attempt);
    }
  }
}

async function getLatestOdcloudPath(namespace = "15102255/v1") {
  return `/15102255/v1/uddi:c8c0f585-8ee0-47a3-8686-3507119e0780`;
}

function generateId(source, name, address) {
    return uuidv5(`${source}|${String(name||'').trim()}|${String(address||'').trim()}`, MY_NAMESPACE);
}

async function upsertAndTrack(items, stat) {
  if (items.length === 0) return;
  const ids = items.map(it => it.id);
  const { data: existing } = await supabase.from('master_places').select('id, lat, lng').in('id', ids);
  const existingMap = new Map(existing?.map(e => [e.id, { lat: e.lat, lng: e.lng }]) || []);
  
  const news = items.filter(it => !existingMap.has(it.id)).length;
  const updates = items.length - news;
  
  for (const it of items) {
    if (existingMap.has(it.id)) {
      const ext = existingMap.get(it.id);
      if (ext.lat) it.lat = ext.lat;
      if (ext.lng) it.lng = ext.lng;
    } else {
      it.lat = 0.0;
      it.lng = 0.0;
    }
  }
  stat.new += news;
  stat.updated += updates;
  await supabase.from('master_places').upsert(items, { onConflict: 'id' });
}

async function runSimulation() {
  const targetSido = '충청남도';
  console.log(`🚀 [SIMULATION] Target: ${targetSido}`);
  
  const stats = {
    sido: targetSido,
    categories: {
      SAFE: { label: 'RESTAURANT (안심)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 },
      GOOD: { label: 'RESTAURANT (모범)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 },
      BAEK: { label: 'RESTAURANT (백년)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 },
      LARGE_MART: { label: 'MART (대형)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 },
      SSM_MART: { label: 'MART (SSM)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 },
      OTHER_MART: { label: 'MART (기타)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 },
      SPOT: { label: 'SPOT (명소)', existing: 0, fetched: 0, new: 0, updated: 0, total: 0 }
    }
  };

  const sourceToStatKey = {
    'SAFE_RESTAURANT': 'SAFE', 'LOCALDATA_RESTAURANT_GOOD': 'GOOD', 'SMBA_BAEK': 'BAEK',
    'LOCALDATA_MART_LARGE': 'LARGE_MART', 'LOCALDATA_MART_SSM': 'SSM_MART', 'LOCALDATA_MART_OTHER': 'OTHER_MART',
    'TOUR_SPOT': 'SPOT'
  };

  // 1. Initial Counts
  for (const [source, key] of Object.entries(sourceToStatKey)) {
    const { count } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('sido', targetSido).eq('api_source', source).eq('is_active', true);
    stats.categories[key].existing = count || 0;
  }

  const seenIds = new Set();
  const shortSido = SIDO_SHORT_MAP[targetSido];

  // 2. Sync Logic (Granular)
  
  // RESTAURANT - GOOD (LocalData CSV)
  const orgCode = SIDO_ORG_MAP[targetSido];
  try {
    const good_res = await fetch(`https://file.localdata.go.kr/file/download/excellent_restaurant_info/info?orgCode=${orgCode}`, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.data.go.kr/' } });
    if (good_res.ok) {
      const chunk = [];
      await new Promise((res, rej) => {
        good_res.body.pipe(iconv.decodeStream('EUC-KR')).pipe(csvParser()).on('data', (row) => {
          const name = row['사업장명'] || row['업소명'] || '';
          const addr = row['소재지전체주소'] || row['도로명전체주소'] || '';
          if (!name || !addr) return;
          const id = generateId('LOCALDATA_RESTAURANT_GOOD', name, addr);
          seenIds.add(id);
          stats.categories.GOOD.fetched++;
          chunk.push({ id, api_source: 'LOCALDATA_RESTAURANT_GOOD', category: 'RESTAURANT', name, address: addr, trust_score: 70, is_active: true, sido: targetSido, updated_at: new Date().toISOString() });
        }).on('end', res).on('error', rej);
      });
      if (chunk.length > 0) await upsertAndTrack(chunk, stats.categories.GOOD);
    }
  } catch(e) { console.error('GOOD error', e); }

  // MART (Large & SSM)
  try {
    const mart_res = await fetch(`https://file.localdata.go.kr/file/download/large_scale_retail_stores/info?orgCode=${orgCode}`, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.data.go.kr/' } });
    if (mart_res.ok) {
      const chunk = [];
      await new Promise((res, rej) => {
        mart_res.body.pipe(iconv.decodeStream('EUC-KR')).pipe(csvParser()).on('data', (row) => {
          const name = row['사업장명'] || '';
          const addr = row['소재지전체주소'] || row['도로명전체주소'] || '';
          if (!name || !addr) return;
          const ssmKeywords = ['익스프레스', '에브리데이', '노브랜드', '슈퍼', '수퍼'];
          const isSSM = ssmKeywords.some(k => name.includes(k));
          const source = isSSM ? 'LOCALDATA_MART_SSM' : 'LOCALDATA_MART_LARGE';
          const key = isSSM ? 'SSM_MART' : 'LARGE_MART';
          const id = generateId(source, name, addr);
          seenIds.add(id);
          stats.categories[key].fetched++;
          chunk.push({ id, api_source: source, category: 'MART', name, address: addr, trust_score: 60, is_active: true, sido: targetSido, updated_at: new Date().toISOString() });
        }).on('end', res).on('error', rej);
      });
      if (chunk.length > 0) {
          await upsertAndTrack(chunk.filter(it => it.api_source === 'LOCALDATA_MART_LARGE'), stats.categories.LARGE_MART);
          await upsertAndTrack(chunk.filter(it => it.api_source === 'LOCALDATA_MART_SSM'), stats.categories.SSM_MART);
      }
    }
  } catch(e) { console.error('MART Large error', e); }

  // MART (Other)
  try {
    const other_res = await fetch(`https://file.localdata.go.kr/file/download/other_food_retailers/info?orgCode=${orgCode}`, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.data.go.kr/' } });
    if (other_res.ok) {
      const chunk = [];
      await new Promise((res, rej) => {
        other_res.body.pipe(iconv.decodeStream('EUC-KR')).pipe(csvParser()).on('data', (row) => {
          const name = row['사업장명'] || '';
          const addr = row['소재지전체주소'] || row['도로명전체주소'] || '';
          if (!name || !addr) return;
          const id = generateId('LOCALDATA_MART_OTHER', name, addr);
          seenIds.add(id);
          stats.categories.OTHER_MART.fetched++;
          chunk.push({ id, api_source: 'LOCALDATA_MART_OTHER', category: 'MART', name, address: addr, trust_score: 60, is_active: true, sido: targetSido, updated_at: new Date().toISOString() });
        }).on('end', res).on('error', rej);
      });
      if (chunk.length > 0) await upsertAndTrack(chunk, stats.categories.OTHER_MART);
    }
  } catch(e) { console.error('MART Other error', e); }

  // RESTAURANT - SAFE (Agricultural Ministry) - Address Fix
  try {
    const safe_res = await fetch(`http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/1/1000`);
    const safe_data = await safe_res.json();
    const safe_items = safe_data.Grid_20200713000000000605_1?.row || [];
    const safe_chunk = [];
    for (const i of safe_items) {
      const addr = i.RELAX_ADD1 || '';
      if (addr.includes(targetSido) || addr.includes(shortSido)) {
        const id = generateId('SAFE_RESTAURANT', i.RELAX_RSTRNT_NM, addr);
        seenIds.add(id);
        stats.categories.SAFE.fetched++;
        safe_chunk.push({ id, api_source: 'SAFE_RESTAURANT', category: 'RESTAURANT', name: i.RELAX_RSTRNT_NM, address: addr, trust_score: 80, is_active: true, sido: targetSido, updated_at: new Date().toISOString() });
      }
    }
    if (safe_chunk.length > 0) await upsertAndTrack(safe_chunk, stats.categories.SAFE);
  } catch(e) { console.error('SAFE error', e); }

  // SPOT (TourAPI)
  try {
    const spot_url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${TOUR_API_KEY}&numOfRows=100&MobileOS=ETC&MobileApp=RAONAI&_type=json&areaCode=34&contentTypeId=12`;
    const spot_res = await fetch(spot_url);
    const spot_data = await spot_res.json();
    const spot_items = spot_data.response?.body?.items?.item || [];
    const spot_chunk = [];
    for (const i of (Array.isArray(spot_items) ? spot_items : [spot_items])) {
      if (i.title && i.addr1) {
        const id = generateId('TOUR_SPOT', i.title, i.addr1);
        seenIds.add(id);
        stats.categories.SPOT.fetched++;
        spot_chunk.push({ id, api_source: 'TOUR_SPOT', category: 'SPOT', name: i.title, address: i.addr1, trust_score: 50, is_active: true, sido: targetSido, updated_at: new Date().toISOString() });
      }
    }
    if (spot_chunk.length > 0) await upsertAndTrack(spot_chunk, stats.categories.SPOT);
  } catch(e) { console.error('SPOT error', e); }

  // 3. Final Counts
  for (const [source, key] of Object.entries(sourceToStatKey)) {
    const { count } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('sido', targetSido).eq('api_source', source).eq('is_active', true);
    stats.categories[key].total = count || 0;
  }

  console.log('✅ [SIMULATION RESULT]');
  console.log(JSON.stringify(stats.categories, null, 2));
}

runSimulation();

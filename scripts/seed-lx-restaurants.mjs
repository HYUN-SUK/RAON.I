/**
 * LX 공사맛집리스트 Ground Zero 초기 적재 스크립트
 * 전국의 데이터를 일시에 수집하여 DB를 초기화합니다.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';
import fs from 'fs';
import csvParser from 'csv-parser';
import iconv from 'iconv-lite';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY;
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

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

function generateId(source, name, addr) {
  const normalizedAddr = getNormalizedAddr(addr);
  const cleanName = getCleanString(name);
  const cleanAddr = getCleanString(normalizedAddr);
  return uuidv5(`${source}|${cleanName}|${cleanAddr}`, MY_NAMESPACE);
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function getKakaoCoordinates(addr) {
  if (!KAKAO_API_KEY) return { lat: 0, lng: 0 };
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(addr)}`;
    const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_API_KEY}` } });
    const data = await res.json();
    if (data?.documents?.[0]) {
      return {
        lat: parseFloat(data.documents[0].y),
        lng: parseFloat(data.documents[0].x)
      };
    }
  } catch (e) {
    console.warn(`    ⚠️ Geocoding Failed: ${addr}`);
  }
  return { lat: 0, lng: 0 };
}

async function seedLXRestaurants() {
  console.log('🚀 [Seed] Starting LX Restaurant Ground Zero Loading...');
  const csvPath = 'LX_RESTAURANT_LIST.csv';
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV not found: ${csvPath}`);
    return;
  }

  const records = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(iconv.decodeStream('euc-kr'))
      .pipe(csvParser())
      .on('data', (data) => records.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`📊 Found ${records.length} records in CSV. Processing...`);

  const chunk = [];
  let count = 0;

  for (const i of records) {
    const addr = i['주소'] || '';
    const name = i['상호'] || '';
    if (!addr || !name) continue;

    const id = generateId('LX_RESTAURANT', name, addr);
    
    // 좌표 변환 (병렬 처리 시 쿼터 관리 주의, 여기선 직렬 처리로 안정성 확보)
    const coords = await getKakaoCoordinates(addr);
    count++;

    chunk.push({
      id,
      api_source: 'LX_RESTAURANT',
      category: 'RESTAURANT',
      name,
      address: addr,
      trust_score: 50,
      is_active: true,
      sido: addr.split(' ')[0], // 단순 시도 추출
      lat: coords.lat,
      lng: coords.lng,
      raw_data: i,
      updated_at: new Date().toISOString()
    });

    if (count % 50 === 0) {
      console.log(`   - Progress: ${count}/${records.length}`);
      // Kakao API 속도 제한 방어
      await delay(100);
    }

    if (chunk.length >= 100) {
      const { error } = await supabase.from('master_places').upsert(chunk);
      if (error) console.error('  ❌ Upsert Error:', error.message);
      chunk.length = 0;
    }
  }

  if (chunk.length > 0) {
    const { error } = await supabase.from('master_places').upsert(chunk);
    if (error) console.error('  ❌ Final Upsert Error:', error.message);
  }

  console.log(`\n✨ Successfully seeded ${count} LX restaurants.`);
}

seedLXRestaurants();

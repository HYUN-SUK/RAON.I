import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { fetchHospitalDetails } from './utils/public-api-helpers.mjs';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;
const NMC_API_KEY = process.env.MOIS_API_KEY || process.env.PUBLIC_DATA_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !PUBLIC_API_KEY) {
  console.error("Missing configuration credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SIDO_LIST = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', 
  '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도', 
  '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', 
  '경상남도', '제주특별자치도'
];

function normalizeName(str) {
  if (!str) return '';
  let s = str.replace(/<\/?[^>]+(>|$)/g, "");
  s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  s = s.replace(/\([^)]+\)/g, '');
  s = s.replace(/[\s\-_,\/\\·'"]/g, '');
  return s.toLowerCase();
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI/180;
  const phi2 = lat2 * Math.PI/180;
  const deltaPhi = (lat2-lat1) * Math.PI/180;
  const deltaLambda = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function main() {
  console.log("=== Starting NMC Hospital HPID Backfill & Enrichment ===");

  // 1. DB에서 활성 병원 목록 전체 조회
  const { data: dbHospitals, error: fetchErr } = await supabase
    .from('master_places')
    .select('id, name, address, lat, lng, category, raw_data, description, api_source')
    .eq('category', 'HOSPITAL')
    .eq('is_active', true);

  if (fetchErr) {
    console.error("Failed to fetch hospitals from DB:", fetchErr.message);
    process.exit(1);
  }

  const missingHospitals = dbHospitals.filter(h => !h.raw_data?.hpid);
  console.log(`Found ${dbHospitals.length} active hospitals in DB. Missing HPID: ${missingHospitals.length} items.`);

  if (missingHospitals.length === 0) {
    console.log("No hospitals lack HPID. Exiting.");
    process.exit(0);
  }

  // 2. NMC 실시간 API를 통해 전국 응급의료기관 목록 구축
  console.log("Building nationwide NMC hospital database...");
  const nmcList = [];
  for (const sido of SIDO_LIST) {
    try {
      const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${PUBLIC_API_KEY}&STAGE1=${encodeURIComponent(sido)}&STAGE2=&pageNo=1&numOfRows=100&_type=json`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json();
      const items = data.response?.body?.items?.item;
      if (items) {
        const list = Array.isArray(items) ? items : [items];
        nmcList.push(...list);
      }
      await new Promise(r => setTimeout(r, 100)); // Rate limit guard
    } catch (e) {
      console.warn(`  ⚠️ Failed to fetch NMC data for ${sido}: ${e.message}`);
    }
  }
  console.log(`NMC Database built: ${nmcList.length} hospitals found.`);

  // 3. 거리 및 명칭 매칭 & 백필 수행
  let matchedCount = 0;
  const updates = [];

  for (const dbHosp of missingHospitals) {
    const normTarget = normalizeName(dbHosp.name);
    
    // 1차 매치: 이름 완전 일치
    let matched = nmcList.find(n => normalizeName(n.dutyName) === normTarget);

    // 2차 매치: 이름 유사 & 1.5km 이내 위치
    if (!matched) {
      matched = nmcList.find(n => {
        const normNmc = normalizeName(n.dutyName);
        const nameMatch = normNmc.includes(normTarget) || normTarget.includes(normNmc);
        if (nameMatch && dbHosp.lat && dbHosp.lng && n.wgs84Lat && n.wgs84Lon) {
          const dist = getDistance(dbHosp.lat, dbHosp.lng, parseFloat(n.wgs84Lat), parseFloat(n.wgs84Lon));
          return dist < 1500;
        }
        return false;
      });
    }

    if (matched) {
      console.log(`  [MATCH] DB: "${dbHosp.name}" (${dbHosp.address}) === NMC: "${matched.dutyName}" (HPID: ${matched.hpid})`);
      
      // NMC API에서 상세정보 긁기
      let details = null;
      let enriched = false;
      try {
        details = await fetchHospitalDetails(matched.hpid, NMC_API_KEY);
        if (details && Array.isArray(details.representative_departments) && details.representative_departments.length > 0) {
          enriched = true;
        }
      } catch (detErr) {
        console.warn(`    ⚠️ NMC detail fetch failed for ${matched.dutyName}: ${detErr.message}`);
      }

      const raw = dbHosp.raw_data || {};
      const updatedRaw = {
        ...raw,
        hpid: matched.hpid,
        enriched: enriched,
        ...(details ? {
          operating_hours: details.operating_hours,
          closed_days: details.closed_days,
          parking_available: details.parking_available,
          emergency_room: details.emergency_room,
          representative_departments: details.representative_departments,
          homepage_url: details.homepage_url || raw.homepage_url
        } : {})
      };

      updates.push({
        id: dbHosp.id,
        api_source: dbHosp.api_source || 'NMC_HOSPITAL',
        category: dbHosp.category,
        name: dbHosp.name,
        address: dbHosp.address,
        lat: dbHosp.lat,
        lng: dbHosp.lng,
        description: details?.raw_detail?.dutyName ? `${details.raw_detail.dutyName} - 응급의료시설` : dbHosp.description,
        raw_data: updatedRaw,
        updated_at: new Date().toISOString()
      });

      matchedCount++;
    } else {
      console.warn(`  [MISS] No match found for DB: "${dbHosp.name}" (${dbHosp.address})`);
    }
  }

  console.log(`\nMatching phase complete. Mapped: ${matchedCount}/${missingHospitals.length}`);

  // 4. Supabase Upsert 벌크 실행
  if (updates.length > 0) {
    console.log(`Upserting ${updates.length} backfilled hospitals into Supabase...`);
    const { error: upsertErr } = await supabase
      .from('master_places')
      .upsert(updates, { onConflict: 'id' });

    if (upsertErr) {
      console.error(`❌ DB Upsert failed: ${upsertErr.message}`);
    } else {
      console.log(`✅ NMC Hospital backfill successful! Mapped ${updates.length} hospitals.`);
    }
  }

  process.exit(0);
}

main();

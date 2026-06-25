import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { fetchHospitalDetails } from './utils/public-api-helpers.mjs';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !PUBLIC_API_KEY) {
  console.error("Missing configuration credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

function cleanKeyword(name) {
  // 핵심 키워드 추출 (예: '대전을지대학교병원' -> '을지', '의료법인 영제 의료재단 엔케이세종병원' -> '엔케이세종')
  let k = name.replace(/<\/?[^>]+(>|$)/g, "");
  k = k.replace(/\([^)]+\)/g, '');
  k = k.replace(/대학교병원/g, '').replace(/종합병원/g, '').replace(/요양병원/g, '').replace(/병원/g, '');
  k = k.replace(/의료법인|학교법인|사회복지법인|재단법인/g, '');
  k = k.trim();
  return k;
}

async function searchNmcHosp(name) {
  const keyword = cleanKeyword(name);
  if (!keyword || keyword.length < 2) return [];

  const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEgytListInfoInqire?serviceKey=${PUBLIC_API_KEY}&QN=${encodeURIComponent(keyword)}&pageNo=1&numOfRows=30&_type=json`;
  
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.response?.body?.items?.item;
    if (!items) return [];
    return Array.isArray(items) ? items : [items];
  } catch (e) {
    console.error(`  [Search Error] keyword: ${keyword}, err: ${e.message}`);
    return [];
  }
}

async function main() {
  console.log("=== Starting Precision NMC Large Hospital HPID Recovery ===");

  // 1. DB에서 HPID가 없는 활성 병원 전체 조회
  const { data: dbHospitals, error: fetchErr } = await supabase
    .from('master_places')
    .select('id, name, address, lat, lng, category, raw_data, description, api_source')
    .eq('category', 'HOSPITAL')
    .eq('is_active', true);

  if (fetchErr) {
    console.error("Failed to fetch hospitals:", fetchErr.message);
    process.exit(1);
  }

  const missingHospitals = dbHospitals.filter(h => !h.raw_data?.hpid);
  console.log(`Found ${missingHospitals.length} active hospitals missing HPID.`);

  const updates = [];
  let recoveredCount = 0;

  for (const dbHosp of missingHospitals) {
    // 요양병원, 주차장, 장례식장, 치과 등은 패스하고 이름에 '병원' 또는 '의료원'이 들어가는 대형병원급만 타겟
    const name = dbHosp.name;
    const isLargeHosp = (name.includes('병원') || name.includes('의료원')) && 
                        !name.includes('주차장') && 
                        !name.includes('장례식장') && 
                        !name.includes('동물') && 
                        !name.includes('가축') &&
                        !name.includes('마트') &&
                        !name.includes('구두');
    
    if (!isLargeHosp) continue;

    console.log(`\n🔍 Searching NMC API for Large Hospital: "${name}" (${dbHosp.address})`);
    const results = await searchNmcHosp(name);

    if (results.length === 0) {
      console.log(`  ❌ No NMC results found for keyword of "${name}"`);
      continue;
    }

    // 거리 및 이름 매칭
    let bestMatch = null;
    let minDistance = 10000; // 최대 10km 이내만 허용

    for (const r of results) {
      if (dbHosp.lat && dbHosp.lng && r.wgs84Lat && r.wgs84Lon) {
        const dist = getDistance(dbHosp.lat, dbHosp.lng, parseFloat(r.wgs84Lat), parseFloat(r.wgs84Lon));
        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = r;
        }
      } else {
        // 좌표가 없는 경우 이름 포함관계로 간단 매치
        const cleanDb = name.replace(/[\s]/g, '');
        const cleanR = r.dutyName.replace(/[\s]/g, '');
        if (cleanR.includes(cleanDb) || cleanDb.includes(cleanR)) {
          bestMatch = r;
        }
      }
    }

    if (bestMatch) {
      console.log(`  🎉 [RECOVERED] DB: "${name}" === NMC: "${bestMatch.dutyName}" (HPID: ${bestMatch.hpid}, Distance: ${minDistance.toFixed(0)}m)`);

      // 상세정보 연동
      let details = null;
      let enriched = false;
      try {
        details = await fetchHospitalDetails(bestMatch.hpid, PUBLIC_API_KEY);
        if (details && Array.isArray(details.representative_departments) && details.representative_departments.length > 0) {
          enriched = true;
        }
      } catch (detErr) {
        console.warn(`    ⚠️ NMC detail fetch failed: ${detErr.message}`);
      }

      const raw = dbHosp.raw_data || {};
      const updatedRaw = {
        ...raw,
        hpid: bestMatch.hpid,
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
        api_source: dbHosp.api_source || 'NMC_HOSPITAL_RECOVERY',
        category: dbHosp.category,
        name: dbHosp.name,
        address: dbHosp.address,
        lat: dbHosp.lat,
        lng: dbHosp.lng,
        description: details?.raw_detail?.dutyName ? `${details.raw_detail.dutyName} - 응급의료시설` : dbHosp.description,
        raw_data: updatedRaw,
        updated_at: new Date().toISOString()
      });

      recoveredCount++;
    } else {
      console.log(`  ❌ No close spatial match found for "${name}"`);
    }

    // API Rate limit guard
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n=== Recovery Phase Complete. Recovered: ${recoveredCount} large hospitals ===`);

  if (updates.length > 0) {
    console.log(`Upserting ${updates.length} recovered hospitals into Supabase...`);
    const { error: upsertErr } = await supabase
      .from('master_places')
      .upsert(updates, { onConflict: 'id' });

    if (upsertErr) {
      console.error(`❌ DB Upsert failed: ${upsertErr.message}`);
    } else {
      console.log(`✅ NMC Large Hospital Recovery successful!`);
    }
  }

  process.exit(0);
}

main();

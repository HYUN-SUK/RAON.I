const { createClient } = require('@supabase/supabase-js');
const uuid = require('uuid');
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const generateFactId = (source, name, address) => uuid.v5(`${source}|${String(name).trim()}|${String(address).trim()}`, MY_NAMESPACE);

require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

function getStandardNmcSido(sido) {
  if (!sido) return '';
  const cleanSido = sido.trim();
  const nmcSidoMap = {
    '서울특별시': '서울특별시', '서울': '서울특별시',
    '부산광역시': '부산광역시', '부산': '부산광역시',
    '대구광역시': '대구광역시', '대구': '대구광역시',
    '인천광역시': '인천광역시', '인천': '인천광역시',
    '광주광역시': '광주광역시', '광주': '광주광역시',
    '대전광역시': '대전광역시', '대전': '대전광역시',
    '울산광역시': '울산광역시', '울산': '울산광역시',
    '세종특별자치시': '세종특별자치시', '세종': '세종특별자치시',
    '경기도': '경기도', '경기': '경기도',
    '강원특별자치도': '강원특별자치도', '강원도': '강원특별자치도', '강원': '강원특별자치도',
    '충청북도': '충청북도', '충북': '충청북도',
    '충청남도': '충청남도', '충남': '충청남도',
    '전북특별자치도': '전북특별자치도', '전라북도': '전북특별자치도', '전북': '전북특별자치도',
    '전라남도': '전라남도', '전남': '전라남도',
    '경상북도': '경상북도', '경북': '경상북도',
    '경상남도': '경상남도', '경남': '경상남도',
    '제주특별자치도': '제주특별자치도', '제주도': '제주특별자치도', '제주': '제주특별자치도',
  };
  return nmcSidoMap[cleanSido] || cleanSido.substring(0, 2);
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
  a = a.replace(/^(세종특별자치시|세종)\s?/, '세종특별자치시 ');
  a = a.replace(/^(경기도|경기)\s?/, '경기도 ');
  a = a.replace(/^(강원특별자치도|강원도|강원)\s?/, '강원특별자치도 ');
  a = a.replace(/^(충청북도|충북)\s?/, '충청북도 ');
  a = a.replace(/^(충청남도|충남)\s?/, '충청남도 ');
  a = a.replace(/^(전북특별자치도|전라북도|전북)\s?/, '전북특별자치도 ');
  a = a.replace(/^(전라남도|전남)\s?/, '전라남도 ');
  a = a.replace(/^(경상북도|경북)\s?/, '경상북도 ');
  a = a.replace(/^(경상남도|경남)\s?/, '경상남도 ');
  a = a.replace(/^(제주특별자치도|제주도|제주)\s?/, '제주특별자치도 ');
  return a.trim();
}

function extractSido(addr) {
  if (!addr) return null;
  const normalized = getNormalizedAddr(addr);
  const standardSidos = [
    '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시', 
    '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도'
  ];
  return standardSidos.find(s => normalized.startsWith(s)) || null;
}

async function verify() {
  const targetDate = '2026-06-07';
  console.log(`[Verify] Querying schedules for check_in = ${targetDate}`);
  
  const { data: schedules, error: err } = await supabase
    .from('user_schedules')
    .select('*')
    .eq('check_in', targetDate);

  if (err) {
    console.error("DB query error:", err.message);
    return;
  }

  if (!schedules || schedules.length === 0) {
    console.log("No schedules found for June 7.");
    return;
  }

  const publicApiKey = process.env.PUBLIC_DATA_API_KEY;
  if (!publicApiKey) {
    console.error("PUBLIC_DATA_API_KEY is not defined in .env.local");
    return;
  }

  for (const s of schedules) {
    const lat = Number(s.campground_lat);
    const lng = Number(s.campground_lng);
    console.log(`\n===========================================`);
    console.log(`📅 Target Checkin: ${s.check_in}`);
    console.log(`⛺ Campground: ${s.campground_name}`);
    console.log(`📍 Location: (${lat}, ${lng}) - Address: ${s.campground_address}`);
    console.log(`===========================================`);

    // 1. Query master_places (category = HOSPITAL) within 30km (30000m)
    const { data: dbHospitals, error: dbErr } = await supabase.rpc('get_master_places_in_radius_v2', {
      target_lat: lat,
      target_lng: lng,
      radius_meters: 30000,
      p_category: 'HOSPITAL',
      limit_count: 500
    });

    if (dbErr) {
      console.error("Error fetching hospitals from master_places:", dbErr.message);
      continue;
    }

    if (!dbHospitals || dbHospitals.length === 0) {
      console.log("No hospitals found in 30km radius.");
      continue;
    }

    console.log(`Found ${dbHospitals.length} hospitals in master_places within 30km.`);

    // 2. Group by SIDO
    const sidos = new Set();
    for (const h of dbHospitals) {
      const sido = extractSido(h.address);
      if (sido) {
        const stdSido = getStandardNmcSido(sido);
        if (stdSido) sidos.add(stdSido);
      }
    }

    console.log("Querying NMC for Sidos:", Array.from(sidos));

    // 3. Query NMC Live Info
    const liveHospitalsMap = new Map();
    const fetch = (await import('node-fetch')).default;
    for (const sido of sidos) {
      try {
        const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${publicApiKey}&STAGE1=${encodeURIComponent(sido)}&STAGE2=&pageNo=1&numOfRows=100&_type=json`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data = await res.json();
        const items = data.response?.body?.items?.item;

        if (items) {
          const itemList = Array.isArray(items) ? items : [items];
          for (const item of itemList) {
            const hAddr = item.dutyAddr || '';
            const fid = generateFactId('NMC_HOSPITAL', item.dutyName, hAddr);
            liveHospitalsMap.set(fid, item);
            if (item.dutyName.includes('홍성의료원')) {
              console.log(`[DEBUG Live] 홍성의료원 Live Item:`, item);
              console.log(`[DEBUG Live] 홍성의료원 Live ID: ${fid} | Address: "${hAddr}"`);
            }
          }
        }
      } catch (err) {
        console.error(`Error querying NMC live data for ${sido}:`, err.message);
      }
    }

    // Print DB items for 홍성의료원 for comparison
    const debugHospList = dbHospitals.filter(h => h.name.includes('홍성') || h.name.includes('의료원'));
    console.log(`[DEBUG DB Hospitals] found ${debugHospList.length} items:`, debugHospList.map(h => ({ id: h.id, name: h.name, address: h.address, api_source: h.api_source })));

    // 4. Score and Rank
    const scoredHospitals = dbHospitals.map(h => {
      const liveItem = liveHospitalsMap.get(h.id);
      const distanceKm = h.distance_meters / 1000;

      let baseScore = 30; // Clinic default
      const name = h.name || '';

      const isNmc = h.api_source === 'NMC_HOSPITAL' || liveItem;
      if (isNmc) {
        baseScore = 150; // NMC Base 150!
      } else if (/종합병원|의료원|대학병원/.test(name)) {
        baseScore = 100;
      } else if (/내과|소아과|외과|가정의학/.test(name)) {
        baseScore = 70;
      } else if (/보건소|보건지소/.test(name)) {
        baseScore = 50;
      }

      let extraScore = 0;
      const isEmergency = /응급|야간|24시/.test(name) || /응급실/.test(liveItem?.description || h.description || '');
      if (isEmergency) {
        extraScore += 40;
      }

      // Distance score (max 40pts for 30km radius)
      const distScore = Math.max(0, (1 - (distanceKm / 30.0)) * 40);

      const finalScore = baseScore + extraScore + distScore;

      return {
        name: h.name,
        address: h.address,
        distanceKm,
        baseScore,
        extraScore,
        distScore,
        finalScore,
        liveItem: liveItem ? {
          hvec: liveItem.hvec,
          hvs01: liveItem.hvs01,
          dutyTel3: liveItem.dutyTel3
        } : null
      };
    });

    // Sort by finalScore desc
    scoredHospitals.sort((a, b) => b.finalScore - a.finalScore);

    console.log("\n--- Top Ranked Hospitals ---");
    scoredHospitals.slice(0, 10).forEach((h, i) => {
      console.log(`${i+1}. [${h.name}]`);
      console.log(`   Distance: ${h.distanceKm.toFixed(2)} km`);
      console.log(`   Base: ${h.baseScore} | Emergency: ${h.extraScore} | Distance Bonus: ${h.distScore.toFixed(1)}`);
      console.log(`   Final Score: ${h.finalScore.toFixed(1)}`);
      if (h.liveItem) {
        console.log(`   🚨 Real-time Beds: General ${h.liveItem.hvec || 'N/A'}, Pediatric ${h.liveItem.hvs01 || 'N/A'}`);
        console.log(`   📞 Emergency Tel: ${h.liveItem.dutyTel3 || 'N/A'}`);
      } else {
        console.log(`   ⚠️ Real-time Data: Not Linked`);
      }
    });
  }
}

verify();

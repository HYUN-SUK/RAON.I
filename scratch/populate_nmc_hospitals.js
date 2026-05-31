import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v5 as uuidv5 } from 'uuid';

dotenv.config({ path: '.env.local' });

const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const generateFactId = (source, name, address) => uuidv5(`${source}|${String(name).trim()}|${String(address).trim()}`, MY_NAMESPACE);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SIDO_LIST = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', 
  '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도', 
  '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', 
  '경상남도', '제주특별자치도'
];

async function geocodeAddress(name, address) {
  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (!kakaoKey) return null;
  try {
    // 1차 키워드 검색
    const query = address ? `${address.split(' ').slice(0, 3).join(' ')} ${name}` : name;
    let res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`, {
      headers: { 'Authorization': `KakaoAK ${kakaoKey}` }
    });
    let data = await res.json();
    if (data.documents?.[0]) {
      return {
        lat: parseFloat(data.documents[0].y),
        lng: parseFloat(data.documents[0].x),
        addr: data.documents[0].road_address_name || data.documents[0].address_name
      };
    }
    // 2차 주소 검색
    if (address) {
      res = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, {
        headers: { 'Authorization': `KakaoAK ${kakaoKey}` }
      });
      data = await res.json();
      if (data.documents?.[0]) {
        return {
          lat: parseFloat(data.documents[0].y),
          lng: parseFloat(data.documents[0].x),
          addr: data.documents[0].road_address?.address_name || data.documents[0].address?.address_name || address
        };
      }
    }
    return null;
  } catch (err) {
    console.error(`Geocoding error for ${name}:`, err.message);
    return null;
  }
}

async function run() {
  const publicApiKey = process.env.PUBLIC_DATA_API_KEY;
  if (!publicApiKey) {
    console.error("Missing PUBLIC_DATA_API_KEY");
    return;
  }

  console.log("Starting NMC Hospital Migration Script...");
  const rawMasterInserts = [];

  for (const sido of SIDO_LIST) {
    console.log(`Fetching hospitals for Sido: ${sido}...`);
    try {
      const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${publicApiKey}&STAGE1=${encodeURIComponent(sido)}&STAGE2=&pageNo=1&numOfRows=100&_type=json`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const data = await res.json();
      const items = data.response?.body?.items?.item;

      if (items) {
        const itemList = Array.isArray(items) ? items : [items];
        console.log(`  -> Found ${itemList.length} hospitals in ${sido}`);
        
        for (const item of itemList) {
          let hLat = parseFloat(item.wgs84Lat);
          let hLng = parseFloat(item.wgs84Lon);
          let hAddr = item.dutyAddr || '';

          // 1. 위경도가 없거나 유효하지 않은 경우 지오매핑 fallback 적용
          if (!hLat || !hLng || hLat <= 33 || hLat >= 39 || hLng <= 124 || hLng >= 132) {
            console.log(`  ⚠️ Coordinates missing/invalid for ${item.dutyName}. Attempting geocoding...`);
            const coords = await geocodeAddress(item.dutyName, hAddr);
            if (coords) {
              hLat = coords.lat;
              hLng = coords.lng;
              if (coords.addr) hAddr = coords.addr;
              console.log(`  ✅ Geocoded ${item.dutyName} to (${hLat}, ${hLng})`);
            } else {
              console.log(`  ❌ Failed to geocode coordinates for ${item.dutyName}`);
            }
          }

          if (hLat && hLng) {
            const sidoName = sido.split(' ')[0]; // 표준화된 시도명
            rawMasterInserts.push({
              id: generateFactId('NMC_HOSPITAL', item.dutyName, hAddr),
              api_source: 'NMC_HOSPITAL',
              category: 'HOSPITAL',
              name: item.dutyName,
              description: '응급실 가동 응급의료기관 (NMC)',
              address: hAddr,
              lat: hLat,
              lng: hLng,
              trust_score: item.dutyName?.includes('소아') ? 100 : 55,
              raw_data: { ...item, badges: ['응급의료센터'] },
              sido: sidoName
            });
          }
        }
      }
      // API 쓰로틀링 방지용 200ms 대기
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`Error fetching hospitals for ${sido}:`, err.message);
    }
  }

  console.log(`Total hospitals mapped: ${rawMasterInserts.length}`);

  if (rawMasterInserts.length > 0) {
    const uniqueRaw = Object.values(rawMasterInserts.reduce((acc, row) => ({ ...acc, [row.id]: row }), {}));
    console.log(`Upserting ${uniqueRaw.length} unique hospitals to master_places...`);
    
    // Chunk upsert (50개씩 끊어서 업서트)
    const chunkSize = 50;
    let upsertedCount = 0;
    for (let i = 0; i < uniqueRaw.length; i += chunkSize) {
      const chunk = uniqueRaw.slice(i, i + chunkSize);
      const { error } = await supabase.from('master_places').upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.error(`Error upserting chunk starting at index ${i}:`, error.message);
        // 복구: 1건씩 업서트 시도
        for (const row of chunk) {
          const { error: singleErr } = await supabase.from('master_places').upsert([row], { onConflict: 'id' });
          if (!singleErr) upsertedCount++;
        }
      } else {
        upsertedCount += chunk.length;
      }
    }
    console.log(`Successfully upserted ${upsertedCount}/${uniqueRaw.length} hospitals.`);
  }
}

run();

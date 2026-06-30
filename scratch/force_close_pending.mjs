import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 0원 로컬 Fallback 처리 헬퍼 (대안 2 적용)
function makeLocalFallbackDescription(name, category, address, rawData) {
  const categoryNameKo = {
    RESTAURANT: '식당',
    ROUTE_CAFE: '카페',
    MART: '마트',
    SPOT: '관광명소',
    HOSPITAL: '병원/의료시설',
    FESTIVAL: '축제/행사'
  }[category] || category || '장소';

  const cleanAddr = address ? address.split(' ').slice(0, 3).join(' ') : '해당 지역';
  const tel = rawData?.['전화번호'] || rawData?.['RELAX_RSTRNT_TEL'] || rawData?.['tel'] || '';
  const telSuffix = tel ? `(${tel})` : '';

  return `${cleanAddr} 인근의 ${categoryNameKo} ${name}입니다. 세부 정보는 사전 확인을 권장합니다. ${telSuffix}`.trim();
}

async function main() {
  console.log("=== ⚡ 식당 펜딩 잔여 6건에 대한 즉시 로컬 Fallback 마감 강제 이행 시작 ===");

  let lastId = '';
  const pendingPlaces = [];

  while (true) {
    let query = supabase
      .from('master_places')
      .select('id, name, category, address, lat, lng, raw_data, api_source, is_active, description')
      .order('id')
      .limit(4000);

    if (lastId) {
      query = query.gt('id', lastId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Fetch error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const p of data) {
      if (p.category === 'RESTAURANT' && p.is_active === true && (p.description === null || p.description === '')) {
        pendingPlaces.push(p);
      }
    }

    lastId = data[data.length - 1].id;
  }

  if (pendingPlaces.length === 0) {
    console.log("남은 펜딩 식당이 없습니다. 이미 100% 적재 완료된 상태입니다!");
    return;
  }

  console.log(`감지된 잔여 펜딩 식당 수: ${pendingPlaces.length} 건`);

  const buffer = pendingPlaces.map(place => {
    const raw = place.raw_data || {};
    const localDesc = makeLocalFallbackDescription(place.name, place.category, place.address, raw);
    return {
      id: place.id,
      category: place.category,
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      description: localDesc,
      raw_data: { ...raw, description_enriched: true, description_api_source: 'LOCAL_FALLBACK' },
      api_source: place.api_source,
      updated_at: new Date().toISOString()
    };
  });

  console.log(`Writing ${buffer.length} records to Supabase...`);

  const { error: upsertErr } = await supabase
    .from('master_places')
    .upsert(buffer, { onConflict: 'id' });

  if (upsertErr) {
    console.error("❌ 강제 마감 적재 실패:", upsertErr.message);
    return;
  }

  console.log("🎉 잔여 6건 강제 로컬 Fallback 적재 성공! 식당 카테고리 100% 완료되었습니다.");
}

main();

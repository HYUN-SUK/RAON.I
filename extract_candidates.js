const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const targetDate = '2026-03-27';
  console.log(`=== [${targetDate}] 스마트캠핑플랜 데이터 실효성 상세 점검 ===`);

  // 1. 타겟 캠핑장 정보 가져오기
  const { data: schedule } = await supabase
    .from('user_schedules')
    .select('*')
    .eq('check_in', targetDate)
    .single();

  if (!schedule) {
    console.log('3/27 예약 건을 찾을 수 없습니다.');
    return;
  }

  const { campground_lat: lat, campground_lng: lng, campground_name: name } = schedule;
  console.log(`대상: ${name} (Lat: ${lat}, Lng: ${lng})`);

  // 2. 적재된 Facts 가져오기 (smart_plan_facts)
  // route.ts에서 upsert 시 id를 MASTER_ENRICHED|이름|주소 로 생성하므로, 
  // 특정 지역의 데이터를 가져오기 위해 반경 쿼리를 직접 수행하거나, 
  // target_date 또는 created_at 기준으로 가져옵니다. 
  // 여기서는 가장 확실하게 수집된 63건을 확인하기 위해 최신 데이터 + 거리 계산을 병행합니다.

  const { data: facts } = await supabase
    .from('smart_plan_facts')
    .select('*')
    .order('category', { ascending: true })
    .order('trust_score', { ascending: false });

  if (!facts) return;

  // 캠핑장과의 거리 계산 함수
  const getDist = (fLat, fLng) => {
    const R = 6371;
    const dLat = (fLat - lat) * Math.PI / 180;
    const dLon = (fLng - lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat*Math.PI/180) * Math.cos(fLat*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const results = facts.map(f => ({
    ...f,
    distance: getDist(f.lat, f.lng)
  })).filter(f => f.distance <= 30); // 30km 반경 내 데이터만 (이번 수집 타켓)

  const out = [];
  const log = (msg) => { console.log(msg); out.push(msg); };

  log(`\n분석 대상 데이터: 총 ${results.length} 건 (30km 반경 내)`);

  const categories = ['RESTAURANT', 'MART', 'SPOT', 'HOSPITAL', 'GAS_STATION', 'FESTIVAL'];
  
  for (const cat of categories) {
    const catItems = results.filter(r => r.category === cat);
    log(`\n[${cat}] - ${catItems.length}건`);
    
    catItems.forEach((item, idx) => {
      const rating = item.raw_data?.scraping?.rating || 'N/A';
      const reviews = item.raw_data?.scraping?.reviewCount || 0;
      const kakaoUrl = item.raw_data?.kakao_url ? 'O' : 'X';
      log(`${idx+1}. ${item.name.padEnd(20)} | 거리: ${item.distance.toFixed(1)}km | 점수: ${item.trust_score} | 별점: ${rating} | 리뷰: ${reviews} | 카카오:${kakaoUrl}`);
      if (item.description) log(`   - ${item.description.substring(0, 100)}`);
      if (cat === 'GAS_STATION') log(`   - 가격 정보: ${JSON.stringify(item.raw_data?.OIL || item.raw_data)}`);
    });
  }

  fs.writeFileSync('candidate_verification_list_utf8.txt', out.join('\n'), 'utf8');
}

main().catch(console.error);

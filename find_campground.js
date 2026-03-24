const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const out = [];
  const log = (msg) => { console.log(msg); out.push(msg); };

  // 1. Find Raonai Campground
  const { data: schedule } = await supabase
    .from('user_schedules')
    .select('*')
    .ilike('campground_name', '%라온아이%')
    .single();

  if (!schedule) { log('라온아이캠핑장 정보를 찾을 수 없습니다.'); return; }
  
  const lat = schedule.campground_lat;
  const lng = schedule.campground_lng;
  log(`Campground: ${schedule.campground_name}`);
  log(`Coords: ${lat}, ${lng} | Address: ${schedule.campground_address}`);

  // 2. Query master_places for nearby MARTs (up to 20km)
  const { data: marts, error } = await supabase.rpc('get_master_places_in_radius', {
    target_lat: lat, target_lng: lng, radius_meters: 20000, limit_count: 500, p_category: 'MART'
  });

  if (error) { log(`RPC Error: ${error.message}`); return; }

  log(`\n=== 캠핑장 주변 마트 데이터Audit (반경 20km) ===`);
  log(`총 장소 수: ${marts.length}`);

  const categories = {
    BIG: [], // 이마트, 롯데마트, 홈플러스
    NH: [],  // 하나로마트, 농협
    LOCAL: [], // 식자재, 소형마트
    OTHER: [] // 패션 등
  };

  marts.forEach(m => {
    const name = m.name;
    const d = (m.distance / 1000).toFixed(1);
    const item = `${name.padEnd(25)} | ${d}km | ${m.address}`;
    
    if (/이마트|롯데마트|홈플러스/.test(name)) categories.BIG.push(item);
    else if (/하나로마트|농협/.test(name)) categories.NH.push(item);
    else if (/패션|아울렛|의류|슈즈/.test(name)) categories.OTHER.push(item);
    else categories.LOCAL.push(item);
  });

  log('\n[🥇 주요 마트 (Emart, Lotte, Homeplus)]');
  categories.BIG.forEach(i => log(` - ${i}`));
  
  log('\n[🥈 지역 거점 (Hanaro, NH)]');
  categories.NH.forEach(i => log(` - ${i}`));
  
  log('\n[🥉 일반/식자재 마트]');
  categories.LOCAL.forEach(i => log(` - ${i}`));

  log('\n[❌ 노이즈 (패션/아울렛)]');
  categories.OTHER.forEach(i => log(` - ${i}`));

  fs.writeFileSync('yesan_mart_audit.txt', out.join('\n'), 'utf8');
}

check().catch(console.error);

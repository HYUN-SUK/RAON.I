import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkSpotDuplicates() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const reservationId = '7e3a4339-72ea-4f9a-87af-adf031b57bf6';

  console.log(`=== 달서별빛 예약 [${reservationId}] Candidates 내 명소(SPOT) 목록 추출 및 공간 중복 실사 ===`);

  // candidates 테이블에서 해당 예약의 모든 명소(SPOT 및 ROUTE_SPOT) 후보 긁어옴
  const { data: candidates, error } = await supabase
    .from('smart_plan_candidates')
    .select('*')
    .eq('reservation_id', reservationId);

  if (error) {
    console.error("Candidates 조회 에러:", error.message);
    return;
  }

  const spots = candidates.filter(c => c.category === 'SPOT' || c.category === 'ROUTE_SPOT');
  console.log(`- 후보 명소 총 개수: ${spots.length} 건`);

  // 1. 단순 이름/주소 100% 일치 중복 검사
  const nameMap = {};
  spots.forEach(s => {
    nameMap[s.name] = (nameMap[s.name] || 0) + 1;
  });
  console.log("\n[이름 단순 중복 집계]");
  Object.entries(nameMap).forEach(([name, count]) => {
    if (count > 1) {
      console.log(`  - "${name}": ${count}번 중복 적재됨!`);
    }
  });

  // 2. 물리적 좌표(500m 이내) 및 이름 부분 일치 중복 검사
  const getDist = (lat1, lng1, lat2, lng2) => {
    const R = 6371e3;
    const f1 = lat1 * Math.PI/180, f2 = lat2 * Math.PI/180;
    const df = (lat2-lat1) * Math.PI/180, dl = (lng2-lng1) * Math.PI/180;
    const a = Math.sin(df/2) * Math.sin(df/2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dl/2) * Math.sin(dl/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };
  const clean = (s) => (s || '').replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').replace(/\s/g, '').toLowerCase();

  console.log("\n[공간적 근접 중복(500m 이내 및 이름 부분 일치) 정밀 스캔]");
  let closeDupCount = 0;
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      const dist = getDist(spots[i].lat, spots[i].lng, spots[j].lat, spots[j].lng);
      const n1 = clean(spots[i].name), n2 = clean(spots[j].name);
      
      if (dist < 500) {
        const isNameClose = n1.includes(n2) || n2.includes(n1);
        console.log(`  📍 근접 발견: "${spots[i].name}" ↔ "${spots[j].name}" | 거리: ${Math.round(dist)}m | 이름유사여부: ${isNameClose}`);
        if (isNameClose) {
          closeDupCount++;
        }
      }
    }
  }
  console.log(`- 최종 공간적/이름 유사 중복 건수: ${closeDupCount} 건`);
}

checkSpotDuplicates();

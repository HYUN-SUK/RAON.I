import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ESM 환경에서 ts 모듈 임포트를 위해 ts-node나 동적 변환이 필요할 수 있으므로, 
// 직접 src/lib/smartPlan.ts 를 읽어와서 모의 기동하는 방식으로 확인해 보겠습니다.
// 더 가볍고 확실한 방법은, 우리가 짠 smartPlan.ts 의 로직만 긁어와서
// candidates 에서 긁어온 데이터로 로컬 시뮬레이션을 돌려보는 것입니다!
import { createClient } from '@supabase/supabase-js';

async function simulateDeduplication() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const reservationId = '7e3a4339-72ea-4f9a-87af-adf031b57bf6';
  console.log(`=== [서버 룰 엔진 시뮬레이션] alternatives 정제 프로세스 실사 ===`);

  // 1. candidates 데이터 긁어옴
  const { data: cands } = await supabase
    .from('smart_plan_candidates')
    .select('*')
    .eq('reservation_id', reservationId);

  // 2. FactCard 파싱 모사
  const parseFactCardSim = (row) => {
    return {
      id: row.fact_id || row.id,
      category: row.category,
      name: row.name,
      lat: parseFloat(row.lat) || 0,
      lng: parseFloat(row.lng) || 0,
      description: row.raw_data?.description || row.description || '',
      trustScore: row.final_score || 50,
      metadata: row.raw_data || {}
    };
  };

  const activeFacts = cands.filter(c => ['HOSPITAL', 'MART', 'RESTAURANT', 'GAS_STATION', 'SPOT'].includes(c.category)).map(parseFactCardSim);
  const routeFacts = cands.filter(c => ['ROUTE_RESTAURANT', 'ROUTE_CAFE', 'ROUTE_SPOT'].includes(c.category)).map(parseFactCardSim);
  const returnFacts = [];
  const featuredFestival = [];
  
  // alternatives 조립 모사 (일반적으로 추천에 뽑히지 않은 남은 카드들)
  const alternatives = {
    SPOT: cands.filter(c => c.category === 'SPOT').map(parseFactCardSim),
    ROUTE_SPOT: cands.filter(c => c.category === 'ROUTE_SPOT').map(parseFactCardSim),
    RESTAURANT: cands.filter(c => c.category === 'RESTAURANT').map(parseFactCardSim),
    ROUTE_RESTAURANT: cands.filter(c => c.category === 'ROUTE_RESTAURANT').map(parseFactCardSim),
  };

  // 3. 우리가 수정한 deduplicateSpatial 로직 그대로 가동
  const deduplicateSpatial = (cards) => {
      const result = [];
      const getDist = (lat1, lng1, lat2, lng2) => {
          const R = 6371e3;
          const f1 = lat1 * Math.PI/180, f2 = lat2 * Math.PI/180;
          const df = (lat2-lat1) * Math.PI/180, dl = (lng2-lng1) * Math.PI/180;
          const a = Math.sin(df/2) * Math.sin(df/2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dl/2) * Math.sin(dl/2);
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      };
      const clean = (s) => (s || '').replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').replace(/\s/g, '').toLowerCase();

      for (const card of cards) {
          let isDup = false;
          for (const existing of result) {
              const dist = getDist(card.lat, card.lng, existing.lat, existing.lng);
              const n1 = clean(card.name), n2 = clean(existing.name);
              
              const isSpatialDup = dist < 50 || (dist < 500 && (n1.includes(n2) || n2.includes(n1)));
              
              if (isSpatialDup) {
                  isDup = true;
                  if (card.trustScore > existing.trustScore) {
                      Object.assign(existing, card);
                  }
                  break;
              }
          }
          if (!isDup) {
              result.push(card);
          }
      }
      return result;
  };

  const cleanActive = deduplicateSpatial(activeFacts);
  const cleanRoute = deduplicateSpatial(routeFacts);
  const cleanReturn = deduplicateSpatial(returnFacts);
  const cleanFeatured = deduplicateSpatial(featuredFestival);

  const primaryGroup = [...cleanActive, ...cleanRoute, ...cleanReturn, ...cleanFeatured];
  const getDistHelper = (lat1, lng1, lat2, lng2) => {
      const R = 6371e3;
      const f1 = lat1 * Math.PI/180, f2 = lat2 * Math.PI/180;
      const df = (lat2-lat1) * Math.PI/180, dl = (lng2-lng1) * Math.PI/180;
      const a = Math.sin(df/2) * Math.sin(df/2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dl/2) * Math.sin(dl/2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };
  const cleanStrHelper = (s) => (s || '').replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').replace(/\s/g, '').toLowerCase();

  const allAltsRaw = Object.values(alternatives).flat();
  
  console.log(`- 글로벌 필터 전 전체 대안 개수: ${allAltsRaw.length} 건`);
  console.log("글로벌 필터 전 대안 목록 목록:");
  allAltsRaw.forEach(c => console.log(`  * ${c.name} (${c.category}) | Score: ${c.trustScore}`));

  const globalCleanedAlts = deduplicateSpatial(allAltsRaw);
  
  console.log(`\n- 글로벌 중복 제거 후 대안 개수: ${globalCleanedAlts.length} 건`);
  console.log("글로벌 중복 제거 후 대안 목록:");
  globalCleanedAlts.forEach(c => console.log(`  * ${c.name} (${c.category}) | Score: ${c.trustScore}`));

  const finalCleanedAlts = globalCleanedAlts.filter(altCard => {
      const altName = cleanStrHelper(altCard.name);
      const isDupWithPrimary = primaryGroup.some(priCard => {
          const dist = getDistHelper(altCard.lat, altCard.lng, priCard.lat, priCard.lng);
          const priName = cleanStrHelper(priCard.name);
          return dist < 50 || (dist < 500 && (altName.includes(priName) || priName.includes(altName)));
      });
      return !isDupWithPrimary;
  });

  console.log(`\n- 기본 추천과 교차 필터링 후 최종 대안 개수: ${finalCleanedAlts.length} 건`);
  console.log("최종 대안 목록:");
  finalCleanedAlts.forEach(c => console.log(`  * ${c.name} (${c.category}) | Score: ${c.trustScore}`));

  const cleanAlts = {};
  for (const cat of Object.keys(alternatives)) {
      cleanAlts[cat] = [];
  }
  finalCleanedAlts.forEach(card => {
      if (cleanAlts[card.category]) {
          cleanAlts[card.category].push(card);
      } else {
          cleanAlts[card.category] = [card];
      }
  });

  console.log(`\n=== 최종 alternatives 객체 덤프 ===`);
  console.log(JSON.stringify(cleanAlts, null, 2));
}

simulateDeduplication();

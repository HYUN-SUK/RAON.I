// RESTAURANT 0건 심층 재조사
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('=== RESTAURANT 0건 심층 재조사 ===\n');

  // 1. 최근 7일간 SMART_PLAN_CACHING 로그 전량 조회 
  console.log('━'.repeat(60));
  console.log('📋 [1] 최근 7일 SMART_PLAN_CACHING 로그 — RESTAURANT quota_flow 추적');
  console.log('━'.repeat(60));

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: logs, error } = await supabase
    .from('automation_logs')
    .select('*')
    .eq('job_name', 'SMART_PLAN_CACHING')
    .gte('created_at', weekAgo)
    .order('created_at', { ascending: true });

  if (error) { console.error('DB 오류:', error.message); return; }

  console.log(`  조회된 로그: ${(logs||[]).length}건\n`);

  for (const log of (logs||[])) {
    const kst = new Date(new Date(log.created_at).getTime() + 9*60*60*1000);
    const dateStr = kst.toISOString().substring(0,16).replace('T',' ');
    
    let msg = log.message;
    let quotaFlow = null;
    if (typeof msg === 'string') {
      try { msg = JSON.parse(msg); } catch(e) {}
    }
    if (msg?.quota_flow) quotaFlow = msg.quota_flow;
    
    const restQuota = quotaFlow?.find(q => q.category === 'RESTAURANT');
    const spotQuota = quotaFlow?.find(q => q.category === 'SPOT');
    
    console.log(`  📅 ${dateStr} KST | 상태: ${log.status} | 예약: ${log.processed_count}건`);
    console.log(`     메시지: ${msg?.text || (typeof msg === 'string' ? msg : JSON.stringify(msg).substring(0,100))}`);
    if (restQuota) {
      console.log(`     🍽️ RESTAURANT → Raw=${restQuota.raw_query}, Top=${restQuota.top_quota}, 검증=${restQuota.verified}, 최종=${restQuota.final}`);
    } else {
      console.log(`     🍽️ RESTAURANT → quota_flow 없음`);
    }
    if (spotQuota) {
      console.log(`     🏞️ SPOT       → Raw=${spotQuota.raw_query}, Top=${spotQuota.top_quota}, 검증=${spotQuota.verified}, 최종=${spotQuota.final}`);
    }
    console.log('');
  }

  // 2. RPC 함수 정의 확인
  console.log('━'.repeat(60));
  console.log('📋 [2] get_master_places_in_radius_v2 RPC 함수 정의 확인');
  console.log('━'.repeat(60));
  
  const { data: funcDef } = await supabase.rpc('get_master_places_in_radius_v2', {
    target_lat: 36.626909, target_lng: 126.7647868,
    radius_meters: 30000, p_category: 'RESTAURANT',
    limit_count: 10
  });
  
  if (funcDef) {
    console.log(`  ✅ RPC 호출 성공 (limit_count=10): ${funcDef.length}건 반환`);
    if (funcDef.length > 0) {
      console.log(`  예시: ${funcDef.slice(0,3).map(r => `${r.name} (${r.api_source}, 거리:${Math.round(r.distance)}m)`).join(', ')}`);
    }
  } else {
    console.log(`  ❌ RPC 호출 실패 또는 0건`);
  }

  // 3. 예산군 반경 30km의 RESTAURANT 활성/비활성 분포
  console.log('\n' + '━'.repeat(60));
  console.log('📋 [3] 예산군 반경 RESTAURANT 현황 (직접 쿼리)');
  console.log('━'.repeat(60));
  
  // 충남 예산군에 해당하는 sido별 RESTAURANT
  const sidoList = ['충청남도', '충청북도', '대전광역시', '세종특별자치시']; // 예산 반경 가능 시도
  for (const sido of sidoList) {
    const { count: actC } = await supabase.from('master_places').select('*', { count:'exact', head:true })
      .eq('category','RESTAURANT').eq('is_active',true).eq('sido', sido);
    const { count: inC } = await supabase.from('master_places').select('*', { count:'exact', head:true })
      .eq('category','RESTAURANT').eq('is_active',false).eq('sido', sido);
    console.log(`  ${sido}: 🟢${actC || 0}건 / 🔴${inC || 0}건`);
  }
  
  // 4. is_active=true인 RESTAURANT 중 좌표가 0,0인 건수
  console.log('\n' + '━'.repeat(60));
  console.log('📋 [4] RESTAURANT 좌표 품질 확인');
  console.log('━'.repeat(60));
  
  const { count: zeroCoords } = await supabase.from('master_places').select('*', { count: 'exact', head: true })
    .eq('category', 'RESTAURANT').eq('is_active', true).eq('lat', 0);
  const { count: nullCoords } = await supabase.from('master_places').select('*', { count: 'exact', head: true })
    .eq('category', 'RESTAURANT').eq('is_active', true).is('lat', null);
  const { count: totalActive } = await supabase.from('master_places').select('*', { count: 'exact', head: true })
    .eq('category', 'RESTAURANT').eq('is_active', true);
    
  console.log(`  전국 활성 RESTAURANT 총: ${totalActive}건`);
  console.log(`  lat=0인 건: ${zeroCoords}건`);
  console.log(`  lat=NULL인 건: ${nullCoords}건`);
  console.log(`  유효 좌표: ${totalActive - (zeroCoords||0) - (nullCoords||0)}건`);

  // 5. smart_plan_facts 내 RESTAURANT 이력 확인
  console.log('\n' + '━'.repeat(60));
  console.log('📋 [5] smart_plan_facts 내 RESTAURANT 이력');
  console.log('━'.repeat(60));
  
  const { data: restFacts } = await supabase.from('smart_plan_facts')
    .select('id, name, address, created_at')
    .eq('category', 'RESTAURANT')
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log(`  최근 적재된 RESTAURANT facts: ${(restFacts||[]).length}건`);
  for (const f of (restFacts||[])) {
    const fkst = new Date(new Date(f.created_at).getTime() + 9*60*60*1000);
    console.log(`    - ${f.name} | ${f.address?.substring(0,25)} | ${fkst.toISOString().substring(0,16)}`);
  }
  
  // 6. 오늘 캐싱 시 RPC가 각 카테고리에서 실제로 얼마나 데이터를 뽑아오는지 시뮬레이션 (limit=5, 타임아웃 테스트)
  console.log('\n' + '━'.repeat(60));
  console.log('📋 [6] RPC 카테고리별 시뮬레이션 (철수네 좌표)');
  console.log('━'.repeat(60));
  
  const cats = ['RESTAURANT', 'SPOT', 'MART', 'HOSPITAL', 'GAS_STATION', 'FESTIVAL'];
  for (const cat of cats) {
    const start = Date.now();
    const { data, error } = await supabase.rpc('get_master_places_in_radius_v2', { 
      target_lat: 36.626909, target_lng: 126.7647868,
      radius_meters: 30000, p_category: cat,
      limit_count: 1000
    });
    const elapsed = Date.now() - start;
    
    if (error) {
      console.log(`  ${cat.padEnd(14)}: ❌ ${error.message} (${elapsed}ms)`);
    } else {
      console.log(`  ${cat.padEnd(14)}: ✅ ${(data||[]).length}건 (${elapsed}ms)`);
    }
  }

  console.log('\n✅ 재조사 완료');
}

main().catch(console.error);

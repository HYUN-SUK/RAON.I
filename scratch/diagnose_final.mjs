// RESTAURANT 0건 최종 원인 규명 — RPC SQL 정의 + 4/14→4/15 변동 추적
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('=== RESTAURANT 0건 최종 원인 규명 ===\n');

  // ━━━ 1. RPC 함수 SQL 정의 조회 ━━━
  console.log('━'.repeat(60));
  console.log('📋 [1] get_master_places_in_radius_v2 SQL 정의 조회');
  console.log('━'.repeat(60));

  const { data: funcDef, error: funcErr } = await supabase.rpc('pg_get_functiondef', {
    func_name: 'get_master_places_in_radius_v2'
  }).maybeSingle();
  
  // 대안: pg_proc에서 직접 조회
  const { data: pgFunc } = await supabase
    .from('pg_catalog.pg_proc')
    .select('proname, prosrc, proargnames, proargtypes')
    .eq('proname', 'get_master_places_in_radius_v2')
    .limit(1);
  
  if (pgFunc?.length > 0) {
    console.log('  함수명:', pgFunc[0].proname);
    console.log('  파라미터:', pgFunc[0].proargnames);
    console.log('  SQL 본문:');
    console.log(pgFunc[0].prosrc);
  } else {
    console.log('  pg_proc 접근 불가 — SQL 직접 조회 시도');
  }

  // SQL 쿼리로 함수 정의 조회 (대안)
  const { data: sqlDef, error: sqlErr } = await supabase.rpc('exec_sql', {
    query: `SELECT pg_get_functiondef(oid) as definition 
            FROM pg_proc WHERE proname = 'get_master_places_in_radius_v2' LIMIT 1`
  });
  
  if (sqlDef) {
    console.log('\n  [SQL Definition via exec_sql]:');
    console.log(JSON.stringify(sqlDef, null, 2));
  } else if (sqlErr) {
    console.log('  exec_sql 없음:', sqlErr.message);
  }

  // ━━━ 2. 4/13, 4/14, 4/15 새벽 로그 상세 비교 ━━━
  console.log('\n' + '━'.repeat(60));
  console.log('📋 [2] 4/13~4/15 새벽 자동화 로그 시간 비교 (Region Sync vs Caching)');
  console.log('━'.repeat(60));

  for (const dayStr of ['2026-04-12', '2026-04-13', '2026-04-14']) {
    const startUTC = new Date(new Date(dayStr + 'T00:00:00+09:00').getTime()).toISOString();
    const endUTC = new Date(new Date(dayStr + 'T12:00:00+09:00').getTime()).toISOString();
    
    const { data: dayLogs } = await supabase
      .from('automation_logs')
      .select('job_name, status, created_at, processed_count, message')
      .gte('created_at', startUTC)
      .lte('created_at', endUTC)
      .order('created_at', { ascending: true });
    
    const kstDate = dayStr;
    console.log(`\n  📅 ${kstDate} 새벽:`);
    for (const log of (dayLogs || [])) {
      const kst = new Date(new Date(log.created_at).getTime() + 9*60*60*1000);
      const timeStr = kst.toISOString().substring(11,19);
      let restRaw = '-';
      if (log.message) {
        let msg = typeof log.message === 'string' ? (() => { try { return JSON.parse(log.message); } catch(e) { return null; } })() : log.message;
        if (msg?.quota_flow) {
          const rest = msg.quota_flow.find(q => q.category === 'RESTAURANT');
          restRaw = rest ? `Raw=${rest.raw_query}` : '-';
        }
      }
      console.log(`     ${timeStr} KST | ${log.job_name.padEnd(22)} | ${log.status.padEnd(8)} | 처리:${log.processed_count}건 | ${restRaw}`);
    }
  }

  // ━━━ 3. 4/14→4/15 사이 RESTAURANT 데이터 변동 추적 ━━━
  console.log('\n' + '━'.repeat(60));
  console.log('📋 [3] 4/14→4/15 RESTAURANT 데이터 변동 추적 (대구 동기화 영향)');
  console.log('━'.repeat(60));

  // 4/15 대구 동기화 전후 is_active 변동
  const { count: deactivated415 } = await supabase.from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('category', 'RESTAURANT')
    .eq('is_active', false)
    .gte('updated_at', '2026-04-14T20:00:00Z')  // 4/15 05:00 KST
    .lte('updated_at', '2026-04-14T21:30:00Z');  // 4/15 06:30 KST

  console.log(`  4/15 새벽 05:00~06:30 KST 비활성화된 RESTAURANT: ${deactivated415 || 0}건`);

  // ━━━ 4. 캠핑장 좌표 → 충남 예산 반경 RESTAURANT 좌표 품질 (핵심!) ━━━
  console.log('\n' + '━'.repeat(60));
  console.log('📋 [4] 철수네 캠핑장 반경 30km RESTAURANT 좌표 품질 정밀 검사');
  console.log('━'.repeat(60));

  // 직접 바운딩 박스 쿼리 (RPC 없이)
  const targetLat = 36.626909;
  const targetLng = 126.7647868;
  const latDelta = 0.27; // ~30km
  const lngDelta = 0.34;

  const { data: boxData, count: boxCount } = await supabase.from('master_places')
    .select('id, name, api_source, lat, lng, is_active, trust_score, address', { count: 'exact' })
    .eq('category', 'RESTAURANT')
    .eq('is_active', true)
    .gte('lat', targetLat - latDelta)
    .lte('lat', targetLat + latDelta)
    .gte('lng', targetLng - lngDelta)
    .lte('lng', targetLng + lngDelta)
    .limit(20);

  console.log(`  바운딩 박스 내 활성 RESTAURANT: ${boxCount}건`);
  if (boxData) {
    const sources = {};
    for (const r of boxData) {
      sources[r.api_source] = (sources[r.api_source] || 0) + 1;
    }
    console.log(`  소스 분포 (상위 20건): ${JSON.stringify(sources)}`);
    console.log(`  예시:`, boxData.slice(0,5).map(r => `${r.name}(${r.api_source}, ${r.lat?.toFixed(3)},${r.lng?.toFixed(3)})`).join(', '));
  }

  // ━━━ 5. RPC 함수의 is_active 필터 확인을 위한 실험 ━━━
  console.log('\n' + '━'.repeat(60));
  console.log('📋 [5] RPC 결과 분석 — is_active 필터 유무 + distance 계산 확인');
  console.log('━'.repeat(60));

  const { data: rpcTest, error: rpcErr } = await supabase.rpc('get_master_places_in_radius_v2', {
    target_lat: targetLat, target_lng: targetLng,
    radius_meters: 30000, p_category: 'RESTAURANT',
    limit_count: 5
  });

  if (rpcErr) {
    console.log(`  ❌ RPC 실패: ${rpcErr.message}`);
  } else if (rpcTest) {
    console.log(`  반환 건수: ${rpcTest.length}건`);
    console.log(`  반환 컬럼:`, Object.keys(rpcTest[0] || {}));
    for (const r of rpcTest.slice(0,5)) {
      console.log(`    - ${r.name} | ${r.api_source} | is_active=${r.is_active} | score=${r.trust_score} | lat=${r.lat} lng=${r.lng} | dist=${r.distance}`);
    }
  }

  // ━━━ 6. 4/13 성공 시 vs 4/15 실패 시 — 캠핑장 예약이 같은 건인지 확인 ━━━
  console.log('\n' + '━'.repeat(60));
  console.log('📋 [6] 예약 변동 확인 — 4/13~4/15 캐싱 대상 스케줄');
  console.log('━'.repeat(60));

  for (const targetDate of ['2026-04-16', '2026-04-17', '2026-04-18']) {
    const { data: scheds } = await supabase.from('user_schedules')
      .select('campground_name, campground_lat, campground_lng, campground_address, check_in')
      .eq('check_in', targetDate);
    
    console.log(`  📅 ${targetDate} 예약:`, (scheds?.length || 0), '건');
    for (const s of (scheds || [])) {
      console.log(`     → ${s.campground_name} (${s.campground_lat}, ${s.campground_lng}) ${s.campground_address}`);
    }
  }

  // ━━━ 7. GitHub Actions 로그 확인용 — cron 설정 ━━━
  console.log('\n' + '━'.repeat(60));
  console.log('📋 [7] GitHub Actions Workflow 확인');
  console.log('━'.repeat(60));

  // .github/workflows 확인
  const fs = await import('fs');
  const workflowDir = '.github/workflows';
  try {
    const files = fs.readdirSync(workflowDir);
    console.log(`  Workflow 파일: ${files.join(', ')}`);
    
    for (const f of files) {
      if (f.includes('caching') || f.includes('daily') || f.includes('smart') || f.includes('cron')) {
        const content = fs.readFileSync(`${workflowDir}/${f}`, 'utf-8');
        // cron 및 job 순서 추출
        const cronMatch = content.match(/cron:\s*['"](.+?)['"]/g);
        const jobMatch = content.match(/jobs:\s*\n([\s\S]*?)(?=\n\S|$)/);
        console.log(`\n  📄 ${f}:`);
        if (cronMatch) console.log(`     Cron: ${cronMatch.join(', ')}`);
        // 실행 순서 확인 (needs 의존성)
        const needsMatch = content.match(/needs:\s*(.+)/g);
        if (needsMatch) console.log(`     Dependencies: ${needsMatch.join(', ')}`);
        
        // 전체 job 이름들
        const jobNames = [...content.matchAll(/^\s{2}(\w[\w-]+):\s*$/gm)].map(m => m[1]);
        console.log(`     Jobs: ${jobNames.join(' → ')}`);
      }
    }
  } catch(e) {
    console.log(`  Workflow 디렉토리 없음 또는 접근 불가: ${e.message}`);
  }

  console.log('\n✅ 최종 원인 규명 완료');
}

main().catch(console.error);

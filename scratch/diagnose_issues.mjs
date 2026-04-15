// 이상 징후 #1, #2 원인 진단 스크립트
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('=== 이상 징후 정밀 진단 ===\n');

  // ─── 진단 #1: 명소 인기도 v2 0건 원인 추적 ───
  console.log('━'.repeat(60));
  console.log('🔍 [진단 #1] 대구광역시 TOUR_SPOT의 sigungu 필드 상태 점검');
  console.log('━'.repeat(60));

  // 1-1. 대구 TOUR_SPOT의 sigungu 분포 확인
  const { data: dgsSpots, error: e1 } = await supabase
    .from('master_places')
    .select('id, name, sigungu, sido, address')
    .eq('api_source', 'TOUR_SPOT')
    .eq('is_active', true)
    .in('sido', ['대구광역시', '대구'])
    .limit(20);

  if (e1) console.error('  DB 오류:', e1.message);
  
  const nullSigungu = (dgsSpots || []).filter(s => !s.sigungu || s.sigungu.trim() === '');
  const hasSigungu = (dgsSpots || []).filter(s => s.sigungu && s.sigungu.trim() !== '');
  
  console.log(`  전체 샘플: ${(dgsSpots||[]).length}건`);
  console.log(`  sigungu 있음: ${hasSigungu.length}건`);
  console.log(`  sigungu NULL/빈문자: ${nullSigungu.length}건`);
  
  if (hasSigungu.length > 0) {
    console.log(`  예시 sigungu 값: ${hasSigungu.slice(0,5).map(s => `"${s.sigungu}"`).join(', ')}`);
  }
  if (nullSigungu.length > 0) {
    console.log(`  ⚠️  sigungu 미설정 예시: ${nullSigungu.slice(0,3).map(s => `"${s.name}" (주소: ${s.address?.substring(0,30)})`).join(', ')}`);
  }

  // 1-2. 전체 대구 TOUR_SPOT 중 sigungu null 비율
  const { count: totalDgSpot } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('api_source', 'TOUR_SPOT')
    .eq('is_active', true)
    .in('sido', ['대구광역시', '대구']);
    
  const { count: nullDgSigungu } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('api_source', 'TOUR_SPOT')
    .eq('is_active', true)
    .in('sido', ['대구광역시', '대구'])
    .or('sigungu.is.null,sigungu.eq.');

  console.log(`\n  📊 전체 대구 TOUR_SPOT: ${totalDgSpot}건`);
  console.log(`  📊 sigungu NULL/빈 값: ${nullDgSigungu}건`);
  
  if (nullDgSigungu === totalDgSpot) {
    console.log(`  🔴 결론: sigungu가 전부 미설정 → getAdminCodes() 호출 시 signguCd=undefined → Tmap/KT API 호출 전량 스킵!`);
  } else if (nullDgSigungu > 0) {
    console.log(`  🟡 결론: 일부 sigungu 미설정 → 해당 시군구의 인기도만 누락`);
  } else {
    console.log(`  🟢 sigungu 정상 → 다른 원인 조사 필요 (API 응답 확인)`);
  }

  // ─── 진단 #2: D-3 캐싱 RESTAURANT 0건 원인 추적 ───
  console.log('\n' + '━'.repeat(60));
  console.log('🔍 [진단 #2] D-3 캐싱 RESTAURANT 0건 원인 추적');
  console.log('━'.repeat(60));

  // 2-1. 4/18 예약 캠핑장 확인
  const { data: reservations } = await supabase
    .from('user_schedules')
    .select('campground_name, campground_lat, campground_lng, campground_address, check_in')
    .eq('check_in', '2026-04-18');

  console.log(`  4/18 예약 건수: ${(reservations||[]).length}건`);
  for (const r of (reservations||[])) {
    console.log(`  📍 캠핑장: ${r.campground_name}`);
    console.log(`     좌표: (${r.campground_lat}, ${r.campground_lng})`);
    console.log(`     주소: ${r.campground_address}`);
    
    const lat = Number(r.campground_lat);
    const lng = Number(r.campground_lng);

    if (!lat || !lng) {
      console.log(`  ⚠️  좌표가 없습니다! caching-smart-plan이 Location Recovery 시도했을 것`);
      
      // campgrounds 테이블에서 복구 시도 확인
      const { data: campInfo } = await supabase
        .from('campgrounds')
        .select('name, lat, lng, address')
        .ilike('name', `%${r.campground_name}%`)
        .limit(1);
      
      if (campInfo?.length > 0) {
        console.log(`  ✅ campgrounds 테이블에서 발견: (${campInfo[0].lat}, ${campInfo[0].lng})`);
      } else {
        console.log(`  🔴 campgrounds 테이블에도 없음!`);
      }
      continue;
    }

    // 2-2. 해당 좌표 반경 30km 내 RESTAURANT 현황
    console.log(`\n  🔎 반경 30km 내 RESTAURANT 데이터 확인 중...`);
    
    // RPC 호출 테스트
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('get_master_places_in_radius_v2', {
      target_lat: lat,
      target_lng: lng,
      radius_meters: 30000,
      p_category: 'RESTAURANT',
      limit_count: 1000
    });

    if (rpcErr) {
      console.log(`  🔴 RPC 호출 실패: ${rpcErr.message}`);
      console.log(`     코드: ${rpcErr.code}, 힌트: ${rpcErr.hint || 'N/A'}`);
      
      // 대안: 직접 쿼리로 확인
      console.log(`\n  🔎 직접 쿼리로 RESTAURANT 현황 확인 중...`);
      const { count: restCount } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('category', 'RESTAURANT')
        .eq('is_active', true);
      console.log(`     전국 활성 RESTAURANT 총 건수: ${restCount}`);

      // 해당 sido의 RESTAURANT
      const sido = r.campground_address?.split(' ')[0] || '';
      if (sido) {
        const { count: sidoRestCount } = await supabase
          .from('master_places')
          .select('*', { count: 'exact', head: true })
          .eq('category', 'RESTAURANT')
          .eq('is_active', true)
          .ilike('sido', `%${sido}%`);
        console.log(`     ${sido} 활성 RESTAURANT: ${sidoRestCount}건`);
      }
    } else {
      console.log(`  ✅ RPC 호출 성공: ${(rpcResult||[]).length}건 반환`);
      if ((rpcResult||[]).length === 0) {
        console.log(`  🔴 반경 30km 내 RESTAURANT 데이터가 0건 — 지역 로테이션 미도달 가능성`);
      } else {
        console.log(`  🟢 데이터 존재 — 다른 원인 조사 필요`);
        // 상위 5건 출력
        rpcResult.slice(0,5).forEach((r,i) => console.log(`     ${i+1}. ${r.name} (${r.api_source}, 점수:${r.trust_score})`));
      }
    }
  }

  // 2-3. RPC 함수 존재 여부 확인 (v2 vs 기존)
  console.log(`\n  🔎 RPC 함수 존재 확인...`);
  const { data: rpcV1, error: rpcV1Err } = await supabase.rpc('get_master_places_in_radius', {
    target_lat: 36.68, target_lng: 126.85,
    radius_meters: 30000, p_category: 'RESTAURANT',
    limit_count: 5
  });
  console.log(`  get_master_places_in_radius (v1): ${rpcV1Err ? '❌ ' + rpcV1Err.message : '✅ ' + (rpcV1||[]).length + '건'}`);
  
  const { data: rpcV2, error: rpcV2Err } = await supabase.rpc('get_master_places_in_radius_v2', {
    target_lat: 36.68, target_lng: 126.85,
    radius_meters: 30000, p_category: 'RESTAURANT',
    limit_count: 5
  });
  console.log(`  get_master_places_in_radius_v2: ${rpcV2Err ? '❌ ' + rpcV2Err.message : '✅ ' + (rpcV2||[]).length + '건'}`);

  console.log('\n✅ 진단 완료');
}

main().catch(console.error);

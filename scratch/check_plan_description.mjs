import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDalseoPlan() {
  console.log("=== 달서별빛캠프캠핑장 관련 스마트플랜 데이터 분석 ===");
  
  // 1. 달서별빛캠프 캠핑장 예약 조회 (최신 예약 대상)
  const { data: resData, error: resErr } = await supabase
    .from('user_schedules')
    .select('id, user_id, check_in, check_out, campground_name')
    .ilike('campground_name', '%달서별빛%')
    .order('check_in', { ascending: false })
    .limit(3);

  if (resErr || !resData || resData.length === 0) {
    console.error("달서별빛 캠핑장 예약을 찾지 못했습니다:", resErr?.message);
    return;
  }

  console.log(`\n[발견된 달서별빛 예약 목록]`);
  resData.forEach(r => {
    console.log(`- ID: ${r.id} | 유저: ${r.user_id} | 기간: ${r.check_in} ~ ${r.check_out} | 캠핑장: ${r.campground_name}`);
  });

  const reservationId = resData[0].id;
  console.log(`\n최신 예약 ID [${reservationId}] 기준으로 후보군(candidates)을 검사합니다.`);

  // 2. 해당 예약의 Candidates 조회
  const { data: candidates, error: candErr } = await supabase
    .from('smart_plan_candidates')
    .select('id, fact_id, name, category, raw_data')
    .eq('reservation_id', reservationId)
    .eq('category', 'RESTAURANT')
    .limit(10);

  if (candErr) {
    console.error("Candidates 조회 에러:", candErr.message);
    return;
  }

  console.log(`\n[스마트플랜 후보군 내 식당 목록 (총 ${candidates?.length || 0}건)]`);
  for (const c of candidates || []) {
    console.log(`\n* 후보 식당: ${c.name} (Fact ID: ${c.fact_id})`);
    console.log(`  - Candidates raw_data.description: "${c.raw_data?.description || '없음'}"`);
    
    // 3. master_places에서 원본 데이터 조회
    const { data: mp, error: mpErr } = await supabase
      .from('master_places')
      .select('id, name, description, raw_data')
      .eq('id', c.fact_id)
      .maybeSingle();

    if (mpErr) {
      console.log(`  - [master_places] 조회 에러:`, mpErr.message);
    } else if (mp) {
      console.log(`  - [master_places] description: "${mp.description || '없음'}"`);
      console.log(`  - [master_places] raw_data.description: "${mp.raw_data?.description || '없음'}"`);
    } else {
      console.log(`  - [master_places] 원본이 존재하지 않습니다! (ID: ${c.fact_id})`);
    }
  }
  // 4. user_schedules 테이블에 최종 저장된 smart_plan_data 조회
  const { data: schedule, error: schedErr } = await supabase
    .from('user_schedules')
    .select('id, smart_plan_data')
    .eq('id', reservationId)
    .maybeSingle();

  if (schedErr) {
    console.error("user_schedules 조회 에러:", schedErr.message);
    return;
  }

  if (schedule && schedule.smart_plan_data) {
    const aiPlan = schedule.smart_plan_data.ai_plan;
    console.log(`\n=== user_schedules DB에 영구 저장된 ai_plan 데이터 검사 ===`);
    console.log(`- 모드: ${schedule.smart_plan_data.mode} | 업데이트 시각: ${schedule.smart_plan_data.updated_at}`);
    
    if (aiPlan) {
      const items = [
        ...(aiPlan.itemListElement || []),
        ...(aiPlan.routeListElement || []),
        ...(aiPlan.returnListElement || [])
      ];
      console.log(`- 총 ${items.length}개 추천 장소 카드 적재됨.`);
      items.forEach(card => {
        console.log(`\n* 장소: ${card.name} (${card.category})`);
        console.log(`  - description: "${card.description}"`);
        console.log(`  - reasoning: "${card.reasoning || ''}"`);
        console.log(`  - metadata.description_api_source: "${card.metadata?.description_api_source || ''}"`);
      });
    } else {
      console.log("ai_plan 데이터가 비어 있습니다.");
    }
  } else {
    console.log("해당 예약에 대한 user_schedules 또는 smart_plan_data 가 존재하지 않습니다.");
  }
}

checkDalseoPlan();

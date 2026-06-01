import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Analyzing 6/7 reservation candidates...");
  
  // 1. 6월 7일 예약(철수네) 찾기
  // user_schedules 테이블에서 2026-06-07 check_in 조회
  const { data: schedules, error: schedErr } = await supabase
    .from('user_schedules')
    .select('*')
    .eq('check_in', '2026-06-07');
    
  if (schedErr) {
    console.error("Error fetching schedules:", schedErr);
    return;
  }
  
  console.log(`Found ${schedules.length} schedules on 2026-06-07:`);
  schedules.forEach(s => {
    console.log(`- ID: ${s.id}, Name: ${s.campground_name}, Coords: ${s.campground_lat}, ${s.campground_lng}`);
  });
  
  // 만약 user_schedules에 없으면, blocked_dates 나 reservations 테이블에서도 찾아보기
  // 철수네 라는 명시적인 이름이 있을 수 있으니 reservations도 조회
  const { data: reservations, error: resErr } = await supabase
    .from('reservations')
    .select('*')
    .eq('check_in_date', '2026-06-07');
    
  if (resErr) {
    console.error("Error fetching reservations:", resErr);
  } else {
    console.log(`Found ${reservations.length} reservations on 2026-06-07:`);
    reservations.forEach(r => {
      console.log(`- ID: ${r.id}, Guest: ${r.guest_name}, Site: ${r.site_name}`);
    });
  }

  // reservation_id를 특정하여 candidates 조회
  // '철수네'에 해당하는 예약을 특정해야 하므로 두 데이터를 기반으로 reservation_id 후보들을 모두 조회합니다.
  const targetIds = Array.from(new Set([
    ...schedules.map(s => s.id),
    ...reservations.map(r => r.id)
  ]));

  for (const rid of targetIds) {
    console.log(`\n=== Candidates for Reservation ID: ${rid} ===`);
    const { data: candidates, error: candErr } = await supabase
      .from('smart_plan_candidates')
      .select('*')
      .eq('reservation_id', rid)
      .eq('category', 'HOSPITAL');
      
    if (candErr) {
      console.error(`Error fetching candidates for ${rid}:`, candErr);
      continue;
    }
    
    if (!candidates || candidates.length === 0) {
      console.log("No hospital candidates found.");
      continue;
    }
    
    // final_score 기준으로 정렬해서 출력
    const sorted = [...candidates].sort((a, b) => b.final_score - a.final_score);
    console.log(`Found ${sorted.length} hospital candidates:`);
    sorted.forEach((c, idx) => {
      const source = c.raw_data?.api_source || 'unknown';
      console.log(`[${idx+1}위] Name: ${c.name}`);
      console.log(`      Final Score: ${c.final_score} (Quality: ${c.quality_score}, Penalty: ${c.penalty_score})`);
      console.log(`      Distance: ${(c.distance_meters / 1000).toFixed(2)} km`);
      console.log(`      Source: ${source}, Address: ${c.address}`);
    });
  }
}

run();

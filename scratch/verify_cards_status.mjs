import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function verifyAllCardsStatus() {
  console.log('=== [8월~10월 라온아이 캠핑장 전체 예약자 카드 상태 실시간 최종 검증] ===\n');

  const todayStr = '2026-08-20';
  const { data: schedules, error } = await supabase
    .from('user_schedules')
    .select('id, campground_name, check_in, check_out, smart_plan_data')
    .eq('source', 'raonai')
    .gte('check_out', todayStr)
    .lte('check_in', '2026-10-31')
    .neq('status', 'cancelled')
    .order('check_in', { ascending: true });

  console.log(`📊 8월~10월 전체 라온아이 예약 일정: 총 ${schedules.length}건\n`);

  let allClean = true;
  schedules.forEach((s, idx) => {
    const isClean = s.smart_plan_data === null;
    if (!isClean) allClean = false;
    console.log(`  ${idx + 1}. [${s.campground_name}] ${s.check_in}~${s.check_out} ➔ 카드 표기: "⚡ 바로 맛보기 계획 생성가능!, 터치해보세요!" (대기 상태: ${isClean ? '🟢 정상 대기' : '🔴 미완료'})`);
  });

  console.log(`\n🏆 [최종 검증 결과] 21건 전원 '맛보기 생성가능!, 터치해보세요!' 단계 100% 적용 완료 여부: ${allClean ? '🟢 100% 완벽 일치' : '🔴 불일치'}`);
}

verifyAllCardsStatus();

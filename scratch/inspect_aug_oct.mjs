import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspectAugustToOctober() {
  console.log('=== [8월 ~ 10월 라온아이 캠핑장 연동 일정 전수 조회] ===\n');

  const { data: schedules, error } = await supabase
    .from('user_schedules')
    .select('id, user_id, campground_name, check_in, check_out, reservation_id, status, smart_plan_data, created_at')
    .eq('source', 'raonai')
    .gte('check_in', '2026-08-01')
    .lte('check_in', '2026-10-31')
    .neq('status', 'cancelled')
    .order('check_in', { ascending: true });

  if (error) {
    console.error('Error fetching schedules:', error);
    return;
  }

  const todayStr = '2026-08-20';
  const past = schedules.filter(s => s.check_out < todayStr);
  const ongoingAndFuture = schedules.filter(s => s.check_out >= todayStr);

  console.log(`📊 8월~10월 전체 라온아이 일정: 총 ${schedules.length}건`);
  console.log(`  - ⚪ 이미 지난 일정 (8월 초~중순): ${past.length}건`);
  console.log(`  - 🟢 다가오는 예정 일정 (오늘 8/20 이후 ~ 10월 말): ${ongoingAndFuture.length}건\n`);

  console.log('【다가오는 예정 일정 (오늘 이후) 목록】');
  ongoingAndFuture.forEach((s, idx) => {
    const isPreview = s.smart_plan_data?.is_preview === true;
    const isWrapped = s.smart_plan_data?.wrapped === true;
    let planType = '⚪ 미생성';
    if (isWrapped && !isPreview) planType = '🔒 정식플랜';
    else if (isPreview) planType = '⚡ 순수 맛보기';

    console.log(`  ${idx + 1}. [${s.campground_name}] ${s.check_in} ~ ${s.check_out} | 일정상태: ${s.status} | 플랜: ${planType} (ID: ${s.id})`);
  });
}

inspectAugustToOctober();

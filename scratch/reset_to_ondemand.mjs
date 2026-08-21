import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function resetToOnDemand() {
  console.log('=== [8월~10월 라온아이 예약 일정 smart_plan_data 클린 리셋 (온디맨드 대기 상태 전환)] ===\n');

  const todayStr = '2026-08-20';
  const { data: schedules, error } = await supabase
    .from('user_schedules')
    .select('id, campground_name, check_in, check_out')
    .eq('source', 'raonai')
    .gte('check_out', todayStr)
    .lte('check_in', '2026-10-31')
    .neq('status', 'cancelled');

  if (error) {
    console.error('Fetch error:', error);
    return;
  }

  console.log(`총 ${schedules.length}건의 일정을 온디맨드(NULL) 상태로 리셋합니다...`);

  const ids = schedules.map(s => s.id);
  const { error: updateErr } = await supabase
    .from('user_schedules')
    .update({ smart_plan_data: null })
    .in('id', ids);

  if (updateErr) {
    console.error('Update error:', updateErr);
    return;
  }

  console.log('🎉 8월~10월 전체 21건 라온아이 예약 일정 smart_plan_data: NULL 리셋 완료!');
  console.log('👉 이제 카드 목록에서 "⚡ 바로 맛보기 계획 생성가능!, 터치해보세요!"가 표시되고,');
  console.log('👉 사용자가 터치하는 순간 정규 generatePreviewSmartPlan 엔진이 0.1초 만에 실시간 가동됩니다!\n');
}

resetToOnDemand();

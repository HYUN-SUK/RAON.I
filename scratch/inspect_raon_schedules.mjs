import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspectRaonSchedules() {
  console.log('=== [라온아이 예약 연동 일정(user_schedules) 맛보기 데이터 점검] ===\n');

  const { data: schedules, error } = await supabase
    .from('user_schedules')
    .select('id, user_id, campground_name, check_in, check_out, source, reservation_id, smart_plan_data')
    .eq('source', 'raonai')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching schedules:', error);
    return;
  }

  console.log(`📊 라온아이 연동 일정 총: ${schedules?.length || 0}건\n`);

  for (const s of (schedules || [])) {
    const hasPlan = !!s.smart_plan_data;
    const isPreview = s.smart_plan_data?.is_preview === true;
    const isWrapped = s.smart_plan_data?.wrapped === true;
    console.log(`- [${s.id}] ${s.campground_name} (${s.check_in}~${s.check_out}) | 플랜존재: ${hasPlan} | 맛보기: ${isPreview} | 랩핑완성: ${isWrapped}`);
  }
}

inspectRaonSchedules();

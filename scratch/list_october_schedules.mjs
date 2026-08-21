import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function listOctoberRaonSchedules() {
  console.log('=== [10월 라온아이 캠핑장 연동 일정 전체 리스트 조회] ===\n');

  // 1. user_schedules에서 10월 라온아이 일정 조회
  const { data: schedules, error } = await supabase
    .from('user_schedules')
    .select('id, user_id, campground_name, check_in, check_out, reservation_id, status, smart_plan_data, created_at')
    .eq('source', 'raonai')
    .gte('check_in', '2026-10-01')
    .lte('check_in', '2026-10-31')
    .neq('status', 'cancelled')
    .order('check_in', { ascending: true })
    .order('campground_name', { ascending: true });

  if (error) {
    console.error('Fetch error:', error);
    return;
  }

  // 2. 예약자 이름 조회를 위해 reservations 테이블 매핑
  const resIds = (schedules || []).map(s => s.reservation_id).filter(Boolean);
  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, guest_name, guest_phone, site_id, status')
    .in('id', resIds);

  const resMap = new Map((reservations || []).map(r => [r.id, r]));

  console.log(`📊 10월 활성 라온아이 예약 연동 일정: 총 ${schedules?.length || 0}건\n`);

  schedules.forEach((s, idx) => {
    const res = resMap.get(s.reservation_id);
    const guestName = res?.guest_name || '예약자명 미확인';
    const guestPhone = res?.guest_phone || '';
    const plan = s.smart_plan_data;
    const isPreview = plan?.is_preview === true;
    const isWrapped = plan?.wrapped === true;

    let planStatusText = '⚪ 미생성';
    if (isWrapped && !isPreview) planStatusText = '🔒 정식플랜(잠김)';
    else if (isPreview) planStatusText = '⚡ 순수 맛보기';

    console.log(`${idx + 1}. [${s.campground_name}] ${s.check_in} ~ ${s.check_out} | ${guestName} (${guestPhone}) | 일정상태: ${s.status} | 현재플랜: ${planStatusText} (ID: ${s.id})`);
  });
}

listOctoberRaonSchedules();

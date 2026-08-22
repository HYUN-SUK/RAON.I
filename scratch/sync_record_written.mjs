import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function syncRecordWritten() {
  console.log('=== [record_written 플래그 데이터 정합성 보정] ===\n');

  // 1. 작성된 camping_records 조회
  const { data: records, error: recErr } = await supabase
    .from('camping_records')
    .select('id, user_id, schedule_id, campground_name, created_at');

  if (recErr) {
    console.error('❌ camping_records 조회 실패:', recErr.message);
    return;
  }

  console.log(`📋 작성된 camping_records 총 ${records.length}건 확인:`);
  records.forEach(r => console.log(`  - Record ${r.id} (schedule_id: ${r.schedule_id || 'null'}, user: ${r.user_id})`));

  // 2. schedule_id가 직접 연결된 경우
  const scheduleIds = records.map(r => r.schedule_id).filter(Boolean);
  if (scheduleIds.length > 0) {
    const { data: updated, error: updErr } = await supabase
      .from('user_schedules')
      .update({ record_written: true, updated_at: new Date().toISOString() })
      .in('id', scheduleIds)
      .select('id, user_id, record_written');

    if (updErr) {
      console.error('❌ schedule_id 직접 매칭 업데이트 실패:', updErr.message);
    } else {
      console.log(`✅ schedule_id 직접 매칭으로 ${updated.length}건 record_written = true 업데이트 완료`);
    }
  }

  // 3. schedule_id가 null이지만 user_id와 날짜/장소가 일치하는 지난 일정 매칭 보정
  for (const rec of records.filter(r => !r.schedule_id)) {
    const { data: matchedSchedules } = await supabase
      .from('user_schedules')
      .select('id, title, record_written')
      .eq('user_id', rec.user_id)
      .eq('record_written', false)
      .lte('check_in_date', rec.created_at.split('T')[0]);

    if (matchedSchedules && matchedSchedules.length > 0) {
      const targetSched = matchedSchedules[0];
      await supabase
        .from('user_schedules')
        .update({ record_written: true, updated_at: new Date().toISOString() })
        .eq('id', targetSched.id);
      
      console.log(`✅ 작성자(${rec.user_id}) 일정(${targetSched.id} - ${targetSched.title}) record_written = true 보정 완료`);
    }
  }

  // 4. 최종 현황 확인
  const { data: finalSchedules } = await supabase
    .from('user_schedules')
    .select('id, title, user_id, record_written, status')
    .limit(10);

  console.log('\n📊 user_schedules 최근 샘플 상태:');
  finalSchedules.forEach(s => console.log(`  - [${s.record_written ? '작성완료✓' : '미작성'}] ${s.title} (${s.id})`));
}

syncRecordWritten();

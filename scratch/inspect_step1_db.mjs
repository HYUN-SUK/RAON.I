import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Supabase credentials missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function checkStep1() {
  console.log('=== [Step 1: DB 실측 조회 및 타임존 분석] ===\n');

  // 1. open_day_rules 조회
  const { data: openDayRules, error: ruleErr } = await supabase
    .from('open_day_rules')
    .select('*');

  console.log('1. [open_day_rules 테이블 전체 데이터]');
  if (ruleErr) {
    console.error('  ❌ open_day_rules 조회 에러:', ruleErr);
  } else {
    console.log(JSON.stringify(openDayRules, null, 2));
  }

  // 2. site_config 조회 (예약 관련 설정)
  const { data: siteConfig, error: configErr } = await supabase
    .from('site_config')
    .select('*');

  console.log('\n2. [site_config 테이블 전체 데이터]');
  if (configErr) {
    console.error('  ❌ site_config 조회 에러:', configErr);
  } else {
    console.log(JSON.stringify(siteConfig, null, 2));
  }

  // 3. 현재 활성 sites 조회
  const { data: sites, error: sitesErr } = await supabase
    .from('sites')
    .select('id, name, is_active, price_weekday, price_weekend, site_type');

  console.log('\n3. [sites 테이블 목록]');
  if (sitesErr) {
    console.error('  ❌ sites 조회 에러:', sitesErr);
  } else {
    console.log(JSON.stringify(sites, null, 2));
  }

  // 4. 현재 등록된 10월 예약 건수 조회
  const { data: existingOctReservations, error: octErr } = await supabase
    .from('reservations')
    .select('id, site_id, check_in_date, check_out_date, status, guest_name')
    .gte('check_in_date', '2026-10-01')
    .lte('check_in_date', '2026-10-31')
    .neq('status', 'CANCELLED');

  console.log('\n4. [현재 등록된 10월 유효 예약 현황]');
  if (octErr) {
    console.error('  ❌ 10월 예약 조회 에러:', octErr);
  } else {
    console.log(`  총 ${existingOctReservations?.length || 0}건`);
    console.log(JSON.stringify(existingOctReservations, null, 2));
  }

  // 5. 현재 등록된 10월 차단일(blocked_dates) 현황
  const { data: octBlocked, error: blockErr } = await supabase
    .from('blocked_dates')
    .select('*')
    .or(`start_date.gte.2026-10-01,end_date.gte.2026-10-01`);

  console.log('\n5. [10월 차단일(blocked_dates) 현황]');
  if (blockErr) {
    console.error('  ❌ 차단일 조회 에러:', blockErr);
  } else {
    console.log(`  총 ${octBlocked?.length || 0}건`);
    console.log(JSON.stringify(octBlocked, null, 2));
  }
}

checkStep1();

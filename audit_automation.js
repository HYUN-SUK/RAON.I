const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const out = [];
const log = (...args) => { const line = args.join(' '); out.push(line); };

async function main() {
  log('=== 1. automation_logs ===');
  const { data: logs } = await supabase.from('automation_logs').select('*').in('job_name', ['MASTER_SYNC', 'SMART_PLAN_CACHING']).order('created_at', { ascending: false }).limit(10);
  for (const l of (logs || [])) {
    log(`[${l.job_name}] Status:${l.status} Count:${l.processed_count} Date:${l.created_at} Target:${l.target_date||'N/A'} Duration:${l.duration_ms}ms`);
    try { const m = typeof l.message === 'string' ? JSON.parse(l.message) : l.message; log('  MSG:', JSON.stringify(m)); } catch(e) { log('  MSG:', l.message); }
  }

  log('\n=== 2. master_places by category ===');
  const cats = ['RESTAURANT','MART','SPOT','HOSPITAL','GAS_STATION','FESTIVAL'];
  for (const c of cats) {
    const { count } = await supabase.from('master_places').select('id',{count:'exact',head:true}).eq('category',c);
    log(`  ${c}: ${count}`);
  }
  const { count: t1 } = await supabase.from('master_places').select('id',{count:'exact',head:true});
  log(`  TOTAL: ${t1}`);

  log('\n=== 3. master_places by api_source ===');
  const srcs = ['TOUR_SPOT','SMBA_BAEK','LOCALDATA_MART','LOCALDATA_RESTAURANT','SAFE_RESTAURANT','NMC_HOSPITAL','KAKAO_HP8','TOUR_FSTVL','OPINET_GAS','MASTER_ENRICHED'];
  for (const s of srcs) {
    const { count } = await supabase.from('master_places').select('id',{count:'exact',head:true}).ilike('api_source',`%${s}%`);
    log(`  ${s}: ${count}`);
  }

  log('\n=== 4. smart_plan_facts by category ===');
  for (const c of cats) {
    const { count } = await supabase.from('smart_plan_facts').select('id',{count:'exact',head:true}).eq('category',c);
    log(`  ${c}: ${count}`);
  }
  const { count: t2 } = await supabase.from('smart_plan_facts').select('id',{count:'exact',head:true});
  log(`  TOTAL: ${t2}`);

  log('\n=== 5. user_schedules 3/27 ===');
  const { data: scheds, count: sc } = await supabase.from('user_schedules').select('*',{count:'exact'}).eq('check_in','2026-03-27');
  log(`  Count: ${sc}`);
  for (const s of (scheds||[])) log(`    ${s.campground_name} lat:${s.campground_lat} lng:${s.campground_lng} addr:${s.campground_address}`);

  const { data: rvs, count: rc } = await supabase.from('reservations').select('id,check_in,check_out,site_name,status',{count:'exact'}).eq('check_in','2026-03-27');
  log(`  reservations 3/27: ${rc}`);
  for (const r of (rvs||[])) log(`    Site:${r.site_name} Status:${r.status}`);

  log('\n=== 6. smart_plan_facts recent 20 ===');
  const { data: rf } = await supabase.from('smart_plan_facts').select('name,category,api_source,trust_score,updated_at').order('updated_at',{ascending:false}).limit(20);
  for (const f of (rf||[])) log(`  [${f.category}] ${f.name} Score:${f.trust_score} Src:${f.api_source} Updated:${f.updated_at}`);

  log('\n=== 7. master_places recent 10 ===');
  const { data: rm } = await supabase.from('master_places').select('name,category,api_source,trust_score,updated_at').order('updated_at',{ascending:false}).limit(10);
  for (const m of (rm||[])) log(`  [${m.category}] ${m.name} Score:${m.trust_score} Src:${m.api_source} Updated:${m.updated_at}`);

  fs.writeFileSync('audit_result_final.txt', out.join('\n'), 'utf8');
  console.log('Done. Written to audit_result_final.txt');
}
main().catch(console.error);

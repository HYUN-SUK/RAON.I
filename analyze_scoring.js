const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const out = [];
  const log = (msg) => { console.log(msg); out.push(msg); };

  log('=== 1. 병원 스코어링 분석 ===');
  const { data: hosp } = await supabase.from('smart_plan_facts').select('*').eq('category', 'HOSPITAL');
  hosp.forEach(h => {
    log(`[${h.name}] Score:${h.trust_score} Source:${h.api_source} Dist:${h.lat},${h.lng}`);
    log(`   Raw Data Sample: ${JSON.stringify(h.raw_data).substring(0, 150)}...`);
  });

  log('\n=== 2. 마트 스코어링 분석 ===');
  const { data: mart } = await supabase.from('smart_plan_facts').select('*').eq('category', 'MART');
  mart.forEach(m => {
    log(`[${m.name}] Score:${m.trust_score} Source:${m.api_source}`);
    log(`   Raw Data Sample: ${JSON.stringify(m.raw_data).substring(0, 150)}...`);
  });

  log('\n=== 3. 식당 중복 및 소스 분석 ===');
  const { data: rest } = await supabase.from('smart_plan_facts').select('*').eq('category', 'RESTAURANT');
  const map = new Map();
  rest.forEach(r => {
    const k = r.name + '|' + r.address;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  });
  
  for (const [k, facts] of map) {
    const names = facts.map(f => f.name).join(', ');
    const sources = facts.map(f => f.api_source).join(', ');
    const scores = facts.map(f => f.trust_score).join(', ');
    if (facts.length > 1 || sources.includes(',')) {
      log(`[DUP] ${k.split('|')[0]} | Sources: ${sources} | Scores: ${scores}`);
    } else {
      log(`[SINGLE] ${k.split('|')[0]} | Source: ${sources} | Score: ${scores}`);
    }
  }

  log('\n=== 4. 마스터 플레이스 원본 대조 (홍성의료원) ===');
  const { data: masterH } = await supabase.from('master_places').select('*').ilike('name', '%홍성의료원%');
  masterH.forEach(m => {
    log(`[Master: ${m.name}] Source:${m.api_source} Category:${m.category} Trust:${m.trust_score}`);
  });

  fs.writeFileSync('diag_scoring_result.txt', out.join('\n'), 'utf8');
}

main().catch(console.error);

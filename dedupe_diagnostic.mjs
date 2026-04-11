import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function analyze() {
  console.log('--- 🔍 SOP v11.3 Deduplication Diagnostic ---');
  
  // 1. Find examples where name/address is shared ACROSS sources (Prove preservation)
  const { data: crossData } = await supabase.from('master_places').select('name, address, api_source').limit(20000);
  
  const crossMap = new Map();
  crossData.forEach(r => {
    const key = `${r.name}|${r.address}`;
    if (!crossMap.has(key)) crossMap.set(key, []);
    crossMap.get(key).push(r.api_source);
  });

  console.log('\n[Proof 1] 동일 주소/상호가 소스별로 보존된 사례 (Cross-Source Preservation):');
  let crossCount = 0;
  for (const [key, sources] of crossMap.entries()) {
    const uniqueSources = [...new Set(sources)];
    if (uniqueSources.length > 1) {
      console.log(`- 상호/주소: ${key}`);
      console.log(`  소스 목록: ${uniqueSources.join(', ')} (각각 별도 ID 보유)`);
      crossCount++;
      if (crossCount >= 3) break;
    }
  }

  // 2. Find examples of "Healed" records (cleaning effect)
  console.log('\n[Proof 2] 상호명 보정으로 통합된 유형 예시 (Intra-Source Merging Logic):');
  // We can look for strings containing '(' or ' ' originally
  const { data: rawExamples } = await supabase.from('master_places').select('name, raw_data, api_source').limit(5000);
  
  let cleaningCount = 0;
  for (const r of rawExamples) {
    let rawName = r.api_source === 'SAFE_RESTAURANT' ? r.raw_data?.RELAX_RSTRNT_NM : r.raw_data?.BSNSSP_NM;
    if (rawName && rawName !== r.name && rawName.replace(/\(.+?\)/g, '').replace(/\s+/g, '').toLowerCase() === r.name.replace(/\s+/g, '').toLowerCase()) {
      console.log(`- 원본명: ${rawName}`);
      console.log(`  보정명: ${r.name} (불필요한 괄호/공백 제거로 통합됨)`);
      cleaningCount++;
      if (cleaningCount >= 2) break;
    }
  }
}

analyze();

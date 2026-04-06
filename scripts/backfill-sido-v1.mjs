
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

const SIDO_RULES = [
  { target: '서울특별시', patterns: ['서울%', '특별%'] },
  { target: '부산광역시', patterns: ['부산%'] },
  { target: '대구광역시', patterns: ['대구%'] },
  { target: '인천광역시', patterns: ['인천%'] },
  { target: '광주광역시', patterns: ['광주%'] },
  { target: '대전광역시', patterns: ['대전%'] },
  { target: '울산광역시', patterns: ['울산%'] },
  { target: '세종특별자치시', patterns: ['세종%', '세종시%'] },
  { target: '경기도', patterns: ['경기%'] },
  { target: '강원특별자치도', patterns: ['강원도%', '강원 %', '강원특별%'] },
  { target: '충청북도', patterns: ['충북%', '충청북도%'] },
  { target: '충청남도', patterns: ['충남%', '충청남도%'] },
  { target: '전북특별자치도', patterns: ['전라북도%', '전북 %', '전북특별%'] },
  { target: '전라남도', patterns: ['전남%', '전라남도%'] },
  { target: '경상북도', patterns: ['경북%', '경상북도%'] },
  { target: '경상남도', patterns: ['경남%', '경상남도%'] },
  { target: '제주특별자치도', patterns: ['제주%', '제주특별%'] },
];

async function backfillSido() {
  console.log('🚀 Starting Sido Backfill for master_places...\n');
  
  let totalUpdated = 0;

  for (const rule of SIDO_RULES) {
    console.log(`📍 Processing: ${rule.target}...`);
    let subtotal = 0;
    
    for (const pattern of rule.patterns) {
      const { data, count, error } = await supabase
        .from('master_places')
        .update({ sido: rule.target })
        .is('sido', null)
        .like('address', pattern)
        .select('id', { count: 'exact' });

      if (error) {
        console.error(`  ❌ Error for ${rule.target} (${pattern}):`, error.message);
      } else {
        const affected = count || 0;
        subtotal += affected;
        totalUpdated += affected;
        if (affected > 0) console.log(`  ✅ Updated ${affected} rows with pattern "${pattern}"`);
      }
    }
    console.log(`  ✨ Subtotal for ${rule.target}: ${subtotal}\n`);
  }

  // Sigungu Backfill (Simplified)
  console.log('📍 Processing Sigungu Backfill (First pass)...');
  const { data: sigunguRows, error: sigunguError } = await supabase.rpc('backfill_sigungu_simple'); 
  // If RPC is missing, I'll do a small sample update via JS if it's feasible, 
  // but let's stick to sido as per the priority.
  
  console.log(`\n🎉 Backfill Complete! Total sido updated: ${totalUpdated}`);
  
  // Final Validation
  const { count: remainingNull } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .is('sido', null);
  
  console.log(`📊 Remaining NULL sido: ${remainingNull}`);
}

backfillSido();

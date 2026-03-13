import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('--- Database Stats Check ---');
  
  // 1. master_places 총계 및 소스별 집계
  const { count: totalCount } = await supabase.from('master_places').select('*', { count: 'exact', head: true });
  console.log(`Total master_places: ${totalCount}`);

  const sources = ['SAFE_RESTAURANT', 'SBA_BAEKNYEON', 'TOUR_SPOT', 'OPINET', 'MOIS_MART', 'MOIS_REST'];
  for (const src of sources) {
    const { count } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('api_source', src);
    console.log(`  - ${src}: ${count || 0}`);
  }

  // 2. master_places_gas 총계
  const { count: gasTotal } = await supabase.from('master_places_gas').select('*', { count: 'exact', head: true });
  console.log(`\nTotal master_places_gas: ${gasTotal || 0}`);

  // 3. 샘플 데이터 확인
  const { data: samples } = await supabase.from('master_places').select('name, api_source').limit(5);
  console.log('\nSample items from master_places:', samples);
}

run();

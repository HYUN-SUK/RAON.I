import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectSpotData() {
  const { data, error } = await supabase
    .from('master_places')
    .select('name, raw_data, trust_score')
    .eq('api_source', 'TOUR_SPOT')
    .limit(10);
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log('--- Sample SPOT Data Inspection ---');
  data.forEach(s => {
    console.log(`\n[${s.name}]`);
    console.log('Fields in raw_data:', Object.keys(s.raw_data || {}));
    if (s.raw_data?.popularity_v2) {
      console.log('popularity_v2 details:', s.raw_data.popularity_v2);
    }
  });
}

inspectSpotData();

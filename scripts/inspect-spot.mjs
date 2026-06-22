import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("Searching spot (attraction) samples in memory from recent 1000 items...");

  const { data, error } = await supabase
    .from('master_places')
    .select('id, name, category, address, raw_data, description, updated_at')
    .eq('is_active', true)
    .order('updated_at', { ascending: false }) // 최신순
    .limit(1000);

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  const samples = data.filter(p => p.category === 'SPOT' && p.raw_data?.enriched === true).slice(0, 3);

  console.log("Spot Samples:");
  console.log(JSON.stringify(samples, null, 2));
  process.exit(0);
}

run();

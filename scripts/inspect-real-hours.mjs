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

  console.log("Fetching sample places with actual operating hours...");

  const { data, error } = await supabase
    .from('master_places')
    .select('id, name, category, address, raw_data, description, updated_at')
    .eq('is_active', true)
    .eq('raw_data->enriched', true)
    .not('raw_data->>operating_hours', 'eq', '정보 없음 (방문 전 확인 권장)')
    .not('raw_data->>operating_hours', 'eq', '상시 개방 또는 정보 없음')
    .limit(5);

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

run();

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

  const targetNames = ['참숯우돈', '대교약선요리', '희동부대찌개', '소보양본가', '영남장어횟집', '옛고을'];
  console.log(`Searching specific restaurants: ${targetNames.join(', ')}...`);

  const { data, error } = await supabase
    .from('master_places')
    .select('id, name, category, address, raw_data, description, updated_at')
    .in('name', targetNames);

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  console.log("Results:");
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

run();

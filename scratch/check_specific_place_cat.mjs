import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  console.log("Checking specific places category...");
  
  const { data, error } = await supabase
    .from('master_places')
    .select('id, name, category, api_source, raw_data')
    .eq('name', 'LG유플러스 송촌동 먹자골목점');
    
  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
  
  console.log("Query Results:", JSON.stringify(data, null, 2));
}

check();

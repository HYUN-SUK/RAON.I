import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function addMissCount() {
  // Step 1: Try to read miss_count to see if it already exists
  const { data, error } = await supabase.from('master_places').select('miss_count').limit(1);
  
  if (error && error.message.includes('miss_count')) {
    console.log('miss_count column does NOT exist. Need manual creation via Supabase Dashboard SQL Editor.');
    console.log('Run this SQL: ALTER TABLE master_places ADD COLUMN miss_count INTEGER DEFAULT 0;');
  } else {
    console.log('miss_count column EXISTS!');
    console.log('Sample value:', data?.[0]?.miss_count);
  }
}

addMissCount();

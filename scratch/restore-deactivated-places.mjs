import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const targetIds = [
  '075b77fd-2fa6-53a9-b0e5-4812df385a9e', // 주식회사 엔마트용인점
  '0754ea86-6bf6-5ff3-94ca-5cd98f7256a6'  // (주)이마트에브리데이 가운점
];

async function run() {
  console.log("Starting precision restoration for deactivated marts...");
  const { data, error } = await supabase
    .from('master_places')
    .update({
      is_active: true,
      miss_count: 0,
      updated_at: new Date().toISOString()
    })
    .in('id', targetIds)
    .select('id, name, is_active, miss_count');

  if (error) {
    console.error("Restoration failed:", error);
    return;
  }

  console.log("Restoration successful! Restored places:");
  console.log(data);
}
run();

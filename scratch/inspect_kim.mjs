import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspectKimJiSeob() {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .ilike('guest_name', '%김지섭%')
    .single();

  console.log('=== [김지섭 님 예약 DB 레코드 원본] ===');
  console.log(data);
}

inspectKimJiSeob();

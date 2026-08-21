import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspectBlockedDatesInSimulation() {
  const { data: blocked } = await supabase.from('blocked_dates').select('*');
  console.log('현재 10월 차단일:');
  blocked?.filter(b => b.start_date.includes('2026-10')).forEach(b => {
    console.log(`- [${b.site_id}] ${b.start_date} ~ ${b.end_date} (${b.guest_name})`);
  });
}

inspectBlockedDatesInSimulation();

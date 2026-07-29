import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Service key missing');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, serviceKey);

async function testAdminSave() {
  console.log('Testing Admin update to site_config pricing_config (End: Aug 30)...');
  const testConfig = {
    weekday: 40000,
    weekend: 70000,
    peakWeekday: 50000,
    peakWeekend: 70000,
    extraFamily: 35000,
    visitor: 10000,
    longStayDiscount: 10000,
    seasons: [
      { name: 'Summer Peak', startMonth: 6, startDay: 1, endMonth: 8, endDay: 30 }
    ]
  };

  const { data, error } = await adminSupabase
    .from('site_config')
    .update({ 
      pricing_config: testConfig,
      updated_at: new Date().toISOString()
    })
    .eq('id', 1)
    .select();

  console.log('Error:', error);
  console.log('Updated Data:', JSON.stringify(data, null, 2));
}

testAdminSave();

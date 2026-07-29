import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, anonKey);

async function testSave() {
  console.log('Testing anon update to site_config pricing_config...');
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

  const { data, error } = await supabase
    .from('site_config')
    .update({ pricing_config: testConfig })
    .eq('id', 1)
    .select();

  console.log('Error:', error);
  console.log('Returned Data:', data);
}

testSave();

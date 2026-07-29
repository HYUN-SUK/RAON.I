import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase URL or Key missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('Checking and initializing pricing_config in site_config table...');
  
  const defaultConfig = {
    weekday: 40000,
    weekend: 70000,
    peakWeekday: 50000,
    peakWeekend: 70000,
    extraFamily: 35000,
    visitor: 10000,
    longStayDiscount: 10000,
    seasons: [
      { name: 'Summer Peak', startMonth: 6, startDay: 1, endMonth: 9, endDay: 30 }
    ]
  };

  // Check if row 1 exists
  const { data: existing, error: selectErr } = await supabase
    .from('site_config')
    .select('id, pricing_config')
    .eq('id', 1)
    .maybeSingle();

  if (selectErr) {
    console.error('Select Error:', selectErr.message);
  }

  if (existing) {
    if (!existing.pricing_config) {
      console.log('Updating row 1 with default pricing_config (Summer Peak 6/1~9/30)...');
      const { error: updateErr } = await supabase
        .from('site_config')
        .update({ pricing_config: defaultConfig })
        .eq('id', 1);

      if (updateErr) {
        console.error('Update Error (Column might need migration via SQL editor if not added):', updateErr.message);
      } else {
        console.log('Successfully initialized site_config pricing_config in DB!');
      }
    } else {
      console.log('pricing_config already exists in DB:', JSON.stringify(existing.pricing_config, null, 2));
    }
  } else {
    console.log('Inserting row 1 into site_config...');
    const { error: insertErr } = await supabase
      .from('site_config')
      .insert({ id: 1, pricing_config: defaultConfig });

    if (insertErr) {
      console.error('Insert Error:', insertErr.message);
    } else {
      console.log('Successfully created site_config row 1 with pricing_config!');
    }
  }
}

applyMigration();

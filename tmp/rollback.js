import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const threshold = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  // 1. Delete all master_places created recently (the ones with bad '_' UUID or duplicated)
  console.log(`Deleting newly inserted rows created after ${threshold}...`);
  const { data: delData, error: delErr } = await supabase
    .from('master_places')
    .delete()
    .gte('created_at', threshold)
    .eq('sido', '전라남도') // target only the rotated region
    .select('id');
  
  if (delErr) {
    console.error('Delete Error:', delErr);
  } else {
    console.log(`Deleted ${delData?.length || 0} malformed new rows.`);
  }

  // 2. Re-activate all master_places soft-deleted recently
  console.log(`Re-activating rows soft-deleted after ${threshold}...`);
  const { data: actData, error: actErr } = await supabase
    .from('master_places')
    .update({ is_active: true })
    .eq('is_active', false)
    .eq('sido', '전라남도')
    .gte('updated_at', threshold)
    .select('id');

  if (actErr) {
    console.error('Activate Error:', actErr);
  } else {
    console.log(`Re-activated ${actData?.length || 0} valid existing rows.`);
  }
}

run();

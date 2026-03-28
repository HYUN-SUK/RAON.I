
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fix() {
  console.log('--- Fixing Master Places Locations ---');
  // Get all items in Yesan-gun first to ensure today's audit works
  const { data: items } = await supabase
    .from('master_places')
    .select('id, lat, lng')
    .ilike('address', '%예산군%')
    .limit(100);

  if (!items) {
    console.log('No items found for Yesan-gun.');
    return;
  }

  console.log(`Found ${items.length} items to update.`);
  for (const item of items) {
    // We update updated_at to trigger the DB's internal logic or let the trigger handle it
    // Actually, let's just use RPC if it exists, or just a simple update
    await supabase.from('master_places').update({ updated_at: new Date() }).eq('id', item.id);
  }
  console.log('Update triggering completed.');
}
fix();

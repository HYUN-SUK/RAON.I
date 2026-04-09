import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v5 as uuidv5 } from 'uuid';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // 1. Check RESTAURANT GOOD generated ID
  const { data: spots } = await supabase.from('master_places').select('id, api_source, name, address, raw_data').eq('category', 'SPOT').limit(1);
  if (spots && spots.length) {
    const s = spots[0];
    const expectedId = uuidv5(`${s.api_source}_${s.name}_${s.address}`, '6ba7b810-9dad-11d1-80b4-00c04fd430c8');
    console.log('--- DB ID vs Generated ID ---');
    console.log('DB ID:', s.id);
    console.log('Gen ID:', expectedId);
    console.log('Match?', s.id === expectedId);
    console.log(s);
  }

  // 2. Check MAFRA Key
  console.log('--- MAFRA KEY ---');
  console.log('Has SAFE_API_KEY?', !!process.env.SAFE_API_KEY);
  console.log('Has PUBLIC_DATA_API_KEY?', !!process.env.PUBLIC_DATA_API_KEY);
  console.log('SAFE_API_KEY length:', process.env.SAFE_API_KEY?.length);
  
  // 3. Count deactivated items
  const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString();
  const { count } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('is_active', false).gte('updated_at', yesterday);
  console.log('--- DEACTIVATED ITEMS ---');
  console.log('Items deactivated recently:', count);
}
run();

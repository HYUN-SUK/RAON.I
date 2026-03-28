
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('--- FINAL SPATIAL CHECK ---');
  const targetLng = 126.764786;
  const targetLat = 36.626909;

  const sql = `
    SELECT name, category, ST_AsText(location) as loc, ST_Distance(location::geography, ST_SetSRID(ST_MakePoint(${targetLng}, ${targetLat}), 4326)::geography) as dist
    FROM master_places 
    WHERE ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint(${targetLng}, ${targetLat}), 4326)::geography, 30000)
    LIMIT 5
  `;
  
  const { data, error } = await supabase.rpc('eval', { sql });
  if (error) {
    console.error('SQL Error:', error.message);
  } else {
    console.log(`Success: Found ${data?.length || 0} items within 30km.`);
    if (data?.length > 0) {
      console.log('Sample:', data[0].name, '| Dist:', data[0].dist);
    }
  }
}
check();

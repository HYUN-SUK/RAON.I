
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findFunction() {
  console.log('--- Finding Function Signature ---');
  // We can't use eval if it doesn't exist. Let's try listing functions via a different rpc if possible, 
  // or just try common variations.
  
  const testParams = [
    { target_lat: 36.6, target_lng: 126.8, radius_meters: 30000, limit_count: 5, target_category: 'RESTAURANT' },
    { target_lat: 36.6, target_lng: 126.8, radius_meters: 30000, target_category: 'RESTAURANT', limit_count: 5 },
    { p_lat: 36.6, p_lng: 126.8, p_radius: 30000, p_limit: 5, p_category: 'RESTAURANT' }
  ];

  for (const [i, p] of testParams.entries()) {
    const { data, error } = await supabase.rpc('get_master_places_in_radius', p);
    console.log(`Test ${i+1}:`, error ? `Error: ${error.message}` : `Success: ${data?.length} items`);
    // If error says something about arguments, log it
  }
}
findFunction();

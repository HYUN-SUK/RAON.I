
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findTheTruth() {
  console.log('--- FINDING THE TRUTH (Pure JS Audit) ---');
  const targetLat = 36.626909;
  const targetLng = 126.764786;

  // 1. Fetch ALL places in Yesan-gun via text search first (it's fast)
  const { data: raw } = await supabase.from('master_places')
    .select('*')
    .ilike('address', '%예산군%');
  
  console.log(`Found ${raw?.length || 0} items with '예산군' in address.`);
  
  if (raw?.length > 0) {
    const counts = raw.reduce((acc, i) => {
      acc[i.category] = (acc[i.category] || 0) + 1;
      return acc;
    }, {});
    console.log('Categories in Yesan:', JSON.stringify(counts, null, 2));
    
    // Check Top 10 by trust_score for RESTAURANT
    const restaurants = raw.filter(i => i.category === 'RESTAURANT' || i.category === '음식점')
      .sort((a, b) => (b.trust_score || 0) - (a.trust_score || 0));
    
    console.log(`Total Restaurants in Yesan: ${restaurants.length}`);
    restaurants.slice(0, 5).forEach(r => console.log(` - ${r.name} (${r.trust_score}) | ${r.address}`));
  }
}
findTheTruth();

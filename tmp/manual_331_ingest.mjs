
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function manualIngest() {
  console.log('--- ENERGIZING 300-QUOTA PIPELINE MANUALLY ---');
  const targetLat = 36.626909;
  const targetLng = 126.764786;
  const targetDate = '2026-03-31';

  const categories = [
    { cat: '음식점', limit: 300, display: 'RESTAURANT' },
    { cat: '명소', limit: 300, display: 'SPOT' },
    { cat: '대형마트', limit: 15, display: 'MART' },
    { cat: '중형슈퍼마켓', limit: 15, display: 'MART' },
    { cat: '축제', limit: 30, display: 'FESTIVAL' },
    { cat: '응급실', limit: 20, display: 'HOSPITAL' },
    { cat: '주유소', limit: 20, display: 'GAS_STATION' }
  ];

  const allFacts = [];

  for (const { cat, limit, display } of categories) {
    console.log(`Fetching ${cat} from Master Pool...`);
    const { data } = await supabase.from('master_places')
      .select('*')
      .eq('category', cat);
    
    if (!data) continue;

    // Filter by distance in JS (30km radius)
    const candidates = data.filter(item => {
      const d = Math.sqrt(Math.pow(item.lat - targetLat, 2) + Math.pow(item.lng - targetLng, 2));
      return d <= 0.3; // Roughly 33km
    }).sort((a, b) => (b.trust_score || 0) - (a.trust_score || 0))
      .slice(0, limit);

    console.log(`  - Selected ${candidates.length} candidates for ${display}`);
    candidates.forEach(c => allFacts.push({
      category: display,
      name: c.name,
      address: c.address,
      lat: c.lat,
      lng: c.lng,
      api_source: c.api_source || 'MASTER_POOL',
      trust_score: c.trust_score || 10,
      target_date: targetDate // This is for our audit context
    }));
  }

  console.log(`Total facts to ingest: ${allFacts.length}`);
  // Since smart_plan_facts might not have target_date column, we omit it for real DB upsert
  const dbInserts = allFacts.map(({target_date, ...rest}) => rest);
  
  const { error } = await supabase.from('smart_plan_facts').upsert(dbInserts, { onConflict: 'name, address' });
  if (error) console.error('UPSERT ERROR:', error.message);
  else console.log('MANUAL INGESTION SUCCESSFUL!');
}
manualIngest();

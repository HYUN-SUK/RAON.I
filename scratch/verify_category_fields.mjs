import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const targetNames = ['불주사(군산)', '마린시티', '빙계계곡', '서울창포원'];
  
  for (const name of targetNames) {
    console.log(`\n=== Inspecting: ${name} ===`);
    const { data, error } = await s.from('master_places')
      .select('id, name, category, raw_data, description')
      .eq('name', name)
      .limit(1);
      
    if (error) {
      console.error(`Error:`, error.message);
      continue;
    }
    
    if (data && data[0]) {
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log(`Not found`);
    }
  }
}
main();

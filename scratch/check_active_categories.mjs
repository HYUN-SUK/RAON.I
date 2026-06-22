import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  let from = 0;
  const step = 1000;
  const activeCategories = new Set();
  
  while (true) {
    const { data, error } = await s.from('master_places')
      .select('category')
      .eq('is_active', true)
      .range(from, from + step - 1);
      
    if (error) {
      console.error("Error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    
    data.forEach(x => activeCategories.add(x.category));
    if (data.length < step) break;
    from += step;
  }
  
  console.log("Actual Active Categories in master_places:", Array.from(activeCategories));
}
main();

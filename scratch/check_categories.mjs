import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await s.rpc('exec_sql', { query: "SELECT category, count(*) FROM master_places GROUP BY category" });
  if (error) {
    console.error("exec_sql Error:", error.message);
    // fallback: just fetch 100 rows to see what categories exist
    const { data: sample, error: err2 } = await s.from('master_places').select('category').limit(200);
    if (err2) {
      console.error("fetch sample Error:", err2.message);
    } else {
      const cats = [...new Set(sample.map(x => x.category))];
      console.log("Sample categories:", cats);
    }
  } else {
    console.log("Categories distribution:", data);
  }
}
main();

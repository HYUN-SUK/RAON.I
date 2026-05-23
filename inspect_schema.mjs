
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  const { data, error } = await supabase
    .from('smart_plan_facts')
    .select('name, category, api_source, description, raw_data, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error("Error fetching facts:", error);
    return;
  }
  
  console.log(`Fetched ${data.length} recently cached facts.`);
  for (const item of data) {
    console.log(`\n- Name: ${item.name} (${item.category})`);
    console.log(`  Source: ${item.api_source}`);
    console.log(`  Description: ${item.description}`);
    console.log(`  Created At: ${item.created_at}`);
    console.log(`  Has kakao_url?`, !!item.raw_data?.kakao_url);
    if (item.raw_data?.kakao_url) {
      console.log(`  Kakao URL: ${item.raw_data.kakao_url}`);
      console.log(`  Scraping info:`, JSON.stringify(item.raw_data.scraping));
    }
  }
}

inspectSchema();


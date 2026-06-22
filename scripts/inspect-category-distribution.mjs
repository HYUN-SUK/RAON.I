import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectCategoryDistribution() {
  console.log("Analyzing category distribution in master_places table...");
  
  let allPlaces = [];
  let lastId = '';
  const limit = 5000;
  
  while (true) {
    let query = supabase
      .from('master_places')
      .select('id, category, is_active')
      .order('id')
      .limit(limit);
      
    if (lastId) {
      query = query.gt('id', lastId);
    }
    const { data, error } = await query;
      
    if (error) {
      console.error("Error fetching data:", error.message);
      process.exit(1);
    }
    
    if (!data || data.length === 0) break;
    
    allPlaces = allPlaces.concat(data);
    lastId = data[data.length - 1].id;
    
    if (data.length < limit) break;
  }

  console.log(`Total places retrieved: ${allPlaces.length}`);

  const distribution = {};
  allPlaces.forEach(p => {
    const cat = p.category || 'NULL';
    const activeKey = p.is_active === true ? 'active' : 'inactive';
    if (!distribution[cat]) {
      distribution[cat] = { total: 0, active: 0, inactive: 0 };
    }
    distribution[cat].total++;
    distribution[cat][activeKey]++;
  });

  console.log("\n=== Category Distribution in master_places ===");
  console.log("| Category | Total | Active | Inactive |");
  console.log("| --- | --- | --- | --- |");
  Object.keys(distribution).sort().forEach(cat => {
    const d = distribution[cat];
    console.log(`| ${cat} | ${d.total} | ${d.active} | ${d.inactive} |`);
  });
}

inspectCategoryDistribution();

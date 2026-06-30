import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  console.log("Analyzing places that were fallback-crawled but have contentid (TourAPI ID)...");

  let allPlaces = [];
  let lastId = '';
  const limit = 1000;

  while (true) {
    let query = supabase
      .from('master_places')
      .select('id, name, category, api_source, raw_data, is_active')
      .eq('is_active', true)
      .order('id')
      .limit(limit);

    if (lastId) {
      query = query.gt('id', lastId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching:", error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) break;

    allPlaces = allPlaces.concat(data);
    lastId = data[data.length - 1].id;
    if (data.length < limit) break;
  }

  // api_source가 'PUBLIC_FALLBACK_CRAWLER' 이거나 raw_data.api_source가 'PUBLIC_FALLBACK_CRAWLER'인 것 중 contentid가 있는 것
  const targets = allPlaces.filter(p => {
    const apiSource = p.api_source || p.raw_data?.api_source;
    const hasContentId = p.raw_data?.contentid || p.raw_data?.contentId;
    const isPublicCat = ['SPOT', 'FESTIVAL'].includes(p.category);
    return apiSource === 'PUBLIC_FALLBACK_CRAWLER' && hasContentId && isPublicCat;
  });

  console.log(`Total active SPOT/FESTIVAL places: ${allPlaces.length}`);
  console.log(`Places fallback-crawled but having contentid: ${targets.length}`);

  if (targets.length > 0) {
    console.log("\n=== Samples of targets ===");
    targets.slice(0, 10).forEach((t, i) => {
      console.log(`[${i+1}] Name: ${t.name} | Category: ${t.category} | ContentID: ${t.raw_data?.contentid || t.raw_data?.contentId}`);
    });
  }
}

check();

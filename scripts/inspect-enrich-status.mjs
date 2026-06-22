import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function inspect() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("Analyzing master_places data enrichment status...");

  // 1. Total active places count
  const { count: totalActive } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);
  console.log(`Total active places: ${totalActive}`);

  // 2. updated_at is null
  const { count: updatedAtNull } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .is('updated_at', null);
  console.log(`Places with updated_at IS NULL: ${updatedAtNull}`);

  // 3. raw_data->>'operating_hours' is not null
  const { count: hasHours } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('raw_data->>operating_hours', 'is', null);
  console.log(`Places with operating_hours details: ${hasHours}`);

  // 4. raw_data->'enriched' is true
  const { count: hasEnrichedFlag } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('raw_data->enriched', true);
  console.log(`Places with enriched=true flag: ${hasEnrichedFlag}`);

  // 5. Active places without operating_hours (Real targets for enrichment)
  const { count: missingDetails } = await supabase
    .from('master_places')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .is('raw_data->>operating_hours', null);
  console.log(`Places missing operating_hours (un-enriched): ${missingDetails}`);

  // 6. Print sample records that are un-enriched
  const { data: sampleUnenriched } = await supabase
    .from('master_places')
    .select('id, name, category, address, raw_data, updated_at')
    .eq('is_active', true)
    .is('raw_data->>operating_hours', null)
    .limit(5);

  console.log("\nSample Un-enriched Places:");
  console.log(JSON.stringify(sampleUnenriched, null, 2));

  process.exit(0);
}

inspect();

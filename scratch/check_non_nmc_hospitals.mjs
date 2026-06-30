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
  console.log("Checking hospital data in master_places...");

  let allHospitals = [];
  let lastId = '';
  const limit = 1000;

  while (true) {
    let query = supabase
      .from('master_places')
      .select('id, name, address, category, raw_data, is_active')
      .eq('category', 'HOSPITAL')
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

    allHospitals = allHospitals.concat(data);
    lastId = data[data.length - 1].id;
    if (data.length < limit) break;
  }

  console.log(`Total active/inactive hospitals: ${allHospitals.length}`);

  const nmcHospitals = allHospitals.filter(h => h.raw_data?.hpid);
  const nonNmcHospitals = allHospitals.filter(h => !h.raw_data?.hpid);

  console.log(`NMC hospitals (has hpid): ${nmcHospitals.length}`);
  console.log(`Non-NMC hospitals (no hpid): ${nonNmcHospitals.length}`);

  console.log("\n=== Examples of Non-NMC hospitals ===");
  nonNmcHospitals.slice(0, 30).forEach((h, i) => {
    console.log(`[${i + 1}] ID: ${h.id} | Name: ${h.name} | Address: ${h.address} | Active: ${h.is_active}`);
  });
}

check();

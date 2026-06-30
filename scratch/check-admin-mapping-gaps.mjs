import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getAdminCodes } from '../scripts/utils/admin-code-mapping.mjs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkGaps() {
  console.log("=== Checking for Admin Code Mapping Gaps Across All Regions ===");

  const { data, error } = await supabase
    .from('master_places')
    .select('id, name, sido, sigungu, category')
    .eq('category', 'SPOT')
    .limit(100);

  if (error) {
    console.error("DB Fetch Error:", error.message);
    return;
  }

  console.log(`Fetched ${data?.length || 0} spots.`);
  if (!data || data.length === 0) {
    console.log("No data returned");
    return;
  }

  const gaps = [];
  data.forEach(p => {
    const { areaCd, signguCd } = getAdminCodes(p.sido, p.sigungu);
    if (!areaCd || !signguCd) {
      gaps.push({
        id: p.id,
        name: p.name,
        sido: p.sido,
        sigungu: p.sigungu,
        reason: !areaCd ? "SIDO_UNMAPPED" : "SIGUNGU_UNMAPPED"
      });
    }
  });

  console.log(`Gaps found: ${gaps.length}`);
  gaps.forEach(g => {
    console.log(`- ${g.name} (Sido: ${g.sido}, Sigungu: ${g.sigungu}) -> ${g.reason}`);
  });
}

checkGaps();

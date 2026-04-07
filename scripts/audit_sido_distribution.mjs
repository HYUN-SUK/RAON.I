import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SIDO_NAMES = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시', 
  '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도'
];

async function run() {
  const SIDO_ROTATION_SET = new Set(SIDO_NAMES);
  let offset = 0;
  const limit = 1000;
  
  const stats = {
    valid: {},
    invalid: {},
    nullCount: 0,
    total: 0
  };

  SIDO_NAMES.forEach(s => stats.valid[s] = 0);
  console.log('Starting SIDO audit pagination...');

  while (true) {
    const { data, error } = await supabase.from('master_places').select('id, sido').range(offset, offset + limit - 1);
    if (error) { 
        console.error('Fetch error:', error.message); 
        break; 
    }
    
    if (!data || data.length === 0) break;

    for (const row of data) {
      stats.total++;
      if (row.sido === null || row.sido === undefined || String(row.sido).trim() === '') {
        stats.nullCount++;
      } else if (SIDO_ROTATION_SET.has(row.sido)) {
        stats.valid[row.sido]++;
      } else {
        const s = String(row.sido).trim();
        stats.invalid[s] = (stats.invalid[s] || 0) + 1;
      }
    }
    
    offset += limit;
    if (offset % 20000 === 0) console.log(`Processed ${offset} rows...`);
  }

  console.log(`\nAudit Complete! Total Scanned: ${stats.total}`);
  fs.writeFileSync('sido_audit_results.json', JSON.stringify(stats, null, 2), 'utf8');
}
run();

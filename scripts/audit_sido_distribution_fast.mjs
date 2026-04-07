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
  const limit = 1000;
  
  const stats = {
    valid: {},
    invalid: {},
    nullCount: 0,
    total: 0
  };
  SIDO_NAMES.forEach(s => stats.valid[s] = 0);
  
  console.log('Starting parallel SIDO audit...');
  
  // 1. Get total count
  const { count } = await supabase.from('master_places').select('id', { count: 'exact', head: true });
  console.log(`Total expected rows: ${count}`);
  
  // 2. Fetch in parallel
  const totalRequests = Math.ceil(count / limit);
  const promises = [];
  
  for (let i = 0; i < totalRequests; i++) {
    const offset = i * limit;
    promises.push(
      supabase.from('master_places').select('sido').range(offset, offset + limit - 1)
      .then(({data}) => data || [])
    );
  }
  
  const results = await Promise.all(promises);
  
  // 3. Process
  for (const chunk of results) {
    for (const row of chunk) {
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
  }

  console.log(`\nAudit Complete! Total Scanned: ${stats.total}`);
  fs.writeFileSync('sido_audit_results.json', JSON.stringify(stats, null, 2), 'utf8');
}
run();

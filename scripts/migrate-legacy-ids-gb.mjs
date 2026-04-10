import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v5 as uuidv5 } from 'uuid';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function getNormalizedAddr(addr) {
  if (!addr) return '';
  let normalized = addr.trim();
  const hashSidoMap = {
    '서울': '서울특별시', '부산': '부산광역시', '대구': '대구광역시', '인천': '인천광역시', '광주': '광주광역시',
    '대전': '대전광역시', '울산': '울산광역시', '세종': '세종특별자치시', '경기': '경기도', '강원': '강원특별자치도',
    '충북': '충청북도', '충남': '충청남도', '전북': '전라북도', '전남': '전라남도', '경북': '경상북도',
    '경남': '경상남도', '제주': '제주특별자치도'
  };
  for (const [short, full] of Object.entries(hashSidoMap)) {
    if (normalized.startsWith(short) && !normalized.startsWith(full)) {
      normalized = normalized.replace(short, full);
      break;
    }
  }
  return normalized;
}

function getCleanString(str) {
  if (!str) return '';
  return String(str)
    .replace(/\(.+?\)/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

const generateId = (source, name, addr) => {
  const normalizedAddr = getNormalizedAddr(addr);
  const cleanName = getCleanString(name);
  const cleanAddr = getCleanString(normalizedAddr);
  return uuidv5(`${source}|${cleanName}|${cleanAddr}`, MY_NAMESPACE);
};

const SIDO_SHORT_MAP = { '경상북도': '경북' };

async function migrateCategory(source, region) {
  console.log(`🚀 Migrating ${source} in ${region}...`);
  
  let offset = 0;
  const batchSize = 1000;
  let totalMigrated = 0;
  let totalChecked = 0;

  while (true) {
    const { data: records, error } = await supabase
      .from('master_places')
      .select('*')
      .eq('api_source', source)
      .in('sido', [region, SIDO_SHORT_MAP[region] || region])
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error(`  ❌ Fetch Error for ${source}:`, error.message);
      break;
    }
    if (!records || records.length === 0) break;

    for (const r of records) {
      totalChecked++;
      const newId = generateId(r.api_source, r.name, r.address);
      if (newId !== r.id) {
        const oldId = r.id;
        const { error: insErr } = await supabase.from('master_places').upsert({ ...r, id: newId });
        if (!insErr) {
          await supabase.from('master_places').delete().eq('id', oldId);
          totalMigrated++;
        }
      }
    }
    
    console.log(`    - Progress: ${totalChecked} checked...`);
    offset += batchSize;
    if (records.length < batchSize) break;
  }
  
  console.log(`  ✅ ${source} migration complete: ${totalMigrated}/${totalChecked}`);
}

async function run() {
  const targetRegion = '경상북도';
  const sources = [
    'SAFE_RESTAURANT', 
    'LOCALDATA_RESTAURANT_GOOD', 
    'SMBA_BAEK', 
    'LOCALDATA_MART_LARGE', 
    'LOCALDATA_MART_SSM', 
    'LOCALDATA_MART_OTHER', 
    'TOUR_SPOT'
  ];

  for (const s of sources) {
    await migrateCategory(s, targetRegion);
  }
  console.log('✨ Gyeongsangbuk-do ID Healing Complete!');
}

run();

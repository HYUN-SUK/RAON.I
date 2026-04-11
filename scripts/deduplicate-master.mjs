import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { v5 as uuidv5 } from 'uuid';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function getCleanString(str) {
  if (!str) return '';
  return str.toString()
    .replace(/\(.+?\)/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function getNormalizedAddr(addr) {
  if (!addr) return '';
  let a = addr.replace(/,\s?대한민국$/, '').trim();
  a = a.replace(/^(서울시|서울특별시)\s?/, '서울특별시 ');
  a = a.replace(/^(경남|경상남도)\s?/, '경상남도 ');
  a = a.replace(/^(경북|경상북도)\s?/, '경상북도 ');
  a = a.replace(/^(전남|전라남도)\s?/, '전라남도 ');
  a = a.replace(/^(전북|전라북도)\s?/, '전라북도 ');
  a = a.replace(/^(충남|충청남도)\s?/, '충청남도 ');
  a = a.replace(/^(충북|충청북도)\s?/, '충청북도 ');
  a = a.replace(/^(강원|강원도)\s?/, '강원특별자치도 ');
  a = a.replace(/^(경기|경기도)\s?/, '경기도 ');
  a = a.replace(/^(인천|인천광역시)\s?/, '인천광역시 ');
  a = a.replace(/^(부산|부산광역시)\s?/, '부산광역시 ');
  a = a.replace(/^(대구|대구광역시)\s?/, '대구광역시 ');
  a = a.replace(/^(광주|광주광역시)\s?/, '광주광역시 ');
  a = a.replace(/^(대전|대전광역시)\s?/, '대전광역시 ');
  a = a.replace(/^(울산|울산광역시)\s?/, '울산광역시 ');
  a = a.replace(/^(세종|세종특별자치시)\s?/, '세종특별자치시 ');
  a = a.replace(/^(제주|제주특별자치도)\s?/, '제주특별자치도 ');
  return a.trim();
}

const generateId = (source, name, addr) => {
  const normalizedAddr = getNormalizedAddr(addr);
  const cleanName = getCleanString(name);
  const cleanAddr = getCleanString(normalizedAddr);
  return uuidv5(`${source}|${cleanName}|${cleanAddr}`, MY_NAMESPACE);
};

async function deduplicate() {
  console.log('🧹 Starting Master Data Deduplication (SOP v11.3 Healing)...');
  
  // 1. Gyeongnam region specifically (where today's mess happened)
  const targetSido = '경상남도';
  console.log(`🔎 Target Region: ${targetSido}`);
  
  const { data: records, error } = await supabase
    .from('master_places')
    .select('id, api_source, name, address, created_at')
    .eq('sido', targetSido);
    
  if (error) {
    console.error('❌ Fetch Error:', error.message);
    return;
  }
  
  console.log(`📊 Total Records in ${targetSido}: ${records.length}`);
  
  // Group by (source, cleanName, cleanAddr)
  const groups = new Map();
  
  for (const r of records) {
    const key = `${r.api_source}|${getCleanString(r.name)}|${getCleanString(getNormalizedAddr(r.address))}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(r);
  }
  
  let deletedCount = 0;
  console.log(`🔍 Found ${groups.size} unique keys. Checking for duplicates...`);
  
  for (const [key, items] of groups.entries()) {
    if (items.length > 1) {
      // Sort by created_at ascending (keep the oldest)
      items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      const keep = items[0];
      const dupes = items.slice(1);
      
      console.log(`  🚩 Match: [${keep.name}] - ${dupes.length} duplicates found.`);
      
      for (const dupe of dupes) {
        const { error: delErr } = await supabase
          .from('master_places')
          .delete()
          .eq('id', dupe.id);
          
        if (delErr) {
          console.error(`    ❌ Error deleting ${dupe.id}:`, delErr.message);
        } else {
          deletedCount++;
        }
      }
    }
  }
  
  console.log(`✨ Cleanup Complete! Total Deleted: ${deletedCount}`);
}

deduplicate();

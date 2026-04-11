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
  a = a.replace(/^(서울|서울특별시)\s?/, '서울특별시 ');
  a = a.replace(/^(부산|부산광역시)\s?/, '부산광역시 ');
  a = a.replace(/^(대구|대구광역시)\s?/, '대구광역시 ');
  a = a.replace(/^(인천|인천광역시)\s?/, '인천광역시 ');
  a = a.replace(/^(광주|광주광역시)\s?/, '광주광역시 ');
  a = a.replace(/^(대전|대전광역시)\s?/, '대전광역시 ');
  a = a.replace(/^(울산|울산광역시)\s?/, '울산광역시 ');
  a = a.replace(/^(세종|세종특별자치시)\s?/, '세종특별자치시 ');
  a = a.replace(/^(경기|경기도)\s?/, '경기도 ');
  a = a.replace(/^(강원|강원도|강원특별자치도)\s?/, '강원특별자치도 ');
  a = a.replace(/^(충북|충청북도)\s?/, '충청북도 ');
  a = a.replace(/^(충남|충청남도)\s?/, '충청남도 ');
  a = a.replace(/^(전북|전라북도|전북특별자치도)\s?/, '전북특별자치도 ');
  a = a.replace(/^(전남|전라남도)\s?/, '전라남도 ');
  a = a.replace(/^(경북|경상북도)\s?/, '경상북도 ');
  a = a.replace(/^(경남|경상남도)\s?/, '경상남도 ');
  a = a.replace(/^(제주|제주도|제주특별자치도)\s?/, '제주특별자치도 ');
  return a.trim();
}

const generateSopId = (source, name, addr) => {
  const normAddr = getNormalizedAddr(addr);
  const cName = getCleanString(name);
  const cAddr = getCleanString(normAddr);
  return uuidv5(`${source}|${cName}|${cAddr}`, MY_NAMESPACE);
};

async function heal() {
  console.log('🌟 [RAONAI Master Data Healing v3.1] Starting extreme batch audit...');
  
  let totalProcessed = 0;
  let totalFixed = 0;
  let totalDeleted = 0;
  let lastId = null;
  const pageSize = 500;
  
  while (true) {
    let query = supabase
      .from('master_places')
      .select('*')
      .order('id', { ascending: true })
      .limit(pageSize);

    if (lastId) query = query.gt('id', lastId);

    const { data: records, error } = await query;
    if (error) { console.error('❌ Fetch error:', error.message); break; }
    if (!records || records.length === 0) break;

    const correctIdMap = new Map();
    const suspectIds = [];

    for (const r of records) {
      const correctId = generateSopId(r.api_source, r.name, r.address);
      if (r.id !== correctId) {
        correctIdMap.set(r.id, correctId);
        suspectIds.push(correctId);
      }
    }

    // Step 2: Batch check which correct IDs already exist
    let existingSet = new Set();
    if (suspectIds.length > 0) {
      const { data: alreadyExisting } = await supabase
        .from('master_places')
        .select('id')
        .in('id', suspectIds);
      existingSet = new Set(alreadyExisting?.map(e => e.id) || []);
    }

    const upsertBuffer = [];
    const deleteIds = [];

    for (const r of records) {
      if (correctIdMap.has(r.id)) {
        const correctId = correctIdMap.get(r.id);
        if (existingSet.has(correctId)) {
          // Case A: Correct ID already exists -> Just delete this redundant record
          deleteIds.push(r.id);
        } else {
          // Case B: Correct ID doesn't exist -> Move (Upsert new, then delete old)
          upsertBuffer.push({ ...r, id: correctId });
          deleteIds.push(r.id);
        }
      }
      lastId = r.id;
    }

    // Execute Batch Operations
    if (upsertBuffer.length > 0) {
      const { error: insErr } = await supabase.from('master_places').upsert(upsertBuffer);
      if (!insErr) totalFixed += upsertBuffer.length;
    }
    
    if (deleteIds.length > 0) {
      const { error: delErr } = await supabase.from('master_places').delete().in('id', deleteIds);
      if (!delErr) totalDeleted += deleteIds.length;
    }

    totalProcessed += records.length;
    process.stdout.write(`\r📊 Processed: ${totalProcessed} | Corrected: ${totalFixed} | Deleted (Redundant/Old): ${totalDeleted} ...`);
  }

  console.log(`\n\n✨ [Healing v3.1 Complete]`);
  console.log(`📊 Total Records Reviewed: ${totalProcessed}`);
  console.log(`🔄 Total IDs Corrected: ${totalFixed}`);
  console.log(`🧹 Total Records Removed: ${totalDeleted}`);
  
  const { count } = await supabase.from('master_places').select('*', { count: 'exact', head: true });
  console.log(`🏠 Final DB Total Count: ${count}`);
}

heal();

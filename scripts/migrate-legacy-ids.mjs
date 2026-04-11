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

async function migrate() {
  console.log('🚀 Starting Global ID Healing (SOP v11.3) with Cursor-based Optimization...');
  
  const batchSize = 1000;
  const parallelLimit = 50;
  let totalMigrated = 0;
  let totalProcessed = 0;
  let lastId = null;

  while (true) {
    let query = supabase
      .from('master_places')
      .select('id, api_source, category, name, description, address, lat, lng, trust_score, raw_data, sido, sigungu, created_at, updated_at, location, is_active, miss_count')
      .order('id', { ascending: true })
      .limit(batchSize);

    if (lastId) {
      query = query.gt('id', lastId);
    }

    const { data: records, error } = await query;

    if (error) {
      console.error('❌ Fetch Error:', error.message);
      console.log('⏳ Waiting 5 seconds before retry...');
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }
    
    if (!records || records.length === 0) break;

    const migrationTargets = [];
    for (const r of records) {
      const expectedId = generateId(r.api_source, r.name, r.address);
      if (expectedId !== r.id) {
        migrationTargets.push({ record: r, newId: expectedId });
      }
    }

    if (migrationTargets.length > 0) {
      for (let i = 0; i < migrationTargets.length; i += parallelLimit) {
        const chunk = migrationTargets.slice(i, i + parallelLimit);
        
        await Promise.all(chunk.map(async (target) => {
          const r = target.record;
          const newId = target.newId;
          const oldId = r.id;
          
          // 위경도 데이터가 null이 되는 현상 방지 (SOP v11.8 vNext 준수)
          const newRecord = { 
            ...r, 
            id: newId, 
            updated_at: new Date().toISOString() 
          };
          
          const { error: insErr } = await supabase.from('master_places').upsert(newRecord);
          if (!insErr) {
            await supabase.from('master_places').delete().eq('id', oldId);
            totalMigrated++;
          } else {
            console.error(`  ❌ Failed: ${r.name} (${insErr.message})`);
          }
        }));
      }
    }

    totalProcessed += records.length;
    lastId = records[records.length - 1].id;
    console.log(`  ✅ Processed: ${totalProcessed} | Migrated: ${totalMigrated} | LastID: ${lastId}`);
    
    // DB 부하 방지를 위한 짧은 휴식
    await new Promise(r => setTimeout(r, 500));
    if (records.length < batchSize) break;
  }

  console.log(`\n✨ Global ID Migration Complete!`);
  console.log(`   - Total Processed: ${totalProcessed}`);
  console.log(`   - Total Migrated: ${totalMigrated}`);
}

migrate();

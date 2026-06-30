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

async function inspect() {
  console.log("=== Checking for Potential Duplicates & Place Count Growth ===");

  // 1. automation_logs에서 오늘/어제 실행된 동기화 작업이 있는지 조회
  console.log("\n1. Checking recent automation logs for data sync jobs...");
  const { data: logs, error: logsErr } = await supabase
    .from('automation_logs')
    .select('created_at, job_name, status, processed_count, message')
    .order('created_at', { ascending: false })
    .limit(10);

  if (logsErr) {
    console.error("Error fetching logs:", logsErr.message);
  } else {
    logs.forEach(l => {
      console.log(` - [${l.created_at}] Job: ${l.job_name} | Status: ${l.status} | Processed: ${l.processed_count} | Msg: ${l.message}`);
    });
  }

  // 2. 카테고리별 전체 로우 수 vs 활성 로우 수 비교 (is_active 상태 변화 체크)
  console.log("\n2. Checking is_active status distribution for SPOT...");
  const { count: totalSpots, error: err1 } = await supabase
    .from('master_places')
    .select('id', { count: 'exact', head: true })
    .eq('category', 'SPOT');

  const { count: activeSpots, error: err2 } = await supabase
    .from('master_places')
    .select('id', { count: 'exact', head: true })
    .eq('category', 'SPOT')
    .eq('is_active', true);

  console.log(` - Total SPOT: ${totalSpots} | Active SPOT: ${activeSpots} | Inactive SPOT: ${(totalSpots || 0) - (activeSpots || 0)}`);

  // 3. 중복 데이터(동일 이름 + 동일 주소)가 존재하는지 그룹바이 쿼리 실행
  // 타임아웃 방지를 위해, 메모리로 읽어와서 중복을 찾거나 limit을 걸어 쿼리
  console.log("\n3. Checking for logical duplicates (Same Name + Same Address)...");
  // master_places에서 name, address만 대량 조회하여 메모리 상에서 중복 체크
  let allPlaces = [];
  let lastId = '';
  const limit = 5000;
  let loopCount = 0;
  
  while (loopCount < 20) { // 타임아웃 방지를 위해 최대 10만 건만 스캔
    let query = supabase
      .from('master_places')
      .select('id, name, address, category')
      .order('id')
      .limit(limit);
      
    if (lastId) {
      query = query.gt('id', lastId);
    }
    const { data, error } = await query;
    if (error || !data || data.length === 0) break;
    
    allPlaces.push(...data);
    lastId = data[data.length - 1].id;
    loopCount++;
    if (data.length < limit) break;
  }

  console.log(` Scanned ${allPlaces.length} places for duplicates.`);
  
  const nameAddressMap = new Map();
  const duplicates = [];

  allPlaces.forEach(p => {
    // 공백 및 괄호 제거 후 유니크 키 생성
    const cleanName = p.name.replace(/\s+/g, '').replace(/\(.+?\)/g, '');
    const cleanAddr = (p.address || '').replace(/\s+/g, '');
    const key = `${cleanName}|||${cleanAddr}`;
    
    if (nameAddressMap.has(key)) {
      duplicates.push({
        key,
        original: nameAddressMap.get(key),
        duplicate: p
      });
    } else {
      nameAddressMap.set(key, p);
    }
  });

  console.log(` Found ${duplicates.length} logical duplicates in scanned data.`);
  if (duplicates.length > 0) {
    console.log("\n--- Sample Duplicates ---");
    duplicates.slice(0, 5).forEach((d, idx) => {
      console.log(`[Duplicate #${idx+1}] Key: ${d.key}`);
      console.log(`  - Original: ID: ${d.original.id} | Cat: ${d.original.category} | Name: ${d.original.name}`);
      console.log(`  - Duplicate: ID: ${d.duplicate.id} | Cat: ${d.duplicate.category} | Name: ${d.duplicate.name}`);
    });
  }
}

inspect();

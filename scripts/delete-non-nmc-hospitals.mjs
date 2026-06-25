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

const shouldExecute = process.argv.includes('--execute');

async function runCleanup() {
  console.log(`=== HOSPITAL Category Non-NMC Cleanup Script ===`);
  console.log(`Mode: ${shouldExecute ? '🔴 ACTUAL EXECUTION (DELETE)' : '🟢 DRY RUN (NO CHANGES)'}`);

  // 1. DB에서 병원 목록 전체 조회
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
      console.error("Error fetching data:", error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) break;

    allHospitals = allHospitals.concat(data);
    lastId = data[data.length - 1].id;
    if (data.length < limit) break;
  }

  // 2. Non-NMC 병원 필터링
  const nonNmc = allHospitals.filter(h => !h.raw_data?.hpid);
  
  const toDelete = [];
  const toKeep = [];

  nonNmc.forEach(h => {
    const name = h.name;
    
    // 삭제 대상 키워드 조건 정의
    const isClinic = name.includes('의원') || name.includes('클리닉') || name.includes('메디컬') || name.includes('조리원');
    const isDental = name.includes('치과');
    const isOriental = name.includes('한의원') || name.includes('한방');
    const isAnimal = name.includes('동물') || name.includes('가축') || name.includes('수의');
    const isDepartment = name.includes('안과') || name.includes('내과') || name.includes('피부과') || 
                         name.includes('소아과') || name.includes('이비인후과') || name.includes('외과') || 
                         name.includes('정형외과') || name.includes('신경과') || name.includes('비뇨기과');
    const isAnnex = name.includes('주차장') || name.includes('장례식장') || name.includes('이마트24') || 
                    name.includes('행정부서') || name.includes('종합검진센터') || name.includes('종합건강') ||
                    name.includes('구두');

    if (isClinic || isDental || isOriental || isAnimal || isDepartment || isAnnex) {
      toDelete.push(h);
    } else {
      // 대형 거점병원 등은 보존
      toKeep.push(h);
    }
  });

  console.log(`\nFound ${nonNmc.length} hospitals lacking HPID.`);
  console.log(`  -> Targets to DELETE: ${toDelete.length} items`);
  console.log(`  -> Targets to KEEP (Large/Public): ${toKeep.length} items`);

  console.log(`\n=== 🟢 Keep List (Total: ${toKeep.length}) ===`);
  toKeep.forEach((h, i) => {
    console.log(`[${i+1}] Keep - Name: "${h.name}" | Addr: "${h.address}"`);
  });

  console.log(`\n=== 🔴 Delete List (Top 20 Samples / Total: ${toDelete.length}) ===`);
  toDelete.slice(0, 20).forEach((h, i) => {
    console.log(`[${i+1}] Delete - Name: "${h.name}" | Addr: "${h.address}"`);
  });

  if (toDelete.length === 0) {
    console.log("\nNo hospitals to delete. Exiting.");
    process.exit(0);
  }

  if (shouldExecute) {
    console.log(`\n⏳ Executing Hard Delete of ${toDelete.length} places in Supabase...`);
    const idsToDelete = toDelete.map(h => h.id);
    
    // Supabase에서 대량 삭제 처리 (ID 매칭)
    // Supabase의 in 필터는 너무 길면 에러날 수 있으므로 100개씩 청크 분할하여 삭제 수행
    const chunkSize = 100;
    let deletedTotal = 0;
    
    for (let i = 0; i < idsToDelete.length; i += chunkSize) {
      const chunk = idsToDelete.slice(i, i + chunkSize);
      const { error: delErr, count } = await supabase
        .from('master_places')
        .delete()
        .in('id', chunk);

      if (delErr) {
        console.error(`❌ Delete failed for chunk starting at index ${i}: ${delErr.message}`);
        process.exit(1);
      }
      deletedTotal += chunk.length;
      console.log(`  Deleted chunk (${i} to ${Math.min(i + chunkSize, idsToDelete.length)}) successfully.`);
    }

    console.log(`\n🎉 Complete! Successfully deleted ${deletedTotal} non-NMC hospital/clinic/animal hospital entries from DB.`);
  } else {
    console.log(`\n💡 To execute this deletion, re-run this script with the '--execute' flag.`);
  }

  process.exit(0);
}

runCleanup();

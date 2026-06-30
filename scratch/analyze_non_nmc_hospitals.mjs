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

async function analyze() {
  console.log("Analyzing Non-NMC hospital data by keywords...");

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

  const nonNmc = allHospitals.filter(h => !h.raw_data?.hpid);
  
  // 키워드별 분류
  const categories = {
    animal: [],       // 동물병원, 가축
    clinic: [],       // 의원, 클리닉
    dental: [],       // 치과
    oriental: [],     // 한의원
    hospital_large: [], // ~병원, ~의료원
    etc: []           // 기타
  };

  nonNmc.forEach(h => {
    const name = h.name;
    if (name.includes('동물') || name.includes('가축') || name.includes('수의')) {
      categories.animal.push(h);
    } else if (name.includes('의원') || name.includes('클리닉') || name.includes('메디컬')) {
      categories.clinic.push(h);
    } else if (name.includes('치과')) {
      categories.dental.push(h);
    } else if (name.includes('한의원') || name.includes('한방')) {
      categories.oriental.push(h);
    } else if (name.includes('병원') || name.includes('의료원') || name.includes('보건')) {
      categories.hospital_large.push(h);
    } else {
      categories.etc.push(h);
    }
  });

  console.log(`\n=== Non-NMC Hospitals Classification (Total: ${nonNmc.length}) ===`);
  console.log(`1. 동물/가축병원: ${categories.animal.length}건`);
  console.log(`2. 일반 의원/클리닉: ${categories.clinic.length}건`);
  console.log(`3. 치과의원: ${categories.dental.length}건`);
  console.log(`4. 한의원/한방: ${categories.oriental.length}건`);
  console.log(`5. 대형병원/의료원 (hpid 매칭 누락 추정): ${categories.hospital_large.length}건`);
  console.log(`6. 기타: ${categories.etc.length}건`);

  console.log("\n=== 5. 대형병원/의료원 목록 (이름에 '병원'/'의료원'/'보건' 포함되나 hpid 없는 경우) ===");
  categories.hospital_large.forEach((h, i) => {
    console.log(`[${i+1}] Name: ${h.name} | Address: ${h.address}`);
  });

  console.log("\n=== 6. 기타 목록 (위 분류군에 안 속하는 항목) ===");
  categories.etc.forEach((h, i) => {
    console.log(`[${i+1}] Name: ${h.name} | Address: ${h.address}`);
  });
}

analyze();

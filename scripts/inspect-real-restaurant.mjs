import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("Searching restaurants with actual operating hours via safe 500-chunk pagination...");

  let offset = 0;
  const limit = 500; // 타임아웃을 피하기 위한 안전한 청크 크기
  const samples = [];
  let loopCount = 0;

  // 최대 10번(5,000건)까지 스캔하며 샘플 3개를 모으면 조기 종료
  while (offset < 5000 && samples.length < 3 && loopCount < 10) {
    console.log(`Scanning range ${offset} to ${offset + limit}...`);
    const { data, error } = await supabase
      .from('master_places')
      .select('id, name, category, address, raw_data, description, updated_at')
      .eq('is_active', true)
      .order('updated_at', { ascending: false }) // 최신순 정렬하여 오늘 수집된 성공 데이터 획득
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Query failed:", error.message);
      break;
    }

    if (!data || data.length === 0) {
      console.log("No more data found.");
      break;
    }

    const matched = data.filter(p => 
      p.category === 'RESTAURANT' &&
      p.raw_data?.enriched === true && 
      p.raw_data?.operating_hours && 
      p.raw_data.operating_hours !== '정보 없음 (방문 전 확인 권장)'
    );

    if (matched.length > 0) {
      samples.push(...matched);
      console.log(`Found ${matched.length} candidates in this batch!`);
    }

    offset += limit;
    loopCount++;
  }

  console.log(`\nScan complete. Found ${samples.length} matches.`);
  console.log(JSON.stringify(samples.slice(0, 3), null, 2));
  process.exit(0);
}

run();

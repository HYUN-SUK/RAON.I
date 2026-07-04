import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkRPC() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. 대구수목원의 좌표 부근 (lat: 35.823, lng: 128.557) 에서 RPC 가동
  const { data, error } = await supabase.rpc('get_master_places_in_radius_v2', {
    target_lat: 35.823,
    target_lng: 128.557,
    radius_meters: 10000,
    limit_count: 5,
    p_category: 'RESTAURANT'
  });

  if (error) {
    console.error("RPC 실행 에러:", error.message);
    return;
  }

  console.log("=== get_master_places_in_radius_v2 RPC 반환 결과 스캔 ===");
  if (data && data.length > 0) {
    console.log("반환된 첫 번째 row의 모든 키:", Object.keys(data[0]));
    data.forEach((row, i) => {
      console.log(`\n[${i+1}] 매장: ${row.name}`);
      console.log(`  - description: "${row.description}"`);
      console.log(`  - raw_data:`, row.raw_data);
      console.log(`  - api_source: "${row.api_source || ''}"`);
    });
  } else {
    console.log("반환된 데이터가 없습니다.");
  }
}

checkRPC();

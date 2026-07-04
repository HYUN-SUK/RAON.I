import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkGemini() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`=== master_places 테이블 내 대구 달서구 식당 전수 런타임 분석 (최대 5,000건) ===`);

  const { data: places, error } = await supabase
    .from('master_places')
    .select('id, name, description, raw_data')
    .eq('category', 'RESTAURANT')
    .like('address', '대구광역시 달서구%')
    .limit(500);

  if (error) {
    console.error("데이터 조회 에러:", error.message);
    return;
  }

  console.log(`- 대구 달서구 전체 식당 수: ${places?.length || 0} 건`);

  if (places && places.length > 0) {
    const stats = {};
    const geminiList = [];
    const fallbackList = [];
    const emptyList = [];

    places.forEach(p => {
      const apiSource = p.raw_data?.description_api_source || '';
      stats[apiSource] = (stats[apiSource] || 0) + 1;

      if (apiSource === 'gemini-2.5-flash') {
        geminiList.push(p);
      } else if (apiSource === 'LOCAL_FALLBACK') {
        fallbackList.push(p);
      } else {
        emptyList.push(p);
      }
    });

    console.log("\n[description_api_source 통계 수치]");
    console.log(stats);

    console.log(`\n- 제미나이 요약본 적재 식당 수: ${geminiList.length} 건`);
    console.log(`- 로컬 폴백 적재 식당 수: ${fallbackList.length} 건`);
    console.log(`- 출처 미지정 식당 수: ${emptyList.length} 건`);

    if (geminiList.length > 0) {
      console.log(`\n[달서구 제미나이 요약 식당 샘플 10건]`);
      geminiList.slice(0, 10).forEach((p, idx) => {
        console.log(`  (${idx+1}) ${p.name} | 1줄설명: "${p.description}"`);
      });
    }
  } else {
    console.log("대구 달서구 지역 식당 데이터를 찾을 수 없습니다.");
  }
}

checkGemini();

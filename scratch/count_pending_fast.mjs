import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== ⚡ 메모리 스캔 기반 초고속 마트(MART) 세부 통계 카운트 시작 ===");
  let lastId = '';
  let totalActive = 0;
  let pendingCount = 0;
  let newGeminiCount = 0;
  let oldGeminiCount = 0;
  let fallbackCount = 0;

  while (true) {
    let query = supabase
      .from('master_places')
      .select('id, category, is_active, description, raw_data')
      .order('id')
      .limit(4000);

    if (lastId) {
      query = query.gt('id', lastId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Fetch error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    // 메모리 필터링으로 DB 타임아웃 병목 원천 차단 및 세부 통계 산출
    for (const p of data) {
      if (p.category === 'MART' && p.is_active === true) {
        totalActive++;
        if (p.description === null || p.description === '') {
          pendingCount++;
        } else {
          const apiSource = p.raw_data?.description_api_source || '';
          if (apiSource === 'LOCAL_FALLBACK') {
            fallbackCount++;
          } else if (apiSource === 'gemini-2.5-flash') {
            newGeminiCount++;
          } else {
            oldGeminiCount++;
          }
        }
      }
    }

    lastId = data[data.length - 1].id;
  }

  console.log(`\n==================================================`);
  console.log(`📊 [마트 카테고리 세부 적재 현황 (신/구 버정 구분)]`);
  console.log(`- 전체 활성 마트 수: ${totalActive} 건`);
  console.log(`- [최신 적용] Gemini 2.5 Flash 완수 건수: ${newGeminiCount} 건`);
  console.log(`- [구형 방치] 구형 요약 상태 유지 건수 (재적재 필요): ${oldGeminiCount} 건`);
  console.log(`- [로컬 우회] 0원 로컬 Fallback 완료 건수: ${fallbackCount} 건`);
  console.log(`- 미적재 펜딩 건수: ${pendingCount} 건`);
  console.log(`- 최신화 이행률: ${((newGeminiCount + fallbackCount) / totalActive * 100).toFixed(2)} %`);
  console.log(`==================================================\n`);
}

main();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 이름 정규화 함수 (프로젝트 기준)
function normalizeName(str) {
  if (!str) return '';
  return str.replace(/<\/?[^>]+(>|$)/g, "")
            .replace(/\([^)]+\)/g, '')
            .replace(/[\s\-_,\/\\·'"]/g, '')
            .toLowerCase();
}

async function main() {
  console.log("🔍 master_places 테이블 내의 중복 데이터 감지 중...");

  // Supabase rpc 또는 쿼리로 이름과 주소가 유사한 중복 그룹을 식별
  // 데이터가 많으므로, 최근 30일 이내에 업데이트된 활성 데이터 중 중복이 많은 상위 그룹을 스캔
  // 또는 간단히 전체 row 수가 많으니, count 쿼리와 Group By를 활용하기 위해
  // database function을 만들거나 직접 count-query를 흉내냅니다.
  // 여기서는 javascript 메모리 내에서 확인하기 위해, 
  // '전남광주시' 및 세종/울산 등 최근 갱신된 지역 데이터를 샘플로 가져와서 중복 스캔을 수행합니다.
  
  const targetRegions = ['전남광주시', '세종특별자치시', '울산광역시', '광주광역시', '전라남도'];
  
  const { data: places, error } = await supabase
    .from('master_places')
    .select('id, name, address, category, api_source, is_active, sido')
    .in('sido', targetRegions)
    .eq('is_active', true);

  if (error) {
    console.error("Error fetching places:", error);
    return;
  }

  console.log(`총 ${places.length}건의 데이터를 메모리에 로드하여 정밀 중복 분석 수행...`);

  const seen = new Map(); // normalizedKey -> placeList
  const duplicates = [];

  places.forEach(p => {
    const cleanName = normalizeName(p.name);
    // 주소의 구/군 단위까지 잘라내어 매칭 (예: "광주 북구 임동" -> "광주 북구")
    const addrParts = (p.address || '').split(' ');
    const cleanAddr = addrParts.slice(0, 3).join('').replace(/[\s\-_,\/\\·'"]/g, '');
    const key = `${p.category}|${cleanName}|${cleanAddr}`;

    if (seen.has(key)) {
      seen.get(key).push(p);
    } else {
      seen.set(key, [p]);
    }
  });

  for (const [key, group] of seen.entries()) {
    if (group.length > 1) {
      duplicates.push({ key, group });
    }
  }

  console.log(`\n📊 중복 위험 장소 그룹 수: ${duplicates.length}개 발견`);
  if (duplicates.length > 0) {
    console.log("--- 상위 10개 중복 그룹 샘플 ---");
    duplicates.slice(0, 10).forEach((dup, idx) => {
      console.log(`[Group #${idx + 1}] Key: ${dup.key}`);
      dup.group.forEach(p => {
        console.log(`  - ID: ${p.id} | Name: ${p.name} | Addr: ${p.address} | Source: ${p.api_source} | Sido: ${p.sido}`);
      });
      console.log('------------------------------------');
    });
  } else {
    console.log("✅ 축약어 통합 및 정규화 가드 덕분에 중복 데이터가 발생하지 않았습니다!");
  }
}

main();

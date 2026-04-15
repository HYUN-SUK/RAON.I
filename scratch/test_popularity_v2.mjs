// 인기도 v2 엔진 단독 테스트 (대구광역시 대상)
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { getAdminCodes } from '../scripts/utils/admin-code-mapping.mjs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const API_KEY = process.env.PUBLIC_DATA_API_KEY;

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function fetchWithRetry(url, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (text.trim().startsWith('<') || text.includes('Unexpected')) {
        if (i === maxRetries) return null;
        await delay(2000);
        continue;
      }
      return JSON.parse(text);
    } catch (e) {
      if (i === maxRetries) return null;
      await delay(2000);
    }
  }
  return null;
}

// baseYm 자동 탐색
async function findBaseYm() {
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0');
    const url = `http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?serviceKey=${API_KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=RAONAI&_type=json&baseYm=${ym}&areaCd=11&signguCd=11110`;
    const data = await fetchWithRetry(url, 1);
    if (data?.response?.body?.totalCount > 0) {
      console.log(`  ✅ baseYm: ${ym}`);
      return ym;
    }
  }
  return '202504';
}

async function main() {
  console.log('=== 인기도 v2 엔진 단독 테스트 (대구광역시) ===\n');
  
  const targetSido = '대구광역시';
  const aliases = ['대구광역시', '대구'];
  
  // 1. 대구 TOUR_SPOT 조회
  console.log('━'.repeat(60));
  console.log('📋 [1] 대구 TOUR_SPOT 조회');
  console.log('━'.repeat(60));
  
  const { data: spots, error } = await supabase
    .from('master_places')
    .select('id, name, sigungu, sido, address, lat, lng, is_active, trust_score, raw_data, api_source, category')
    .eq('api_source', 'TOUR_SPOT')
    .eq('is_active', true)
    .in('sido', aliases);
    
  if (error) { console.error('DB 오류:', error.message); return; }
  console.log(`  총 SPOT: ${spots.length}건\n`);

  // 2. 시군구별 그룹화 + 행정코드 매핑 검증
  console.log('━'.repeat(60));
  console.log('📋 [2] 시군구별 그룹화 + 행정코드 매핑');
  console.log('━'.repeat(60));
  
  const sigungus = [...new Set(spots.map(s => s.sigungu))].filter(Boolean);
  console.log(`  시군구 ${sigungus.length}개: ${sigungus.join(', ')}\n`);

  const baseYm = await findBaseYm();
  const { areaCd } = getAdminCodes(targetSido);

  let totalTmap = 0;
  let totalKt = 0;
  let totalMatched = 0;

  for (const sigungu of sigungus) {
    const { signguCd } = getAdminCodes(targetSido, sigungu);
    const spotsInSigungu = spots.filter(s => s.sigungu === sigungu);

    if (!signguCd) {
      console.log(`  ❌ ${sigungu} (${spotsInSigungu.length}건) → signguCd 없음, SKIP`);
      continue;
    }

    console.log(`  🔍 ${sigungu} (${spotsInSigungu.length}건) → areaCd=${areaCd}, signguCd=${signguCd}`);

    // Tmap API 호출
    const tmapUrl = `http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?serviceKey=${API_KEY}&areaCd=${areaCd}&signguCd=${signguCd}&baseYm=${baseYm}&numOfRows=1000&_type=json&MobileOS=ETC&MobileApp=RAONAI`;
    const tmapData = await fetchWithRetry(tmapUrl);
    const tmapItems = tmapData?.response?.body?.items?.item;
    const tmapList = Array.isArray(tmapItems) ? tmapItems : (tmapItems ? [tmapItems] : []);
    
    // KT API 호출
    const ktUrl = `http://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList?serviceKey=${API_KEY}&areaCd=${areaCd}&signguCd=${signguCd}&numOfRows=1000&_type=json&MobileOS=ETC&MobileApp=RAONAI`;
    const ktData = await fetchWithRetry(ktUrl);
    const ktItems = ktData?.response?.body?.items?.item;
    const ktList = Array.isArray(ktItems) ? ktItems : (ktItems ? [ktItems] : []);

    totalTmap += tmapList.length;
    totalKt += ktList.length;

    console.log(`     → Tmap: ${tmapList.length}건, KT: ${ktList.length}건`);

    // 매칭 시도 (상위 3건만 출력)
    let matched = 0;
    const getClean = (s) => s ? String(s).replace(/\(.+?\)/g, '').replace(/\s+/g, '').toLowerCase() : '';
    
    for (const spot of spotsInSigungu) {
      const cleanName = getClean(spot.name);
      const tmapMatch = tmapList.filter(t => getClean(t.tAtsNm) === cleanName);
      const ktMatch = ktList.find(k => getClean(k.tAtsNm) === cleanName);
      if (tmapMatch.length > 0 || ktMatch) {
        matched++;
        if (matched <= 2) {
          console.log(`     ✅ 매칭: "${spot.name}" ← Tmap=${tmapMatch.length}건, KT=${ktMatch ? '있음' : '없음'}`);
        }
      }
    }
    totalMatched += matched;
    if (matched > 2) console.log(`     ... 외 ${matched - 2}건 매칭됨`);
    if (matched === 0) console.log(`     ⚠️ 매칭 0건 (이름 불일치 가능)`);

    await delay(500); // API 쓰로틀링
  }

  // 3. 종합 결과
  console.log('\n' + '━'.repeat(60));
  console.log('📊 [종합 결과]');
  console.log('━'.repeat(60));
  console.log(`  대구 TOUR_SPOT: ${spots.length}건`);
  console.log(`  처리된 시군구: ${sigungus.length}개`);
  console.log(`  Tmap 수신 총계: ${totalTmap}건`);
  console.log(`  KT 수신 총계: ${totalKt}건`);
  console.log(`  DB 매칭 성공: ${totalMatched}건`);
  console.log(`\n  판정: ${totalTmap > 0 || totalKt > 0 ? '✅ 인기도 v2 엔진 정상 작동!' : '❌ API 데이터 수신 실패'}`);
}

main().catch(console.error);

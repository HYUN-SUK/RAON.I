import { getAdminCodes } from '../scripts/utils/admin-code-mapping.mjs';

// daily-region-sync.mjs의 getNormalizedAddr 함수 로컬 복제하여 테스트 수행
function getNormalizedAddr(addr) {
  if (!addr) return '';
  let a = addr.replace(/,\s?대한민국$/, '').trim();

  // 1. 경기도 광주시 방어 필터
  const isGyeonggiGwangju = 
    /^(경기|경기도)\s/.test(a) || 
    (/^(광주|광주시)\s/.test(a) && /(오포읍|초월읍|곤지암읍|도척면|퇴촌면|남종면|남한산성면)/.test(a));

  if (isGyeonggiGwangju) {
    a = a.replace(/^(경기|경기도|광주|광주시)\s(광주시\s)?/, '경기도 광주시 ');
    return a.trim();
  }

  // 2. 전남광주시(구 광주광역시 자치구) -> UUID 보존을 위해 '광주광역시'로 가상 정규화
  const isGwangjuMetro = /(동구|서구|남구|북구|광산구)/.test(a);
  if (isGwangjuMetro && /^(전남광주시|전남광주|광주전남|광주광역시|광주시|광주)\s/.test(a)) {
    a = a.replace(/^(전남광주시|전남광주|광주전남|광주광역시|광주시|광주)\s?/, '광주광역시 ');
    return a.trim();
  }

  // 3. 전남광주시(구 전남 시군) -> UUID 보존을 위해 '전라남도'로 가상 정규화
  const isJeonnamLocal = /(목포시|여수시|순천시|나주시|광양시|담양군|곡성군|구례군|고흥군|보성군|화순군|장흥군|강진군|해남군|영암군|무안군|함评군|영광군|장성군|완도군|진도군|신안군)/.test(a);
  if (isJeonnamLocal && /^(전남광주시|전남광주|광주전남|전라남도|전남|전남도)\s/.test(a)) {
    a = a.replace(/^(전남광주시|전남광주|광주전남|전라남도|전남|전남도)\s?/, '전라남도 ');
    return a.trim();
  }

  a = a.replace(/^(서울|서울특별시)\s?/, '서울특별시 ');
  a = a.replace(/^(부산|부산광역시)\s?/, '부산광역시 ');
  a = a.replace(/^(대구|대구광역시)\s?/, '대구광역시 ');
  a = a.replace(/^(인천|인천광역시)\s?/, '인천광역시 ');
  a = a.replace(/^(광주|광주광역시)\s?/, '광주광역시 ');
  a = a.replace(/^(대전|대전광역시)\s?/, '대전광역시 ');
  a = a.replace(/^(울산|울산광역시)\s?/, '울산광역시 ');
  a = a.replace(/^(세종|세종특별자치시)\s?/, '세종특별자치시 ');
  a = a.replace(/^(경기|경기도)\s?/, '경기도 ');
  a = a.replace(/^(강원|강원도|강원특별자치도)\s?/, '강원특별자치도 ');
  a = a.replace(/^(충북|충청북도)\s?/, '충청북도 ');
  a = a.replace(/^(충남|충청남도)\s?/, '충청남도 ');
  a = a.replace(/^(전북|전라북도|전북특별자치도)\s?/, '전북특별자치도 ');
  a = a.replace(/^(전남|전라남도)\s?/, '전라남도 ');
  a = a.replace(/^(경북|경상북도)\s?/, '경상북도 ');
  a = a.replace(/^(경남|경상남도)\s?/, '경상남도 ');
  a = a.replace(/^(제주|제주도|제주특별자치도)\s?/, '제주특별자치도 ');
  return a.trim();
}

// 테스트 데이터셋 정의
const addressTests = [
  { input: "광주시 곤지암읍 평열리", expected: "경기도 광주시 곤지암읍 평열리" },
  { input: "경기 광주시 송정동", expected: "경기도 광주시 송정동" },
  { input: "전남광주시 북구 임동", expected: "광주광역시 북구 임동" },
  { input: "광주 북구 용봉동", expected: "광주광역시 북구 용봉동" },
  { input: "전남광주시 목포시 용당동", expected: "전라남도 목포시 용당동" },
  { input: "전남 목포시 용당동", expected: "전라남도 목포시 용당동" }
];

console.log("=== 1. 주소 가상 정규화 (getNormalizedAddr) 테스트 ===");
let allPassed = true;
for (const test of addressTests) {
  const result = getNormalizedAddr(test.input);
  const passed = result === test.expected;
  console.log(`[${passed ? 'PASS' : 'FAIL'}] Input: "${test.input}"\n       Result:   "${result}"\n       Expected: "${test.expected}"`);
  if (!passed) allPassed = false;
}

const adminCodeTests = [
  { sido: "전남광주시", sigungu: "북구", expectedArea: "29", expectedSigungu: "29170" }, // 광주 북구
  { sido: "전남광주시", sigungu: "목포시", expectedArea: "46", expectedSigungu: "46110" }, // 전남 목포
  { sido: "전남광주", sigungu: "광산구", expectedArea: "29", expectedSigungu: "29200" } // 광주 광산구
];

console.log("\n=== 2. 행정구역 코드 매핑 (getAdminCodes) 테스트 ===");
for (const test of adminCodeTests) {
  const { areaCd, signguCd } = getAdminCodes(test.sido, test.sigungu);
  const passed = areaCd === test.expectedArea && signguCd === test.expectedSigungu;
  console.log(`[${passed ? 'PASS' : 'FAIL'}] Sido: "${test.sido}", Sigungu: "${test.sigungu}"\n       Result:   areaCd="${areaCd}", signguCd="${signguCd}"\n       Expected: areaCd="${test.expectedArea}", signguCd="${test.expectedSigungu}"`);
  if (!passed) allPassed = false;
}

if (allPassed) {
  console.log("\n✨ [SUCCESS] 모든 주소 정규화 및 행정코드 매핑 단위 테스트 통과!");
} else {
  console.error("\n❌ [FAILURE] 일부 단위 테스트 실패. 코드를 점검하십시오.");
  process.exit(1);
}

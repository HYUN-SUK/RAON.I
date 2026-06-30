import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 한글/영문 대략적인 토큰 수 산정 헬퍼 (Gemini tokenizer 기준 한글 1자 평균 1.8토큰 내외)
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length * 1.8);
}

async function main() {
  console.log("=== 🔍 마트 데이터 실제 1건당 프롬프트 및 예상 토큰/비용 정밀 분석 ===");

  // 1. 상세정보 완비 마트 1건 조회
  const { data: place, error } = await supabase
    .from('master_places')
    .select('id, name, category, address, raw_data')
    .eq('category', 'MART')
    .eq('raw_data->enriched', true)
    .limit(1);

  if (error || !place || place.length === 0) {
    console.error("분석용 샘플 획득 실패");
    return;
  }

  const sample = place[0];
  const raw = sample.raw_data || {};
  const details = {
    operating_hours: raw.operating_hours || '',
    closed_days: raw.closed_days || '',
    parking_available: raw.parking_available || ''
  };

  // 2. 실제 전송된 프롬프트 조립
  const prompt = `당신은 캠핑/여행 전문 AI 카피라이터입니다. 다음 마트의 실제 메타데이터를 기반으로, 캠퍼들이 생필품이나 장을 볼 때 유용한 한 줄 설명(Description)을 사실에만 기반하여 작성해 주세요.
- 이름: ${sample.name}
- 영업시간: ${details.operating_hours || '정보 없음'}
- 휴무일: ${details.closed_days || '정보 없음'}
- 주차: ${details.parking_available || '정보 없음'}
[제약사항] 마트 정보와 주차 정보를 담아 딱 한 문장(30~45자 내외)으로 사실에만 기반하여 작성하세요. 추측성 묘사는 배제합니다.`;

  // 3. 실제 생성된 최신 1줄설명 예시 (어제 맥스토어양산점 성공결과 대입)
  const result = "24시간 운영, 무료 주차 가능하며, 매월 둘째·넷째 일요일 휴무.";

  const inputTokens = estimateTokens(prompt);
  const outputTokens = estimateTokens(result);
  const totalTokens = inputTokens + outputTokens;

  // 4. 공식 단가 대입 (gemini-2.5-flash)
  // Input: $0.075 / 1M tokens ($0.000075 / 1K tokens)
  // Output: $0.30 / 1M tokens ($0.00030 / 1K tokens)
  const inputCostUSD = (inputTokens / 1000) * 0.000075;
  const outputCostUSD = (outputTokens / 1000) * 0.00030;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  // 환율 1,380원 및 부가세 10% 기준 원화 환산
  const exchangeRate = 1380;
  const vat = 1.1;
  const totalCostKRW = totalCostUSD * exchangeRate * vat;

  console.log(`\n==================================================`);
  console.log(`📌 [마트 1건당 실측 데이터 및 요금 명세서]`);
  console.log(`- 대상 매장명: ${sample.name}`);
  console.log(`- 조립된 프롬프트 실제 글자 수: ${prompt.length} 자`);
  console.log(`- 결과물 요약문 실제 글자 수: ${result.length} 자`);
  console.log(`--------------------------------------------------`);
  console.log(`- 예상 입력 토큰 (Input Tokens): ${inputTokens} 토큰`);
  console.log(`- 예상 출력 토큰 (Output Tokens): ${outputTokens} 토큰`);
  console.log(`- 총 사용 토큰: ${totalTokens} 토큰`);
  console.log(`--------------------------------------------------`);
  console.log(`- 입력 요금: $${inputCostUSD.toFixed(8)} (${(inputCostUSD * exchangeRate * vat).toFixed(4)} 원)`);
  console.log(`- 출력 요금: $${outputCostUSD.toFixed(8)} (${(outputCostUSD * exchangeRate * vat).toFixed(4)} 원)`);
  console.log(`- 1건당 최종 요금 (원화/부가세포함): ${totalCostKRW.toFixed(4)} 원`);
  console.log(`==================================================\n`);
}

main();

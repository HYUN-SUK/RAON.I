import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-2.5-flash';
const COUNT_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:countTokens?key=${GEMINI_API_KEY}`;

async function main() {
  console.log("=== 🔍 구글 API가 직접 인지하는 실제 토큰수(countTokens) 실사 시작 ===");

  const prompt = `당신은 캠핑/여행 전문 AI 카피라이터입니다. 다음 마트의 실제 메타데이터를 기반으로, 캠퍼들이 생필품이나 장을 볼 때 유용한 한 줄 설명(Description)을 사실에만 기반하여 작성해 주세요.
- 이름: 노브랜드 여주한글시장점
- 영업시간: 09:00 - 22:00 (점포별 상이)
- 휴무일: 매월 둘째/넷째 일요일 (지자체별 상이)
- 주차: 무료 주차
[제약사항] 마트 정보와 주차 정보를 담아 딱 한 문장(30~45자 내외)으로 사실에만 기반하여 작성하세요. 추측성 묘사는 배제합니다.`;

  const response = await fetch(COUNT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) {
    console.error("Token count API failed:", response.statusText);
    return;
  }

  const data = await response.json();
  console.log(`구글 API 인지 토큰 수: ${data.totalTokens} 토큰`);

  // 단가 역산 (Input $0.075 / 1M)
  const inputCostUSD = (data.totalTokens / 1000000) * 0.075;
  const exchangeRate = 1380;
  const vat = 1.1;
  const costKRW = inputCostUSD * exchangeRate * vat;

  console.log(`예상 1건당 입력 비용: ${costKRW.toFixed(6)} 원`);
}

main();

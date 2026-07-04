import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-2.5-flash';
const COUNT_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:countTokens?key=${GEMINI_API_KEY}`;

async function main() {
  console.log("=== 🔍 스마트플랜 1회 가동 시 실제 프롬프트/출력 예상 토큰 분석 ===");

  // 스마트플랜 조립 프롬프트 예시 (details + 주변장소 리스트 포함 대략 2,500자)
  const prompt = `당신은 캠핑/여행 코스 추천 전문 AI 플래너입니다. 아래의 조건과 장소 메타데이터를 기반으로 최적의 1박 2일 캠핑 플랜을 작성해 주세요.
  - 여행지: 경기도 가평
  - 일정: 1박 2일
  - 동반자: 가족
  - 추천 주변 마트:
    * 조은마트 (가평읍 장터길 7) - 영업시간 08:00 - 22:00, 주차 가능
    * 하나로마트 가평군농협본점 - 영업시간 09:00 - 21:00, 주차 무료
  - 추천 주변 식당:
    * 가평잣두부집 - 대표메뉴 잣두부전골, 주차 가능
    * 동기간 - 대표메뉴 토종닭백숙, 반려동물 동반 가능
  - 추천 명소:
    * 자라섬캠핑장 - 잔디광장, 자전거 대여, 주차 무료
    * 아침고요수목원 - 수목 정원, 야생화 전시
  위 장소들의 이동 동선과 영업시간을 고려해 1일차 점심부터 2일차 점심까지 시간대별 상세 일정을 캠핑 꿀팁과 함께 매력적으로 작성하세요.`;

  // 스마트플랜 출력물 예시 (상세 코스 기술로 인해 대략 한글 1,200자 소모)
  const responseText = `[가평 감성 캠핑 1박 2일 추천 코스]

1일차: 캠핑의 설렘과 아늑한 잣두부 점심
- 12:00 ~ 13:00 : 가평잣두부집 도착 및 점심 식사
  * 잣의 고장 가평에서 고소하고 뜨끈한 '잣두부전골'로 든든하게 배를 채우며 여행을 시작합니다. 가게 앞 무료 주차 공간이 완비되어 있어 차량 이동이 편리합니다.
- 13:10 ~ 14:00 : 하나로마트 가평군농협본점 장보기
  * 자라섬 캠핑장으로 들어가기 전, 바비큐 고기와 생필품을 구매합니다. 가평군 내에서 가장 신선한 식재료를 취급하며, 넓은 무료 주차장 덕분에 짐을 싣기 용이합니다.
- 14:30 ~ 17:00 : 자라섬캠핑장 입실 및 텐트 피칭, 휴식
  * 가평의 대표적인 힐링 캠핑장인 자라섬캠핑장에 입실합니다. 넓은 잔디광장과 북한강 강바람을 맞으며 텐트를 치고, 매점에서 시원한 음료를 마시며 여유를 즐깁니다. 자전거 대여소에서 자전거를 빌려 섬 한 바퀴를 둘러보는 것도 좋은 방법입니다.
- 18:00 ~ 21:00 : 캠핑의 꽃, 숯불 바비큐 파티
  * 하나로마트에서 장 봐온 맛있는 고기와 야채를 구우며 즐거운 저녁 시간을 보냅니다. 자라섬의 밤하늘은 별이 아름다우니 불멍과 함께 감성을 충전하세요.

2일차: 수목원의 푸른 싱그러움과 백숙 마무리
- 09:00 ~ 10:30 : 아침 식사 및 텐트 철수 (아웃팅 준비)
  * 가벼운 아침 식사 후 머문 자리를 깨끗이 정리하고 퇴실합니다.
- 11:30 ~ 13:00 : 아침고요수목원 관람
  * 울창한 잣나무 숲 아래 조성된 아름다운 정원과 야생화를 감상하며 피톤치드를 가득 마십니다. 넓은 무료 주차장이 준비되어 있어 퇴실 후 들르기 최적의 장소입니다.
- 13:30 ~ 15:00 : 동기간에서 든든한 잣나무 숲 닭백숙 점심
  * 수목원 관람 후, 가평의 유명 맛집 '동기간'으로 이동해 깊고 진한 토종닭백숙으로 여행의 피로를 풀어줍니다. 반려동물 동반이 가능하여 가족 모두가 편안하게 개별 룸에서 오붓한 식사를 즐길 수 있어 추천합니다.`;

  const inputRes = await fetch(COUNT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  const outputRes = await fetch(COUNT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: responseText }] }] })
  });

  if (!inputRes.ok || !outputRes.ok) {
    console.error("Token count API failed");
    return;
  }

  const inputData = await inputRes.json();
  const outputData = await outputRes.json();

  const inputTokens = inputData.totalTokens;
  const outputTokens = outputData.totalTokens;
  const totalTokens = inputTokens + outputTokens;

  // 2026 인상 단가: Input $0.30/1M, Output $2.50/1M
  const inputCostUSD = (inputTokens / 1000000) * 0.30;
  const outputCostUSD = (outputTokens / 1000000) * 2.50;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  const exchangeRate = 1380;
  const vat = 1.1;
  const totalCostKRW = totalCostUSD * exchangeRate * vat;

  console.log(`\n==================================================`);
  console.log(`📌 [스마트플랜 1회 가동 예상 요금 명세서]`);
  console.log(`- 프롬프트 글자 수: ${prompt.length} 자 (입력 토큰: ${inputTokens} tokens)`);
  console.log(`- 결과물 요약문 글자 수: ${responseText.length} 자 (출력 토큰: ${outputTokens} tokens)`);
  console.log(`--------------------------------------------------`);
  console.log(`- 입력 실제 과금: ${ (inputCostUSD * exchangeRate * vat).toFixed(2) } 원`);
  console.log(`- 출력 실제 과금: ${ (outputCostUSD * exchangeRate * vat).toFixed(2) } 원`);
  console.log(`- 스마트플랜 1회 최종 순수 API 청구 비용: ${totalCostKRW.toFixed(2)} 원`);
  console.log(`==================================================\n`);
}

main();

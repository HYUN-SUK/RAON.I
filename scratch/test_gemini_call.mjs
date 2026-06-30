import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MODEL_NAME = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

// 카테고리별 제미나이 프롬프트 생성 헬퍼
function buildPrompt(category, name, details) {
  if (category === 'RESTAURANT' || category === 'ROUTE_CAFE') {
    return `당신은 캠핑/여행 전문 AI 카피라이터입니다. 다음 식당/카페의 실제 메타데이터를 기반으로, 여행자들에게 유용하고 매력적인 한 줄 설명(Description)을 사실에만 기반하여 작성해 주세요.
- 이름: ${name}
- 영업시간: ${details.operating_hours || '정보 없음'}
- 휴무일: ${details.closed_days || '정보 없음'}
- 대표메뉴: ${Array.isArray(details.representative_menu) ? details.representative_menu.join(', ') : (details.representative_menu || '정보 없음')}
- 주차: ${details.parking_available || '정보 없음'}
- 반려동물 동반: ${details.pet_friendly || details.pet_allowed || '정보 없음'}
[제약사항] 딱 한 문장(30~45자 내외)으로 사실에만 기반하여 작성하세요. 추측성 과장 표현(맛집, 최고의 등)은 절대 금지합니다.`;
  }

  if (category === 'MART') {
    return `당신은 캠핑/여행 전문 AI 카피라이터입니다. 다음 마트의 실제 메타데이터를 기반으로, 캠퍼들이 생필품이나 장을 볼 때 유용한 한 줄 설명(Description)을 사실에만 기반하여 작성해 주세요.
- 이름: ${name}
- 영업시간: ${details.operating_hours || '정보 없음'}
- 휴무일: ${details.closed_days || '정보 없음'}
- 주차: ${details.parking_available || '정보 없음'}
[제약사항] 마트 정보와 주차 정보를 담아 딱 한 문장(30~45자 내외)으로 사실에만 기반하여 작성하세요. 추측성 묘사는 배제합니다.`;
  }

  // 공공 카테고리 (SPOT, HOSPITAL, FESTIVAL)
  return `당신은 여행 전문 AI 카피라이터입니다. 다음 장소의 실제 상세 메타데이터를 기반으로 사실에 입각한 한 줄 설명(Description)을 작성해 주세요.
- 이름: ${name}
- 상세정보: ${JSON.stringify(details)}
[제약사항] 위 상세 내용에 나온 고유 정보(요금, 개요 등)를 요약하여 딱 한 문장(30~45자 내외)으로 사실에만 기반하여 작성하세요.`;
}

// 제미나이 API 호출 헬퍼
async function requestGemini(prompt) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });
  
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Gemini API Error (HTTP ${res.status}): ${errData.error?.message || res.statusText}`);
  }
  
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

// 0원 로컬 Fallback 처리 헬퍼 (연락처 정보 포함 고도화)
function makeLocalFallbackDescription(name, category, address, rawData) {
  const categoryNameKo = {
    RESTAURANT: '식당',
    ROUTE_CAFE: '카페',
    MART: '마트',
    SPOT: '관광명소',
    HOSPITAL: '병원/의료시설',
    FESTIVAL: '축제/행사'
  }[category] || category || '장소';

  const cleanAddr = address ? address.split(' ').slice(0, 3).join(' ') : '해당 지역';
  // raw_data 내의 연락처(전화번호) 키들을 탐색합니다.
  const tel = rawData?.['전화번호'] || rawData?.['RELAX_RSTRNT_TEL'] || rawData?.['tel'] || '';
  const telSuffix = tel ? ` (연락처: ${tel})` : '';

  return `${name}은(는) ${cleanAddr} 인근에 위치한 ${categoryNameKo} 관련 장소입니다. 구체적인 운영 및 이용 정보는 방문 전 확인을 권장합니다.${telSuffix}`;
}

// 실효 데이터 검사 함수
function hasValidDetails(rawData) {
  if (rawData.enriched !== true) return false;
  
  // 메뉴, 영업시간, 주차 중 최소 1개 이상이 유효하게 채워져 있는지 검증
  const hasMenu = Array.isArray(rawData.representative_menu) && rawData.representative_menu.length > 0;
  const hasHours = !!rawData.operating_hours && !rawData.operating_hours.includes('정보 없음') && !rawData.operating_hours.includes('지번 :');
  const hasParking = !!rawData.parking_available && !rawData.parking_available.includes('확인 불가');

  return hasMenu || hasHours || hasParking;
}

async function main() {
  console.log("=== 🚀 [명소 카테고리] Gemini 1줄설명 단발성 테스트 시작 ===");

  const samples = [
    {
      caseName: "SPOT CASE A-1 (상세 완비) - 서동요 테마파크",
      id: "fcfde6b0-f626-5cdd-945a-805a612cccd9"
    },
    {
      caseName: "SPOT CASE A-2 (상세 완비) - 동대문디자인플라자(DDP)",
      id: "698d1844-adb8-539d-9076-9d358b1aff83"
    },
    {
      caseName: "SPOT CASE A-3 (상세 완비) - 바운스 트램폴린파크 동대구신세계백화점센터",
      id: "69d52e99-3230-58c8-89d1-f3fb95812922"
    }
  ];

  for (const sample of samples) {
    console.log(`\n--------------------------------------------------`);
    console.log(`📌 ${sample.caseName}`);
    
    const { data: place, error } = await supabase
      .from('master_places')
      .select('*')
      .eq('id', sample.id)
      .single();

    if (error || !place) {
      console.error(`❌ DB 조회 실패:`, error?.message);
      continue;
    }

    const raw = place.raw_data || {};
    const isValid = hasValidDetails(raw);

    console.log(`* DB 실효 데이터 체크 결과: ${isValid ? "✅ 실효데이터 완비 (Gemini 호출)" : "⚠️ 실효데이터 누락 (0원 로컬 Fallback 우회)"}`);

    if (isValid) {
      // CASE A 처럼 유효한 상세 데이터가 있는 경우에만 Gemini API 호출
      const prompt = buildPrompt(place.category, place.name, raw);
      console.log(`[Prompt 전달값]:\n${prompt}`);
      
      try {
        console.log(`... Gemini API 호출 중 (${MODEL_NAME}) ...`);
        const reply = await requestGemini(prompt);
        const cleanReply = reply.replace(/^["']|["']$/g, '').trim();
        console.log(`🟢 [Gemini 결과 (글자수 ${cleanReply.length}자)]: "${cleanReply}"`);
      } catch (err) {
        console.error(`🔴 [Gemini 에러]:`, err.message);
      }
    } else {
      // CASE B(누락된 껍데기) 및 CASE C(전무)는 로컬 Fallback 생성
      const fallbackDesc = makeLocalFallbackDescription(place.name, place.category, place.address, raw);
      console.log(`🟢 [로컬 Fallback 결과 (글자수 ${fallbackDesc.length}자)]: "${fallbackDesc}"`);
    }
  }
}

main();

import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const keyMatch = env.match(/(?:NEXT_PUBLIC_GEMINI_API_KEY|GEMINI_API_KEY)=(.+)/);
if (!keyMatch) { console.log('Key not found'); process.exit(1); }
const key = keyMatch[1].trim();

const prompt = `당신은 '라온아이' 캠핑장의 전속 여행 가이드예요.
따뜻하고 친근한 해요체로, 캠핑을 떠나는 여행자에게 이야기하듯 안내해 주세요.

[조건]
- 날씨: 맑고 따뜻함
- 여행자: 커플 여행객

[여정 구성 (5단계)]
아래의 5단계 흐름에 맞춰서 각 단계의 시작을 알리는 인트로 문구(stageIntros)를 작성해 주세요.
1단계: 출발 (여행의 시작과 설렘)
2단계: 경유지 (가는 길 중간지점의 맛집, 카페, 명소)
3단계: 캠핑 준비 (캠핑장 근처 마트 및 식사)
4단계: 캠핑 즐기기 (캠핑장 주변 명소 및 축제)
5단계: 귀갓길 (집으로 돌아가는 길의 추천 장소)

[장소 목록]
중요: 아래 장소들의 ID(예: ID:123)를 키로 사용하여 한 줄 소개(oneLiners)를 작성해야 합니다.

- 가는 길 및 귀갓길 관련:
- ID:100 | 예쁜 카페: 뷰가 좋은 카페
- ID:101 | 맛있는 식당: 현지인 추천 맛집

- 캠핑장 주변 및 축제:
- ID:200 | 호수공원: 산책하기 좋은 곳
- ID:201 | 동네 마트: 고기와 야채가 신선함

[출력 규칙]
1. 반드시 아래 JSON 구조로만 응답하세요. 다른 텍스트는 포함하지 마세요.
2. stageIntros: 1~5단계 각각의 여정 연결 문구 (해요체, 시적인 표현 권장, 장소명 언급 금지)
3. oneLiners: 장소 ID를 키로 하여 15~30자 이내의 한 줄 소개 작성 (해요체)

{
  "stageIntros": {
    "1": "1단계 인트로 문구",
    "2": "2단계 인트로 문구",
    "3": "3단계 인트로 문구",
    "4": "4단계 인트로 문구",
    "5": "5단계 인트로 문구"
  },
  "oneLiners": {
    "100": "설명",
    "101": "설명"
  }
}`;

fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: 'application/json' }
    })
})
.then(res => res.json().then(data => ({status: res.status, data})))
.then(({status, data}) => {
    console.log('HTTP Status:', status);
    if (data.error) {
        console.log('API Error:', JSON.stringify(data.error, null, 2));
    } else {
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log('--- RAW AI RESPONSE ---');
        console.log(responseText);
        console.log('-----------------------');
        try {
            const parsed = JSON.parse(responseText);
            console.log('Parse Success!');
            console.log('Keys:', Object.keys(parsed));
        } catch(e) {
            console.log('Parse Error:', e.message);
        }
    }
})
.catch(console.error);

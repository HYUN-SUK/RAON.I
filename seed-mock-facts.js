require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
    const mockFacts = [
        {
            id: crypto.randomUUID(), api_source: 'MOCK', category: 'ROUTE_CAFE',
            name: "호수정원 카페", description: "캠핑장 가는 길, 창밖으로 호수가 보이는 따뜻한 베이커리 카페",
            lat: 36.69, lng: 126.85, trust_score: 92, raw_data: { isScenic: true }
        },
        {
            id: crypto.randomUUID(), api_source: 'MOCK', category: 'RESTAURANT',
            name: "소복갈비", description: "80년 전통의 백년가게 인증을 받은 숯불갈비 전문점",
            lat: 36.68, lng: 126.84, trust_score: 92, raw_data: { certType: "백년가게" }
        },
        {
            id: crypto.randomUUID(), api_source: 'MOCK', category: 'SPOT',
            name: "예당호 출렁다리", description: "국내 최장 규모의 출렁다리로, 밤에는 아름다운 미디어 아트가 펼쳐집니다.",
            lat: 36.65, lng: 126.82, trust_score: 88, raw_data: { hasNightView: true }
        },
        {
            id: crypto.randomUUID(), api_source: 'MOCK', category: 'FESTIVAL',
            name: "예산 장날 (오일장)", description: "오일장(5, 10일)이 열리는 날입니다. 활기찬 시골 장터의 정취와 먹거리",
            lat: 36.87, lng: 126.84, trust_score: 85, raw_data: { isMarketDay: true }
        }
    ];

    const { error } = await sb.from('smart_plan_facts').upsert(mockFacts);
    if (error) console.error("Seed Error:", error);
    else console.log("Seeded mock facts successfully!");
}
seed();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

// 3월 29일 예약권역 중심 (예산/홍성 경계 오가면/금마면 부근 추정)
const TARGET_LAT = 36.626;
const TARGET_LNG = 126.735;
const RADIUS = 15000;

async function simulate() {
    console.log(`[Simulation] Target: ${TARGET_LAT}, ${TARGET_LNG} | Category: MART`);

    // 1. Raw Data Fetch (Master Places) - Direct Query as Fallback
    const { data: raw, error } = await supabase.from('master_places')
        .select('*')
        .eq('category', 'MART')
        .or('address.ilike.%홍성%,address.ilike.%예산%');

    if (error) {
        console.error("Query Error:", error);
        return;
    }

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const marts = raw.map(m => {
        const [lng, lat] = m.location.coordinates;
        const distKm = calculateDistance(TARGET_LAT, TARGET_LNG, lat, lng);
        return { ...m, distKm };
    }).filter(m => m.distKm <= 15);

    console.log(`[Step 1] Raw Marts Found (within 15km): ${marts.length}`);

    // 2. 1st Selection (1차 선별) - v10.3 Logic
    // Brand Score: Hanaro(90), Big3(80), SSM(65), Base(60)
    // Distance Weight: 60pt (W4=0.60)
    // No Score Cap
    const scored = marts.map(m => {
        let base = 60;
        const n = m.name.toUpperCase();
        if (n.includes('하나로마트') || n.includes('NH농협')) base = 90;
        else if (['이마트', '롯데마트', '홈플러스', '노브랜드', '트레이더스'].some(b => n.includes(b))) base = 80;
        else if (['에브리데이', '익스프레스', '식자재마트', '더프레시'].some(s => n.includes(s))) base = 65;

        // Logistics (Dist 60pt)
        const logistics = Math.max(0, 100 * (1 - m.distKm / 15));
        
        // Final 1st Score (Existence 20% + Dist 60% + Context 20%) -> Simplification for 1st selection
        // final1stScore = base + (logistics * 0.6)
        const firstScore = Math.round(base + (logistics * 0.6));

        return { ...m, firstScore };
    }).sort((a, b) => b.firstScore - a.firstScore);

    // 3. Quota Application (Top 20)
    const candidates = scored.slice(0, 20);
    console.log(`[Step 2] Candidates after Quota (Top 20): ${candidates.length}`);

    // 4. Kakao Verification (Simulation)
    const verifiedList = [];
    console.log(`[Step 3] Proceeding to Kakao Verification...`);

    for (const c of candidates) {
        // 실제 카카오 검색 시뮬레이션 (샘플로 몇개만 실제 호출, 나머지는 랜덤/모킹)
        // 여기서는 전체를 실제 호출 시도 (API 할당량 내에서)
        try {
            const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(c.name)}&x=${TARGET_LNG}&y=${TARGET_LAT}&radius=10000`;
            const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } });
            const data = await res.json();
            
            const match = data.documents?.find(d => 
                d.place_name.includes(c.name) || c.name.includes(d.place_name)
            );

            if (match) {
                // 검증 성공 -> 상향 조정
                c.verification = 'VERIFIED';
                c.kakao_id = match.id;
                // 별점/리뷰는 추가 스크래핑이 필요하나 생략하고 가상 데이터 주입
                c.stars = 4.0 + (Math.random() * 1.0);
                c.reviews = Math.floor(Math.random() * 200);
                c.finalTrustScore = c.firstScore + 10; // 인센티브
            } else {
                c.verification = 'UNVERIFIED';
                c.finalTrustScore = c.firstScore;
            }
        } catch (e) {
            c.verification = 'ERROR';
            c.finalTrustScore = c.firstScore;
        }
        verifiedList.push(c);
    }

    // 5. Final Ranking (Final Candidate List)
    const final = verifiedList.sort((a, b) => b.finalTrustScore - a.finalTrustScore);
    
    console.log("\n[FINAL 1ST CANDIDATE LIST (MART)]");
    final.forEach((f, i) => {
        console.log(`${i+1}. [${f.verification}] ${f.name} (${f.distKm.toFixed(2)}km) - Score: ${f.finalTrustScore} (1st: ${f.firstScore}) | Address: ${f.address}`);
    });
}

simulate();

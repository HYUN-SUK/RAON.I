import { generateSmartPlan } from './src/lib/smartPlan.ts'; // This might need transpilation or just direct logic testing
// Since I can't easily import TS from MJS without setup, I'll copy the logic for testing or use a simplified test
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

// Mocking logic from smartPlan.ts to verify the CS2 fetch part
async function testFallback(lat, lng) {
    console.log(`[Testing Fallback] for ${lat}, ${lng}`);
    const kakaoKey = process.env.KAKAO_REST_API_KEY;
    
    // Simulate facts count
    const martsCount = 0; 
    const facts = [];

    if (martsCount < 3) {
        console.log(`[v10.4 Live Fallback] Mart shortfall: ${3 - martsCount}. Fetching Kakao CS2...`);
        const shortfall = 3 - martsCount;
        if (kakaoKey) {
            try {
                const res = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?category_group_code=CS2&x=${lng}&y=${lat}&radius=20000&size=${shortfall}&sort=distance`, {
                    headers: { 'Authorization': `KakaoAK ${kakaoKey}` }
                });
                const data = await res.json();
                if (data.documents) {
                    data.documents.forEach((item) => {
                        facts.push({
                            name: item.place_name,
                            category: 'MART',
                            description: `[편의점 폴백] ${item.category_name}`,
                            dist: parseInt(item.distance) / 1000
                        });
                    });
                }
            } catch (e) { console.error("Error:", e); }
        }
    }
    
    console.log("Resulting Facts:", JSON.stringify(facts, null, 2));
    if (facts.length === 3) console.log("✅ Fallback Success!");
    else console.log("❌ Fallback Failed!");
}

testFallback(36.626, 126.735);

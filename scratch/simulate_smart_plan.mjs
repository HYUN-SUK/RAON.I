import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const origin = { lat: 37.5665, lng: 126.9780 }; // 서울시청
const destination = { lat: 36.7865, lng: 126.8322 }; // 라온아이
const reservationId = 'c2c0d7cb-95cc-4df0-9f53-27b03e976934';
const targetDate = '2026-05-04';

const persona = {
    id: 'mock-family',
    description: '초등학생 자녀 1명과 함께하는 3인 가족 캠퍼',
    guestDetails: {
        adults: 2,
        kids: { preschool: 0, elementary: 1 },
        hasPet: false
    },
    tagMap: { 'FAMILY_INFANT': 10, 'FOOD_TRADITIONAL': 7 }
};

async function getMidpoint(o, d) {
    const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${o.lng},${o.lat}&destination=${d.lng},${d.lat}&priority=RECOMMEND`;
    const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } }).then(r => r.json());
    if (res.routes?.[0]?.sections?.[0]?.roads) {
        const roads = res.routes[0].sections[0].roads;
        const mid = roads[Math.floor(roads.length / 2)].vertexes;
        return { lng: mid[0], lat: mid[1] };
    }
    return null;
}

function calcContextFitDeep(item, weather, isWinter, persona) {
    let score = 25;
    const text = (item.name + ' ' + (item.description || '')).toLowerCase();
    const hasKids = (persona.guestDetails?.kids?.preschool || 0) > 0 || (persona.guestDetails?.kids?.elementary || 0) > 0;

    if (weather.includes('맑음') && text.match(/야외|산책|공원|수목원|숲길/)) score += 15;
    if (persona.tagMap['FAMILY_INFANT'] && text.match(/소아|아동|어린이|유아|돈까스|키즈|체험|생태/)) score += 40;
    if (hasKids && text.match(/어린이/)) score += 10;

    return Math.max(0, Math.min(100, score));
}

async function fetchWithExpansion(lat, lng, category, requiredCount = 5) {
    const searchRadii = [5000, 10000, 15000, 20000, 25000, 30000];
    let allFound = new Map();
    const isCafeSearch = category === 'CAFE';
    const targetCategory = isCafeSearch ? 'RESTAURANT' : category;

    for (const radius of searchRadii) {
        console.log(`🔍 Searching ${category} in ${radius}m radius...`);
        const { data, error } = await supabase.rpc('get_master_places_in_radius_v2', {
            target_lat: lat,
            target_lng: lng,
            radius_meters: radius,
            limit_count: isCafeSearch ? 500 : 50,
            p_category: targetCategory
        });

        if (data) {
            data.forEach(item => {
                if (!allFound.has(item.id)) {
                    if (isCafeSearch) {
                        const name = item.name || '';
                        const cafeKeywords = /카페|커피|베이커리|제과|다방|디저트|찻집|로스터리|빵집/;
                        if (name.includes('카페') || name.includes('커피') || cafeKeywords.test(name)) {
                            allFound.set(item.id, item);
                        }
                    } else {
                        allFound.set(item.id, item);
                    }
                }
            });
            if (isCafeSearch) { if (allFound.size >= 12) break; } 
            else { if (allFound.size >= requiredCount) break; }
        }
    }
    const results = Array.from(allFound.values());
    if (isCafeSearch) console.log(`✅ Total unique cafes found: ${results.length}`);
    return results;
}

async function simulate() {
    console.log('🚀 Starting Smart Plan Simulation...');
    const weatherSummary = "맑음(15~22도)";
    
    const mid = await getMidpoint(origin, destination);
    if (!mid) return console.error('Midpoint failed');
    console.log(`📍 Midpoint: ${mid.lat}, ${mid.lng}`);

    const spots = await fetchWithExpansion(mid.lat, mid.lng, 'SPOT', 10);
    const restaurants = await fetchWithExpansion(mid.lat, mid.lng, 'RESTAURANT', 10);
    const cafes = await fetchWithExpansion(mid.lat, mid.lng, 'CAFE', 10);

    const trackB = [...spots, ...restaurants, ...cafes].map(row => {
        const distMeters = row.distance_meters || row.dist_meters || (row.distance * 1000) || 0;
        const cFit = calcContextFitDeep(row, weatherSummary, false, persona);
        const distScore = Math.max(0, 30 * (1 - distMeters / 5000));
        const finalScore = 50 + cFit + distScore;
        
        let cat = row.category;
        const name = row.name || '';
        if (name.includes('카페') || name.includes('커피')) cat = 'CAFE';

        return { ...row, category: cat, contextFit: cFit, distScore, finalScore };
    }).sort((a, b) => b.finalScore - a.finalScore);

    let report = `# Smart Plan Simulation Report (${targetDate})\n\n`;
    report += `**중간지점**: ${mid.lat.toFixed(4)}, ${mid.lng.toFixed(4)}\n\n`;

    ['SPOT', 'RESTAURANT', 'CAFE'].forEach(cat => {
        const items = trackB.filter(i => i.category === cat);
        if (items.length > 0) {
            report += `### 🏷️ ${cat}\n`;
            report += `| 이름 | 최종 점수 | 거리 가점 | ContextFit | 주소 |\n`;
            report += `| :--- | :---: | :---: | :---: | :--- |\n`;
            items.slice(0, 10).forEach(c => {
                report += `| ${c.name} | **${c.finalScore.toFixed(1)}** | +${c.distScore.toFixed(1)} | +${c.contextFit} | ${c.address} |\n`;
            });
            report += `\n`;
        }
    });

    fs.writeFileSync('simulation_results_20260504.md', report, 'utf-8');
    console.log('✅ Report generated: simulation_results_20260504.md');
}

simulate();

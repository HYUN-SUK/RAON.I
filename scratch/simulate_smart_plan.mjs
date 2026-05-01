import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

// Mocking some imports since we are running in node
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const origin = { lat: 37.5665, lng: 126.9780 }; // 서울시청
const destination = { lat: 36.7865, lng: 126.8322 }; // 라온아이
const reservationId = 'c2c0d7cb-95cc-4df0-9f53-27b03e976934';
const targetDate = '2026-05-04';

// Mock Persona: 초등학생 자녀를 둔 가족 (TagId 기반)
const persona = {
    id: 'mock-family',
    description: '초등학생 자녀 1명과 함께하는 3인 가족 캠퍼',
    guestDetails: {
        adults: 2,
        kids: { preschool: 0, elementary: 1 },
        hasPet: false
    },
    topTags: [{ tagId: 'FAMILY_INFANT', weight: 10 }, { tagId: 'FOOD_TRADITIONAL', weight: 7 }],
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

function computePersonaMatch(item, tagMap) {

    // Simplified bridge logic for simulation
    let score = 0;
    const text = (item.name + ' ' + (item.description || '')).toLowerCase();
    
    if (tagMap['FAMILY_INFANT']) {
        if (text.match(/소아|아동|수유|어린이|유아|돈까스|키즈|체험|박물관|생태|황새|물놀이|놀이터/)) {
            score += 40 * (tagMap['FAMILY_INFANT'] / 10);
        }
    }
    return score;
}

function calcContextFitDeep(item, weather, isWinter, persona) {
    let score = 25;
    const text = (item.name + ' ' + (item.description || '')).toLowerCase();
    const hasKids = (persona.guestDetails?.kids?.preschool || 0) > 0 || (persona.guestDetails?.kids?.elementary || 0) > 0;

    // 1. Weather
    if (weather.includes('맑음')) {
        if (text.match(/야외|산책|공원|수목원|숲길/)) score += 15;
    }

    // 2. Bridge Score
    const bridgeScore = computePersonaMatch(item, persona.tagMap || {});

    // 3. Safety Score
    let safetyScore = 0;
    if (hasKids) {
        if (text.match(/어린이/)) safetyScore += 10;
    }

    return Math.max(0, Math.min(100, score + bridgeScore + safetyScore));
}


async function simulate() {
    console.log('🚀 Starting Smart Plan Simulation...');
    const weatherSummary = "맑음(15~22도)";
    const isWinter = false;

    // 1. Track A (Destination)
    const { data: trackAData } = await supabase.from('smart_plan_candidates').select('*').eq('reservation_id', reservationId);
    const trackA = trackAData.map(row => {
        const cFit = calcContextFitDeep(row, weatherSummary, isWinter, persona);
        const finalScore = (row.quality_score || 50) + cFit - (row.penalty_score || 0);
        return { ...row, contextFit: cFit, finalScore };
    }).sort((a, b) => b.finalScore - a.finalScore);

    // 2. Track B (Midpoint)
    const mid = await getMidpoint(origin, destination);
    let trackB = [];
    if (mid) {
        console.log(`📍 Midpoint found: ${mid.lat}, ${mid.lng}`);
        const { data: rpcData } = await supabase.rpc('get_master_places_in_radius_v2', {
            target_lat: mid.lat,
            target_lng: mid.lng,
            radius_meters: 20000,
            limit_count: 50,
            p_category: 'RESTAURANT'
        });
        const { data: rpcDataSpot } = await supabase.rpc('get_master_places_in_radius_v2', {
            target_lat: mid.lat,
            target_lng: mid.lng,
            radius_meters: 20000,
            limit_count: 50,
            p_category: 'SPOT'
        });

        const allB = [...(rpcData || []), ...(rpcDataSpot || [])];
        trackB = allB.map(row => {
            const cFit = calcContextFitDeep(row, weatherSummary, isWinter, persona);
            const distKm = row.distance_meters / 1000;
            const distScore = Math.max(0, 30 * (1 - row.distance_meters / 5000));
            const finalScore = 50 + cFit + distScore;
            return { ...row, contextFit: cFit, distScore, finalScore };
        }).sort((a, b) => b.finalScore - a.finalScore);
    }

    // 3. Generate Report
    let report = `# Smart Plan Simulation Report (${targetDate})\n\n`;
    report += `**출발지**: 서울시청 (${origin.lat}, ${origin.lng})\n`;
    report += `**목적지**: 라온아이 오토캠핑장 (${destination.lat}, ${destination.lng})\n`;
    report += `**날씨**: ${weatherSummary}\n`;
    report += `**페르소나**: ${persona.description}\n\n`;

    const categories = ['SPOT', 'RESTAURANT', 'MART', 'GAS_STATION', 'HOSPITAL'];

    report += `## [ Track A: Destination Candidates ]\n`;
    categories.forEach(cat => {
        const items = trackA.filter(i => i.category === cat);
        if (items.length > 0) {
            report += `### 🏷️ ${cat}\n`;
            report += `| 이름 | 품질 | 감점(거리) | ContextFit | 최종 점수 | 주소 |\n`;
            report += `| :--- | :---: | :---: | :---: | :---: | :--- |\n`;
            items.forEach(c => {
                report += `| ${c.name} | ${c.quality_score} | -${c.penalty_score} | +${c.contextFit} | **${c.finalScore.toFixed(1)}** | ${c.address} |\n`;
            });
            report += `\n`;
        }
    });

    report += `\n## [ Track B: Route/Midpoint Candidates ]\n`;
    if (mid) {
        report += `**중간지점**: ${mid.lat.toFixed(4)}, ${mid.lng.toFixed(4)}\n\n`;
        categories.filter(c => ['SPOT', 'RESTAURANT'].includes(c)).forEach(cat => {
            const items = trackB.filter(i => i.category === cat);
            if (items.length > 0) {
                report += `### 🏷️ ${cat}\n`;
                report += `| 이름 | 품질(기본) | 거리 가점 | ContextFit | 최종 점수 | 주소 |\n`;
                report += `| :--- | :---: | :---: | :---: | :---: | :--- |\n`;
                items.forEach(c => {
                    report += `| ${c.name} | 50 | +${c.distScore.toFixed(1)} | +${c.contextFit} | **${c.finalScore.toFixed(1)}** | ${c.address} |\n`;
                });
                report += `\n`;
            }
        });
    } else {
        report += `중간지점 계산 실패 (API 오류)\n`;
    }


    fs.writeFileSync('simulation_results_20260504.md', report, 'utf-8');
    console.log('✅ Simulation Report generated: simulation_results_20260504.md');
}

simulate();

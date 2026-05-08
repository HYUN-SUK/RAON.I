import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';
import { v5 as uuidv5 } from 'uuid';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const generateFactId = (source, name, address) => {
    return uuidv5(`${source}|${name}|${address}`, MY_NAMESPACE);
};

function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function runAnalysis() {
    const targetLat = 37.922559; // 강원도립화목원 Lat
    const targetLng = 127.725055; // 강원도립화목원 Lng
    const reservationId = 'da50ae82-a68f-44d0-bc37-e4b2968887fd';

    console.log(`🚀 Starting Hospital Analysis for Chuncheon...`);

    // 1. Raw Data Collection
    const rawList = [];
    
    // A. NMC Hospital
    try {
        const hRes = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${PUBLIC_API_KEY}&STAGE1=${encodeURIComponent('강원')}&STAGE2=${encodeURIComponent('춘천시')}&pageNo=1&numOfRows=100&_type=json`);
        const hData = await hRes.json();
        if (hData.response?.body?.items?.item) {
            const items = Array.isArray(hData.response.body.items.item) ? hData.response.body.items.item : [hData.response.body.items.item];
            items.forEach(item => {
                rawList.push({
                    source: 'NMC_HOSPITAL',
                    name: item.dutyName,
                    address: item.dutyAddr,
                    lat: parseFloat(item.wgs84Lat),
                    lng: parseFloat(item.wgs84Lon),
                    raw: item
                });
            });
        }
    } catch (e) { console.error("NMC Error:", e.message); }

    // B. Kakao HP8
    try {
        const kRes = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?category_group_code=HP8&x=${targetLng}&y=${targetLat}&radius=20000&size=15`, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } });
        const kData = await kRes.json();
        if (kData.documents) {
            kData.documents.forEach(item => {
                rawList.push({
                    source: 'KAKAO_HP8',
                    name: item.place_name,
                    address: item.road_address_name || item.address_name,
                    lat: parseFloat(item.y),
                    lng: parseFloat(item.x),
                    raw: item
                });
            });
        }
    } catch (e) { console.error("Kakao Error:", e.message); }

    fs.writeFileSync('hospital_step1_raw.json', JSON.stringify(rawList, null, 2));
    console.log(`✅ Step 1: Raw list saved (${rawList.length} items)`);

    // 2. Scoring & 1st Quota (Stage 3 Simulation)
    const scoredList = rawList.map(item => {
        let s = 10;
        const name = item.name;
        
        // Caching script scoring logic
        if (item.source === 'NMC_HOSPITAL' || /종합병원|의료원|대학병원/.test(name)) {
            s = 100;
        } else if (/의원|병원/.test(name) || /내과|소아|외과|가정|일반|마취|응급|야간/.test(name)) {
            s = 50;
        }
        
        if (/응급|야간|24시/.test(name)) s += 40;
        
        // Special NMC trust score logic (Wait, NMC items from step 1 have base scores too)
        let trustScoreAtSource = item.source === 'NMC_HOSPITAL' ? (item.name.includes('소아') ? 100 : 55) : (item.name.match(/종합병원|의료원|대학병원/) ? 50 : 20);
        
        const dist = haversineKm(targetLat, targetLng, item.lat, item.lng);
        return {
            ...item,
            trust_score: s,
            source_trust: trustScoreAtSource,
            distance_km: dist
        };
    });

    // Filtering & Sorting (Stage 3 & 4)
    const penaltyFactor = 3.0;
    const personalized = scoredList.map(item => {
        const penalty = item.distance_km * penaltyFactor;
        return {
            ...item,
            penalty,
            final_score: item.trust_score - penalty
        };
    }).sort((a, b) => b.final_score - a.final_score);

    fs.writeFileSync('hospital_step2_scored.json', JSON.stringify(personalized, null, 2));
    console.log(`✅ Step 2: Scored list saved`);

    // 3. Final List (Top 6 per Caching Logic)
    const finalList = personalized.slice(0, 6);
    fs.writeFileSync('hospital_step3_final.json', JSON.stringify(finalList, null, 2));
    console.log(`✅ Step 3: Final list saved`);

    // Generate MD Report for User
    let md = `# 춘천 병원 데이터 흐름 분석 리스트\n\n`;
    md += `## 1. 1차 수집 리스트 (Raw Pool)\n`;
    md += `| 소스 | 이름 | 주소 | 거리(km) |\n| :--- | :--- | :--- | :---: |\n`;
    rawList.forEach(x => {
        const d = haversineKm(targetLat, targetLng, x.lat, x.lng);
        md += `| ${x.source} | ${x.name} | ${x.address} | ${d.toFixed(2)} |\n`;
    });

    md += `\n## 2. 1차 쿼터 및 개인화 결과 (Scored Pool)\n`;
    md += `| 순위 | 이름 | 기본점수 | 거리(km) | 감점 | 최종점수 | 비고 |\n| :---: | :--- | :---: | :---: | :---: | :---: | :--- |\n`;
    personalized.forEach((x, i) => {
        md += `| ${i+1} | ${x.name} | ${x.trust_score} | ${x.distance_km.toFixed(2)} | -${x.penalty.toFixed(1)} | **${x.final_score.toFixed(1)}** | ${x.source} |\n`;
    });

    fs.writeFileSync('chuncheon_hospital_audit.md', md);
    console.log(`🏁 Analysis Complete: chuncheon_hospital_audit.md generated.`);
}

runAnalysis();

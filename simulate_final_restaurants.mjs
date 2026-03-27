import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TARGET_LAT = 36.626;
const TARGET_LNG = 126.735;
const RADIUS = 15000;

async function simulate() {
    console.log(`[Simulation] Target: ${TARGET_LAT}, ${TARGET_LNG} | Category: RESTAURANT (v10.4 Grouped)`);

    const delta = 0.2;
    const { data: raw, error } = await supabase.from('master_places')
        .select('id, name, address, lat, lng, api_source, category')
        .eq('category', 'RESTAURANT')
        .gt('lat', TARGET_LAT - delta)
        .lt('lat', TARGET_LAT + delta)
        .gt('lng', TARGET_LNG - delta)
        .lt('lng', TARGET_LNG + delta)
        .limit(1000);

    if (error) {
        console.error("Query Error:", error);
        return;
    }

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // [v10.4] Deduplication / Grouping Logic
    const restMap = new Map();
    raw.forEach(m => {
        // Normalize key by removing spaces and taking first 15 chars of address
        const key = `${m.name.replace(/\s/g, '')}|${(m.address || '').slice(0, 15)}`;
        const existing = restMap.get(key);
        if (existing) {
            const s1 = (existing.api_source || '').split(',').map(s => s.trim());
            const s2 = (m.api_source || '').split(',').map(s => s.trim());
            existing.api_source = Array.from(new Set([...s1, ...s2])).join(',');
        } else {
            restMap.set(key, { ...m });
        }
    });

    const deduped = Array.from(restMap.values());

    const scored = deduped.map(m => {
        const distKm = calculateDistance(TARGET_LAT, TARGET_LNG, m.lat, m.lng);
        const sources = (m.api_source || '').split(',').map(s => s.trim());
        let existence = 10;
        const badges = [];
        if (sources.includes('SMBA_BAEK')) { existence += 50; badges.push('백년가게'); }
        if (sources.includes('MOIS_GOOD_RESTAURANT')) { existence += 30; badges.push('모범음식점'); }
        if (sources.includes('SAFE_RESTAURANT')) { existence += 20; badges.push('안심식당'); }
        
        const logistics = Math.max(0, 40 * (1 - distKm / 15));
        const finalScore = Math.round(existence + logistics);
        return { ...m, distKm, existence, logistics, finalScore, badges };
    })
    .filter(m => {
        if (m.distKm > 15) return false;
        // Noise Filter
        const isNoise = /안경|의상|한복|건축|이용원|이발|미용|보청기|수선|세탁|공방|장례식장|노인복지|어린이집/.test(m.name);
        return !isNoise;
    })
    .sort((a, b) => b.finalScore - a.finalScore);

    let md = `# [v10.4] 식당 1차 후보군 전수 감사 보고서 (중복 제거 적용)\n\n`;
    md += `**기준 일시**: ${new Date().toLocaleString()}\n`;
    md += `**기준 좌표**: ${TARGET_LAT}, ${TARGET_LNG} (반경 15km)\n`;
    md += `**스코어링 정책**: Existence(Base 10 + 백년 50 + 모범 30 + 안심 20) + Logistics(40pt max)\n`;
    md += `**특이사항**: 이름 및 주소 기준 그룹화 및 소스 통합 적용 (Deduplicated)\n\n`;
    md += `| 순위 | 상호명 | 거리(km) | 신뢰도(E) | 거리점수(L) | 최종점수 | 인증 현황 | 주소 |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    scored.forEach((s, i) => {
        md += `| ${i + 1} | **${s.name}** | ${s.distKm.toFixed(2)} | ${s.existence} | ${s.logistics.toFixed(1)} | **${s.finalScore}** | ${s.badges.join(', ') || '-'} | ${s.address} |\n`;
    });

    fs.writeFileSync('restaurant_final_audit.md', md, 'utf8');
    console.log("SIMULATION_FILE_CREATED: restaurant_final_audit.md");
}

simulate();

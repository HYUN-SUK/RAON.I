import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TARGET_LAT = 36.626;
const TARGET_LNG = 126.735;
const RADIUS = 30000;

async function simulate() {
    console.log(`[Simulation] Target: ${TARGET_LAT}, ${TARGET_LNG} | Category: SPOT (v10.5 Universal)`);

    const delta = 0.4;
    const { data: raw, error } = await supabase.from('master_places')
        .select('id, name, address, lat, lng, api_source, category, raw_data')
        .in('category', ['SPOT', 'FESTIVAL'])
        .gt('lat', TARGET_LAT - delta)
        .lt('lat', TARGET_LAT + delta)
        .gt('lng', TARGET_LNG - delta)
        .lt('lng', TARGET_LNG + delta)
        .limit(4000); // Increased limit

    if (error) {
        console.error("Query Error:", error);
        return;
    }

    console.log(`Total records fetched: ${raw.length}`);

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

    const spotMap = new Map();
    raw.forEach(m => {
        const key = `${m.name.replace(/\s/g, '')}|${(m.address || '').slice(0, 15)}`;
        const existing = spotMap.get(key);
        if (existing) {
            if (!existing.raw_data?.description && m.raw_data?.description) {
                existing.raw_data = { ...existing.raw_data, description: m.raw_data.description };
            }
            if (!existing.raw_data?.firstimage && m.raw_data?.firstimage) {
               existing.raw_data = { ...existing.raw_data, firstimage: m.raw_data.firstimage };
            }
        } else {
            spotMap.set(key, { ...m });
        }
    });

    const deduped = Array.from(spotMap.values());

    const scored = deduped.map(m => {
        const distKm = calculateDistance(TARGET_LAT, TARGET_LNG, m.lat, m.lng);
        if (distKm > 30) return null;

        const name = m.name || "";
        const raw = m.raw_data || {};
        const contentId = raw.contentTypeId || "";
        
        let existence = 10;
        let reasons = [];

        // 1. TourAPI Base
        if (['12', '14', '28'].includes(contentId) || m.api_source === 'TOUR_SPOT') { 
            existence += 20; reasons.push('TourAPI'); 
        }
        
        // 2. [v10.5.1] Refined Universal Keyword Tiering
        // S-Tier: 국립, 도립, 군립, 수목원, 휴양림, 관광지, 출렁다리, 모노레일, 케이블카, 해수욕장, 테마파크 + 사찰(사), 읍성, 성지
        if (/국립|도립|군립|수목원|휴양림|관광지|출렁다리|모노레일|케이블카|해수욕장|테마파크|사($|[\s({])|사찰|읍성|성지/.test(name)) { 
            existence += 45; reasons.push('S-Key'); 
        } 
        // A-Tier: 박물관, 미술관, 기념관, 천문대, 생태, 역사, 향교, 서원, 고택, 생가, 가옥, 민속촌
        else if (/박물관|미술관|기념관|천문대|생태|역사|향교|서원|고택|생가|가옥|민속촌/.test(name)) { 
            existence += 30; reasons.push('A-Key'); 
        } 
        else if (/공원|체험관|조각|예술|문화촌/.test(name)) {
            existence += 15; reasons.push('B-Key');
        }

        // 3. [v10.5] Digital Asset Score (Proxy for Popularity)
        const descLen = raw.description?.length || 0;
        const hasImg = !!raw.firstimage;

        if (hasImg) { existence += 15; reasons.push('Img'); }
        if (descLen > 100) { existence += 15; reasons.push('Desc'); }
        if (hasImg && descLen > 100) { existence += 10; reasons.push('Asset+'); }

        // 4. [v10.5] ReadCount Index
        const readcount = parseInt(raw.readcount || "0");
        if (readcount >= 10000) { existence += 40; reasons.push('Pop(10k)'); }
        else if (readcount >= 5000) { existence += 25; reasons.push('Pop(5k)'); }
        else if (readcount >= 1000) { existence += 10; reasons.push('Pop(1k)'); }

        const logistics = Math.max(0, 40 * (1 - distKm / 30));
        const finalScore = Math.round(existence + logistics);
        
        if (name.includes('수덕사')) {
            console.log(`[DEBUG] 수덕사 found: existence=${existence}, dist=${distKm.toFixed(2)}, score=${finalScore}`);
        }

        return { ...m, distKm, existence, logistics, finalScore, reasons };
    })
    .filter(m => m !== null)
    .sort((a, b) => b.finalScore - a.finalScore);

    let md = `# [v10.5] 명소(Spot) 전수 감사 보고서 (No Quota / Universal Logic)\n\n`;
    md += `**기준 위치**: ${TARGET_LAT}, ${TARGET_LNG} (반경 30km)\n`;
    md += `**집계 단위**: 중복 제거 후 총 **${scored.length}개** 장소\n`;
    md += `**핵심 로직**: Universal Keywords + Asset Richness + ReadCount\n\n`;
    md += `| 순위 | 명소명 | 거리(km) | 상징성(E) | 거리점수(L) | 최종점수 | 등급 사유 | 주소 |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    scored.forEach((s, i) => {
        md += `| ${i + 1} | **${s.name}** | ${s.distKm.toFixed(2)} | ${s.existence} | ${s.logistics.toFixed(1)} | **${s.finalScore}** | ${s.reasons.join(', ')} | ${s.address} |\n`;
    });

    fs.writeFileSync('spot_final_audit.md', md, 'utf8');
    console.log("SIMULATION_FILE_CREATED: spot_final_audit.md");
}

simulate();

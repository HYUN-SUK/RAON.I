import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function simulate() {
  const campingLat = 36.626;
  const campingLng = 126.735;
  const radiusKm = 30;

  console.log(`[v10.6] Hospital Simulation starting... Coords: ${campingLat}, ${campingLng}`);

  const { data: candidates, error } = await supabase
    .from('master_places')
    .select('*')
    .eq('category', 'HOSPITAL')
    .limit(2000);

  if (error) {
    console.error(error);
    return;
  }

  // 1. Grouping & Deduplication
  const hospMap = new Map();
  candidates.forEach(c => {
    const normName = c.name.replace(/\s/g, '');
    const key = `${normName}|${(c.address || '').slice(0, 15)}`;
    
    // Noise Filter (Emergency Suitability)
    const isNoise = /동물|반려|정신|행정관|피부|치과|요양|성형|한의원|뷰티|비만|디톡스|안과|산후|산부인과|한복|항문/.test(c.name);
    if (isNoise) return;

    const dist = calculateDistance(campingLat, campingLng, c.lat, c.lng);
    if (dist > radiusKm) return;

    const existing = hospMap.get(key);
    if (existing) {
      if (!existing.raw_data?.firstimage && c.raw_data?.firstimage) {
        existing.raw_data = { ...existing.raw_data, firstimage: c.raw_data.firstimage };
      }
      if (dist < existing.dist) existing.dist = dist;
    } else {
      hospMap.set(key, { ...c, dist });
    }
  });

  // 2. Scoring
  const scored = Array.from(hospMap.values()).map(m => {
    const name = m.name || "";
    const raw = m.raw_data || {};
    let existence = 30;
    let reasons = [];

    // Tier Scoring
    if (m.api_source?.includes('NMC') || /종합병원|의료원/.test(name)) {
        existence = 100; reasons.push('S-Tier');
    } else if (/내과|소아과|외과|가정의학/.test(name)) {
        existence = 70; reasons.push('A-Tier');
    } else if (/보건소|보건지소/.test(name)) {
        existence = 50; reasons.push('B-Tier');
    } else {
        reasons.push('C-Tier');
    }

    // Emergency Bonus (+40)
    if (/응급|야간|24시/.test(name) || /응급실/.test(raw.description || '')) {
        existence += 40; reasons.push('ER+40');
    }

    // Asset Bonus
    if (raw.firstimage) { existence += 10; reasons.push('Img'); }
    if (raw.description?.length > 50) { existence += 10; reasons.push('Desc'); }

    const logistics = Math.max(0, 40 * (1 - m.dist / 30));
    const finalScore = Math.round(existence + logistics);

    return { ...m, existence, logistics, finalScore, reasons: reasons.join(', ') };
  }).sort((a, b) => b.finalScore - a.finalScore);

  // 3. Generate Report
  let md = `\n\n## [v10.6] 병원(Hospital) 전수 감사 보고서 (No Quota)\n\n`;
  md += `**기준 위치**: ${campingLat}, ${campingLng} (반경 ${radiusKm}km)\n`;
  md += `**집계 단위**: 중복 제거 후 총 **${scored.length}개** 병원\n\n`;
  md += `| 순위 | 병원명 | 거리(km) | 상징성(E) | 거리점수(L) | 최종점수 | 등급 사유 | 주소 |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  scored.forEach((m, i) => {
    md += `| ${i + 1} | **${m.name}** | ${m.dist.toFixed(2)} | ${m.existence} | ${m.logistics.toFixed(1)} | **${m.finalScore}** | ${m.reasons} | ${m.address} |\n`;
  });

  fs.appendFileSync('spot_final_audit.md', md);
  console.log('SIMULATION_APPENDED: spot_final_audit.md');
}

simulate();

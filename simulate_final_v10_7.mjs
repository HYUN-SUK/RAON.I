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
  const targetDateStr = '2026-03-27';
  const targetYYYYMMDD = targetDateStr.replace(/-/g, '');
  const month = parseInt(targetDateStr.split('-')[1]);
  const isWinter = [11, 12, 1, 2, 3].includes(month);

  console.log(`[v10.7] Festival/Gas Simulation starting... Date: ${targetDateStr}, Winter: ${isWinter}`);

  // 1. FESTIVAL Simulation
  let { data: festivals } = await supabase
    .from('master_places')
    .select('*')
    .eq('category', 'FESTIVAL');

  // [v10.7 Test Data Injection]
  const testFestivals = [
    { name: '대흥 슬로시티 봄나들이 (기간중첩)', lat: 36.626, lng: 126.735, address: '충남 예산군', raw_data: { eventstartdate: '20260320', eventenddate: '20260405', firstimage: 't.jpg' } },
    { name: '이미 끝난 겨울축제 (기간미달)', lat: 36.626, lng: 126.735, address: '충남 홍성군', raw_data: { eventstartdate: '20260101', eventenddate: '20260228' } }
  ];
  festivals = [...(festivals || []), ...testFestivals];

  const activeFestivals = festivals.filter(f => {
    const sDate = f.raw_data?.eventstartdate;
    const eDate = f.raw_data?.eventenddate;
    if (!sDate || !eDate) return false;
    const dist = calculateDistance(campingLat, campingLng, f.lat, f.lng);
    if (dist > radiusKm) return false;
    // Overlap check
    return (targetYYYYMMDD >= sDate && targetYYYYMMDD <= eDate);
  }).map(f => {
    const dist = calculateDistance(campingLat, campingLng, f.lat, f.lng);
    let s = 50 + 20; // Base + Festival Bonus
    if (f.raw_data?.firstimage) s += 15;
    const readcount = parseInt(f.raw_data?.readcount || "0");
    if (readcount >= 5000) s += 25;
    const finalScore = Math.round(s + (1 - dist/30)*40);
    return { ...f, dist, finalScore, s };
  }).sort((a,b) => b.finalScore - a.finalScore);

  // 2. GAS_STATION Simulation
  let { data: gasStations } = await supabase
    .from('master_places')
    .select('*')
    .eq('category', 'GAS_STATION');

  // [v10.7 Test Data Injection]
  const testGas = [
    { name: '예산농협주유소 (등유판매)', lat: 36.626, lng: 126.735, address: '충남 예산군', raw_data: { K_PRICE: '1450', B_PRICE: '1650' } },
    { name: '무등유 주유소 (등유없음)', lat: 36.626, lng: 126.735, address: '충남 홍성군', raw_data: { K_PRICE: '0', B_PRICE: '1600' } }
  ];
  gasStations = [...(gasStations || []), ...testGas];

  const filteredGas = gasStations.filter(g => {
    const dist = calculateDistance(campingLat, campingLng, g.lat, g.lng);
    if (dist > radiusKm) return false;
    if (isWinter) {
        return parseFloat(g.raw_data?.K_PRICE || "0") > 0;
    }
    return true;
  }).map(g => {
    const dist = calculateDistance(campingLat, campingLng, g.lat, g.lng);
    const kPrice = parseFloat(g.raw_data?.K_PRICE || "0");
    return { ...g, dist, kPrice };
  }).sort((a,b) => {
    if (isWinter) return a.kPrice - b.kPrice;
    return a.dist - b.dist; // Simple distance if not winter (legacy)
  });

  // 3. Generate Report
  let md = `\n\n## [v10.7] 축제(Festival) 및 주유소(Gas Station) 전수 감사 보고서 (No Quota)\n\n`;
  md += `**가정 일자**: ${targetDateStr} (시즌: ${isWinter ? '동절기' : '하절기'})\n`;
  md += `**기준 위치**: ${campingLat}, ${campingLng} (반경 ${radiusKm}km)\n\n`;

  md += `### 1. 일정 연동 축제 리스트 (기간 내 개최 건만 표시)\n`;
  md += `| 순위 | 축제명 | 기간 | 거리(km) | 상징성 | 최종점수 | 주소 |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  if (activeFestivals.length === 0) md += `| - | (해당 기간 내 개최되는 축제가 없습니다) | - | - | - | - | - |\n`;
  activeFestivals.forEach((f, i) => {
    md += `| ${i+1} | **${f.name}** | ${f.raw_data.eventstartdate} ~ ${f.raw_data.eventenddate} | ${f.dist.toFixed(2)} | ${f.s} | **${f.finalScore}** | ${f.address} |\n`;
  });

  md += `\n### 2. 주유소 리스트 (동절기 등유 판매점 우선)\n`;
  md += `| 순위 | 주유소명 | 등유가격 | 거리(km) | 주소 |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  filteredGas.forEach((g, i) => {
    md += `| ${i+1} | **${g.name}** | ${g.kPrice}원 | ${g.dist.toFixed(2)} | ${g.address} |\n`;
  });

  fs.appendFileSync('spot_final_audit.md', md);
  console.log('SIMULATION_APPENDED: spot_final_audit.md');
}

simulate();

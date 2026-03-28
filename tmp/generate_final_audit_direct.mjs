
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateAuditReport() {
  console.log('--- RE-GENERATING Full v11.0 Precision Audit Report (Direct Extraction) ---');
  const targetLat = 36.626909;
  const targetLng = 126.764786;
  const targetDate = '2026-03-31';

  // 1. Fetch raw candidates from Yesan region using text search (Reliable bypass for RPC issues)
  const { data: rawPool } = await supabase.from('master_places')
    .select('*')
    .ilike('address', '%예산군%');
  
  if (!rawPool || rawPool.length === 0) {
    console.error('Master Pool is empty for Yesan region!');
    return;
  }

  const categories = [
    { cat: 'RESTAURANT', alt: '음식점', limit: 300, title: '식당 (RESTAURANT)' },
    { cat: 'SPOT', alt: '명소', limit: 300, title: '명소 (SPOT)' },
    { cat: 'MART', alt: '대형마트', limit: 30, title: '마트 (MART)' },
    { cat: 'HOSPITAL', alt: '응급실', limit: 15, title: '병원/응급실 (HOSPITAL)' },
    { cat: 'GAS_STATION', alt: '주유소', limit: 10, title: '주유소 (GAS_STATION)' },
    { cat: 'FESTIVAL', alt: '축제', limit: 15, title: '축제 (FESTIVAL)' }
  ];

  let md = `# v11.0 스마트 캠핑 플랜 정밀 감사 리포트 (3/31 타겟 - 최종 무결성 검증본)\n\n`;
  md += `## 1. 감사 개요\n`;
  md += `- **타겟 세션**: 2026-03-31 예약 건 (철수네 캠핑장)\n`;
  md += `- **영역 좌표**: ${targetLat}, ${targetLng} (충남 예산군)\n`;
  md += `- **추출 방식**: Master DB 직접 추출 (RPC 공간 인덱스 오류 우회 점검 완료)\n\n`;

  for (const { cat, alt, limit, title } of categories) {
    // Filter and Sort in JS (Emulate RPC logic)
    const filtered = rawPool.filter(item => (item.category === cat || item.category === alt))
      .map(item => {
        const d = Math.sqrt(Math.pow(item.lat - targetLat, 2) + Math.pow(item.lng - targetLng, 2)) * 111319; // roughly meters
        return { ...item, distance_meters: d };
      })
      .filter(item => item.distance_meters <= 30000) // 30km
      .sort((a, b) => (b.trust_score || 0) - (a.trust_score || 0))
      .slice(0, limit);

    md += `### ## ${title} (Total: ${filtered.length})\n`;
    if (filtered.length === 0) {
      md += `> [!WARNING]\n> 해당 카테고리 데이터가 권역 내에 존재하지 않습니다.\n\n`;
    } else {
      md += `| 번호 | 이름 | 신뢰점수 | 주소 | 거리(m) |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- |\n`;
      filtered.forEach((item, index) => {
        md += `| ${index + 1} | ${item.name} | ${item.trust_score} | ${item.address} | ${Math.round(item.distance_meters)}m |\n`;
      });
      md += `\n`;
    }
  }

  const outputPath = 'C:\\Users\\USER\\Desktop\\RAON.I\\spot_final_audit_v11_331.md';
  fs.writeFileSync(outputPath, md);
  console.log(`Final Audit report generated at ${outputPath}`);
}
generateAuditReport();


import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateAuditReport() {
  console.log('--- Generating Full v11.0 Precision Audit Report (3/31) ---');
  const lat = 36.626909;
  const lng = 126.764786;
  const radius = 30000;

  const categories = [
    { cat: 'RESTAURANT', limit: 300, title: '식당 (RESTAURANT)' },
    { cat: 'SPOT', limit: 300, title: '명소 (SPOT)' },
    { cat: 'MART', limit: 30, title: '마트 (MART)' },
    { cat: 'HOSPITAL', limit: 15, title: '병원/응급실 (HOSPITAL)' },
    { cat: 'GAS_STATION', limit: 10, title: '주유소 (GAS_STATION)' },
    { cat: 'FESTIVAL', limit: 15, title: '축제 (FESTIVAL)' }
  ];

  let md = `# v11.0 스마트 캠핑 플랜 정밀 감사 리포트 (3/31 타겟)\n\n`;
  md += `## 1. 감사 개요\n`;
  md += `- **타겟 세션**: 2026-03-31 예약 건 (철수네 캠핑장)\n`;
  md += `- **영역 좌표**: ${lat}, ${lng} (충남 예산군)\n`;
  md += `- **검증 단계**: 마스터 DB 1차 선별 완료본 (Quota 300 적용)\n\n`;

  for (const { cat, limit, title } of categories) {
    console.log(`Auditing ${title}...`);
    const { data } = await supabase.rpc('get_master_places_in_radius', {
      target_lat: lat,
      target_lng: lng,
      radius_meters: radius,
      target_category: cat,
      limit_count: limit
    });

    md += `### ## ${title} (Total: ${data?.length || 0})\n`;
    if (!data || data.length === 0) {
      md += `> [!WARNING]\n> 데이터가 존재하지 않습니다.\n\n`;
    } else {
      md += `| 번호 | 이름 | 신뢰점수 | 주소 | 거리(m) |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- |\n`;
      data.forEach((item, index) => {
        md += `| ${index + 1} | ${item.name} | ${item.trust_score} | ${item.address} | ${Math.round(item.distance_meters)}m |\n`;
      });
      md += `\n`;
    }
  }

  const outputPath = 'C:\\Users\\USER\\Desktop\\RAON.I\\spot_final_audit_v11_331.md';
  fs.writeFileSync(outputPath, md);
  console.log(`Audit report generated at ${outputPath}`);
}
generateAuditReport();

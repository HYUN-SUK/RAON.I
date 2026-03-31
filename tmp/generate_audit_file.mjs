import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function generateAuditList() {
    console.log("Generating spot_final_audit.md for 2026-04-02...");
    
    // 2026-04-02에 해당하는 최근 적재된 전수 리스트 추출 (식당/명소 중심)
    const { data, error } = await supabase
        .from('smart_plan_facts')
        .select('api_source, name, trust_score, address, lat, lng, category')
        .in('category', ['RESTAURANT', 'SPOT', 'MART'])
        .order('trust_score', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    let markdown = "# RAONAI v11.5 전용 스마트 플랜 정밀 감사 리스트 (Quota 300)\n\n";
    markdown += "| 번호 | 카테고리 | 이름 | 신뢰점수 | 주소 | api_source |\n";
    markdown += "| :--- | :--- | :--- | :---: | :--- | :--- |\n";

    data.slice(0, 300).forEach((item, index) => {
        markdown += `| ${index + 1} | ${item.category} | ${item.name} | **${item.trust_score}** | ${item.address} | ${item.api_source} |\n`;
    });

    fs.writeFileSync('spot_final_audit.md', markdown);
    console.log("Successfully generated spot_final_audit.md");
}

generateAuditList();

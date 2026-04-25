import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
    const { data, error } = await supabase.from('master_places')
        .select('name, address, category')
        .eq('category', 'HOSPITAL');
    
    if (error) {
        console.error(error);
        return;
    }

    const topTier = data.filter(h => /종합병원|의료원|대학병원|응급의료/.test(h.name));
    
    let md = '# 전국 권역응급센터 / 종합병원 / 의료원 리스트 (100점 부여 대상)\n\n';
    md += `총 ${topTier.length}개의 주요 의료기관이 확인되었습니다.\n\n`;
    md += '| 이름 | 주소 |\n';
    md += '| :--- | :--- |\n';
    topTier.forEach(h => {
        md += `| ${h.name} | ${h.address} |\n`;
    });
    
    fs.writeFileSync('master_hospital_top_tier.md', md, 'utf8');
    console.log('✅ Generated master_hospital_top_tier.md');
}
run();

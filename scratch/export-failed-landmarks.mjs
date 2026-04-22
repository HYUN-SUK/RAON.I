import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getCleanString(str) {
    if (!str) return '';
    return String(str).replace(/[^a-z0-9가-힣]/gi, '').toLowerCase();
}

async function exportFailedLandmarks() {
    console.log('--- [Exporting Failed Landmarks] Final Audit after Injection ---');

    const auditData = JSON.parse(fs.readFileSync('final_smart_audit_report.json', 'utf8'));
    const uniquePrestige = auditData.gaps; // Original gaps (893 items) before enrichment

    // 1. Fetch updated Master Data to see what's still missing
    let allMasterSpots = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase.from('master_places').select('name, sigungu, sido').eq('category', 'SPOT').range(page * 1000, (page + 1) * 1000 - 1);
        if (error || !data || data.length === 0) break;
        allMasterSpots.push(...data);
        page++;
    }

    const dbItems = allMasterSpots.map(m => ({
        clean: getCleanString(m.name),
        sigungu: (m.sigungu || '').replace(/[시군구]$/, '')
    }));

    // 2. Identify remaining gaps
    const finalGaps = uniquePrestige.filter(p => {
        const cleanP = getCleanString(p.name);
        const pSigungu = (p.sigungu || '').replace(/[시군구]$/, '');
        
        return !dbItems.some(db => (db.clean === cleanP || db.clean.includes(cleanP) || cleanP.includes(db.clean)) && (db.sigungu.includes(pSigungu) || pSigungu.includes(db.sigungu) || !pSigungu));
    });

    // 3. Format to Markdown
    let md = '# [RAON.I] 주입 실패 프리스티지 명소 리스트\n\n';
    md += `> [!WARNING]\n`;
    md += `> 본 리스트는 2026-04-22 보강 작업 후에도 마스터 디비에 적재되지 못한 **${finalGaps.length}개**의 항목입니다.\n`;
    md += `> 주된 원인: 카카오 API 검색 결과 부재 또는 명칭의 극심한 불일치\n\n`;
    md += '| 티어 | 지역 | 명소 명칭 | 비고 |\n';
    md += '| :--- | :--- | :--- | :--- |\n';
    
    finalGaps.forEach(g => {
        md += `| Tier ${g.tier} | ${g.sigungu} | ${g.name} | 검색결과없음 |\n`;
    });

    fs.writeFileSync('failed_prestige_landmarks.md', md);
    console.log(`✅ File created: failed_prestige_landmarks.md (${finalGaps.length} items)`);
}

exportFailedLandmarks().catch(console.error);

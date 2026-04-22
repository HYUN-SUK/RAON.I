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

async function absoluteFinalAuditReport() {
    console.log('--- [Absolute Final Audit] Final Stats & Reports ---');

    const t1 = fs.readFileSync('korea_tourism_100_official.md', 'utf8');
    const t2 = fs.readFileSync('regional_8_sceneries_FULL.md', 'utf8');

    const rawPrestigeList = [];
    let currentSido = '', currentSigungu = '';
    t1.split('\n').forEach(line => {
        const h2 = line.match(/^## \d+\. (.+?)( |$)/);
        if (h2) currentSido = h2[1].trim();
        const h3 = line.match(/^### (.+?)( |\(|$)/);
        if (h3) currentSigungu = h3[1].trim();
        if (line.startsWith('- ')) {
            const raw = line.replace('- ', '').trim();
            const names = raw.includes('5대 고궁') ? ['경복궁', '창덕궁', '창경궁', '덕수궁', '경희궁'] : [raw.split('(')[0].trim()];
            names.forEach(n => rawPrestigeList.push({ name: n, tier: 1, sigungu: currentSigungu || currentSido }));
        }
    });

    let t2Sigungu = '';
    t2.split('\n').forEach(line => {
        const h3 = line.match(/^### (.+)$/);
        if (h3) t2Sigungu = h3[1].split('(')[0].trim();
        else if (line.startsWith('- ') && t2Sigungu) {
            line.replace('- ', '').split(',').map(n => n.trim()).filter(n => n).forEach(n => rawPrestigeList.push({ name: n, tier: 2, sigungu: t2Sigungu }));
        }
    });

    const prestigeMap = new Map();
    rawPrestigeList.forEach(p => {
        const clean = getCleanString(p.name);
        if (!prestigeMap.has(clean)) prestigeMap.set(clean, p);
    });
    const uniquePrestige = Array.from(prestigeMap.values());

    // 1. Fetch ALL Master SPOT Data
    let allMasterSpots = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase.from('master_places').select('name, sigungu, sido, lat, lng').eq('category', 'SPOT').range(page * 1000, (page + 1) * 1000 - 1);
        if (error || !data || data.length === 0) break;
        allMasterSpots.push(...data);
        page++;
    }

    const dbItems = allMasterSpots.map(m => ({
        clean: getCleanString(m.name),
        loc: (m.sido + ' ' + m.sigungu).substring(0, 5)
    }));

    // 2. Final Matching
    const matched = [];
    const gaps = [];
    uniquePrestige.forEach(p => {
        const cleanP = getCleanString(p.name);
        const match = dbItems.find(db => db.clean === cleanP || db.clean.includes(cleanP) || cleanP.includes(db.clean));
        if (match) matched.push({ name: p.name, tier: p.tier });
        else gaps.push(p);
    });

    // 3. Generate Report
    const summary = {
        total: uniquePrestige.length,
        matched: matched.length,
        gaps: gaps.length,
        rate: ((matched.length / uniquePrestige.length) * 100).toFixed(1) + '%'
    };

    let md = '# [RAON.I] 프리스티지 랜드마크 통합 최종 감사 리포트\n\n';
    md += `## 1. 데이터 통합 요약\n`;
    md += `| 항목 | 수량 | 비율 |\n| :--- | :--- | :--- |\n`;
    md += `| 전체 고유 랜드마크 | ${summary.total}개 | 100% |\n`;
    md += `| ✅ 매칭 성공 (확보됨) | ${summary.matched}개 | ${summary.rate} |\n`;
    md += `| ❌ 최종 누락 (검색불가) | ${summary.gaps}개 | ${(100 - parseFloat(summary.rate)).toFixed(1)}% |\n\n`;

    md += `## 2. 예산/홍성 지역 매칭 상태 (핵심 명소)\n`;
    md += `| 지역 | 명소 명칭 | 상태 |\n| :--- | :--- | :--- |\n`;
    const targetArea = ['예산', '홍성'];
    uniquePrestige.filter(p => targetArea.some(a => p.sigungu.includes(a))).forEach(p => {
        const isMatched = matched.some(m => m.name === p.name);
        md += `| ${p.sigungu} | ${p.name} | ${isMatched ? '✅ 확보완료' : '❌ 누락'} |\n`;
    });

    md += `\n## 3. 최종 누락 리스트 (추상 명칭 및 사자성어 등)\n`;
    md += `| 티어 | 지역 | 명소 명칭 | 비고 |\n| :--- | :--- | :--- | :--- |\n`;
    gaps.forEach(g => {
        md += `| Tier ${g.tier} | ${g.sigungu} | ${g.name} | 위치불명/사자성어 |\n`;
    });

    fs.writeFileSync('FINAL_PRESTIGE_AUDIT_REPORT.md', md);
    console.log(`✨ Final Report Created: FINAL_PRESTIGE_AUDIT_REPORT.md`);
}

absoluteFinalAuditReport().catch(console.error);

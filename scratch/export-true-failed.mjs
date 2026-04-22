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

async function exportTrueFailedLandmarks() {
    console.log('--- [Exporting True Failed Landmarks] Relaxed Matching ---');

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

    // 1. Fetch ALL Master SPOT Data
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
        sido: (m.sido || '').substring(0, 2),
        sigungu: (m.sigungu || '').replace(/[시군구]$/, '')
    }));

    // 2. Relaxed Matching (Name First)
    const trueGaps = [];
    rawPrestigeList.forEach(p => {
        const cleanP = getCleanString(p.name);
        const pLoc = (p.sigungu || '').substring(0, 2);

        const match = dbItems.find(db => {
            const nameMatch = (db.clean === cleanP || db.clean.includes(cleanP) || cleanP.includes(db.clean));
            if (!nameMatch) return false;
            
            // Location check: At least Sido or Sigungu should overlap if name is generic
            if (cleanP.length <= 2) {
                return (db.sido.includes(pLoc) || db.sigungu.includes(pLoc) || pLoc.includes(db.sido));
            }
            return true; 
        });

        if (!match) trueGaps.push(p);
    });

    // 3. Format to Markdown
    let md = '# [RAON.I] 최종 주입 실패 명소 리스트 (정밀 재검색 결과)\n\n';
    md += `> [!IMPORTANT]\n`;
    md += `> 지역 명칭 차이(` + '`서울` vs `종로구`' + `)를 무시하고 **이름 중심으로 재매칭**한 결과입니다.\n`;
    md += `> 아래 리스트는 정말로 디비에 없거나, 카카오 API로도 찾을 수 없었던 **${trueGaps.length}개**의 항목입니다.\n\n`;
    md += '| 티어 | 지역 | 명소 명칭 | 상태 |\n';
    md += '| :--- | :--- | :--- | :--- |\n';
    
    trueGaps.forEach(g => {
        md += `| Tier ${g.tier} | ${g.sigungu} | ${g.name} | 데이터부재 |\n`;
    });

    fs.writeFileSync('true_failed_landmarks.md', md);
    console.log(`✅ File created: true_failed_landmarks.md (${trueGaps.length} items)`);
}

exportTrueFailedLandmarks().catch(console.error);

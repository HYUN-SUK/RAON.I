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

function getSidoShort(sido) {
    if (!sido) return '';
    return sido.substring(0, 2);
}

async function absoluteFinalAudit() {
    console.log('--- [Absolute Final Audit] Sido-Level Hierarchical Matching ---');

    const rawPrestigeList = [];
    const t1 = fs.readFileSync('korea_tourism_100_official.md', 'utf8');
    const t2 = fs.readFileSync('regional_8_sceneries_FULL.md', 'utf8');

    // 1. Parsing & Unique
    let currentSido = '', currentSigungu = '';
    t1.split('\n').forEach(line => {
        const h2 = line.match(/^## \d+\. (.+?)( |$)/);
        if (h2) currentSido = h2[1].trim();
        const h3 = line.match(/^### (.+?)( |\(|$)/);
        if (h3) currentSigungu = h3[1].trim();
        if (line.startsWith('- ')) {
            const raw = line.replace('- ', '').trim();
            const names = raw.includes('5대 고궁') ? ['경복궁', '창덕궁', '창경궁', '덕수궁', '경희궁'] : [raw.split('(')[0].trim()];
            names.forEach(n => rawPrestigeList.push({ name: n, tier: 1, sido: currentSido, sigungu: currentSigungu }));
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

    // 2. Fetch Master
    let allMasterSpots = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase.from('master_places').select('id, name, sigungu, sido, category').eq('category', 'SPOT').range(page * 1000, (page + 1) * 1000 - 1);
        if (error || !data || data.length === 0) break;
        allMasterSpots.push(...data);
        page++;
    }

    // 3. Hierarchical Matching Logic
    const matched = [];
    const gaps = [];

    uniquePrestige.forEach(p => {
        const cleanP = getCleanString(p.name);
        const pSidoShort = getSidoShort(p.sido || p.sigungu); // Use sigungu if sido is missing (for Tier 1)
        const pSigunguNorm = (p.sigungu || '').replace(/[시군구]$/, '');

        let match = allMasterSpots.find(m => {
            const cleanM = getCleanString(m.name);
            const isNameMatch = (cleanM === cleanP || cleanM.includes(cleanP) || cleanP.includes(cleanM));
            if (!isNameMatch) return false;

            const mSidoShort = getSidoShort(m.sido);
            const mSigunguNorm = (m.sigungu || '').replace(/[시군구]$/, '');

            // Rule A: Sido must match if both have it
            if (pSidoShort && mSidoShort && pSidoShort !== mSidoShort) return false;

            // Rule B: If Landmark has specific Sigungu, try to match it. 
            // BUT if Landmark sigungu is just a Sido name (like '서울특별시'), ignore sigungu check.
            if (pSigunguNorm && !['서울', '인천', '대전', '대구', '광주', '부산', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'].includes(pSigunguNorm)) {
                if (mSigunguNorm && !mSigunguNorm.includes(pSigunguNorm) && !pSigunguNorm.includes(mSigunguNorm)) return false;
            }

            return true;
        });

        if (match) matched.push({ landmark: p.name, dbName: match.name, status: 'MATCHED' });
        else gaps.push(p);
    });

    const report = {
        summary: {
            total_unique_prestige: uniquePrestige.length,
            matched_count: matched.length,
            gap_count: gaps.length,
            coverage: ((matched.length / uniquePrestige.length) * 100).toFixed(1) + '%'
        },
        matched_samples: matched.slice(0, 50),
        gap_samples: gaps.slice(0, 50),
        gaps: gaps
    };

    fs.writeFileSync('absolute_final_audit_report.json', JSON.stringify(report, null, 2));
    
    console.log(`\n--- [Absolute Final Audit Summary] ---`);
    console.log(`- 전체 랜드마크: ${report.summary.total_unique_prestige}개`);
    console.log(`- ✅ 매칭 성공: ${report.summary.matched_count}개`);
    console.log(`- ❌ 최종 누락: ${report.summary.gap_count}개`);
}

absoluteFinalAudit().catch(console.error);

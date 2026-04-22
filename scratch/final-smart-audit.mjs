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

async function finalSmartAudit() {
    console.log('--- [Final Smart Audit] Hierarchical Matching & De-duplication ---');

    const rawPrestigeList = [];
    const t1 = fs.readFileSync('korea_tourism_100_official.md', 'utf8');
    const t2 = fs.readFileSync('regional_8_sceneries_FULL.md', 'utf8');

    // 1. Parsing & De-duplication
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

    // De-duplicate by name (keep Tier 1)
    const prestigeMap = new Map();
    rawPrestigeList.forEach(p => {
        const clean = getCleanString(p.name);
        if (!prestigeMap.has(clean) || p.tier < prestigeMap.get(clean).tier) {
            prestigeMap.set(clean, p);
        }
    });
    const uniquePrestige = Array.from(prestigeMap.values());
    console.log(`🚀 Unique Landmarks: ${uniquePrestige.length}`);

    // 2. Fetch Master Data
    console.log(`📥 Fetching Master Data...`);
    let allMasterSpots = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase.from('master_places').select('id, name, sigungu, sido, address, category').eq('category', 'SPOT').range(page * 1000, (page + 1) * 1000 - 1);
        if (error || !data || data.length === 0) break;
        allMasterSpots.push(...data);
        page++;
    }

    // 3. Hierarchical Matching
    const matched = [];
    const gaps = [];

    uniquePrestige.forEach(p => {
        const cleanP = getCleanString(p.name);
        if (cleanP.length < 2) return;

        const pSido = p.sido ? p.sido.replace(/[특별시|광역시|특별자치시|특별자치도]$/, '').substring(0, 2) : '';
        const pSigungu = p.sigungu ? p.sigungu.replace(/[시|군|구]$/, '') : '';

        let match = allMasterSpots.find(m => {
            const cleanM = getCleanString(m.name);
            const isNameMatch = (cleanM === cleanP || cleanM.includes(cleanP) || cleanP.includes(cleanM));
            if (!isNameMatch) return false;

            // Location Validation
            const mSido = (m.sido || '').substring(0, 2);
            const mSigungu = (m.sigungu || '').replace(/[시|군|구]$/, '');

            // If landmark has Sido, DB must match Sido
            if (pSido && mSido && !mSido.includes(pSido)) return false;
            
            // If landmark has Sigungu, DB must match Sigungu
            if (pSigungu && mSigungu && !mSigungu.includes(pSigungu) && !pSigungu.includes(mSigungu)) return false;

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
        matched_samples: matched.slice(0, 30),
        gap_samples: gaps.slice(0, 30),
        gaps: gaps
    };

    fs.writeFileSync('final_smart_audit_report.json', JSON.stringify(report, null, 2));
    
    console.log(`\n--- [Final Smart Audit Summary] ---`);
    console.log(`- 고유 랜드마크 대상: ${report.summary.total_unique_prestige}개`);
    console.log(`- ✅ 매칭 성공: ${report.summary.matched_count}개`);
    console.log(`- ❌ 최종 누락: ${report.summary.gap_count}개`);
    console.log(`- 결과 파일: final_smart_audit_report.json\n`);
}

finalSmartAudit().catch(console.error);

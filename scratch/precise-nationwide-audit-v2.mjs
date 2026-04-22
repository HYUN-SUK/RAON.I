import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getCleanString(str) {
    if (!str) return '';
    // Preserve only Hangul and Numbers
    return String(str).replace(/[^가-힣0-9]/g, '');
}

async function preciseNationwideAuditV2() {
    console.log('--- [Precise Nationwide Audit v2] Bug Fixed & Logic Enhanced ---');

    const prestigeList = [];
    const t1 = fs.readFileSync('korea_tourism_100_official.md', 'utf8');
    const t2 = fs.readFileSync('regional_8_sceneries_FULL.md', 'utf8');

    // 1. Unified Parsing
    let currentSido = '', currentSigungu = '';
    t1.split('\n').forEach(line => {
        const h2 = line.match(/^## \d+\. (.+?)( |$)/);
        if (h2) currentSido = h2[1].trim();
        const h3 = line.match(/^### (.+?)( |\(|$)/);
        if (h3) currentSigungu = h3[1].trim();
        if (line.startsWith('- ')) {
            const raw = line.replace('- ', '').trim();
            const names = raw.includes('5대 고궁') ? ['경복궁', '창덕궁', '창경궁', '덕수궁', '경희궁'] : [raw.split('(')[0].trim()];
            names.forEach(n => prestigeList.push({ name: n, tier: 1, sigungu: currentSigungu || currentSido }));
        }
    });

    let t2Sigungu = '';
    t2.split('\n').forEach(line => {
        const h3 = line.match(/^### (.+)$/);
        if (h3) t2Sigungu = h3[1].split('(')[0].trim();
        else if (line.startsWith('- ') && t2Sigungu) {
            line.replace('- ', '').split(',').map(n => n.trim()).filter(n => n).forEach(n => prestigeList.push({ name: n, tier: 2, sigungu: t2Sigungu }));
        }
    });

    // 2. Fetch Master Data
    console.log(`📥 Fetching all Master SPOT data...`);
    let allMasterSpots = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase.from('master_places').select('id, name, sigungu, address, category').eq('category', 'SPOT').range(page * 1000, (page + 1) * 1000 - 1);
        if (error || !data || data.length === 0) break;
        allMasterSpots.push(...data);
        page++;
    }

    // 3. Precise Matching
    const matched = [];
    const gaps = [];

    prestigeList.forEach((p, idx) => {
        const cleanP = getCleanString(p.name);
        const normSigungu = p.sigungu.replace(/[시군구]$/, '');

        if (!cleanP) { gaps.push(p); return; }

        let match = allMasterSpots.find(m => {
            const cleanM = getCleanString(m.name);
            if (!cleanM) return false;
            
            const isNameMatch = (cleanM === cleanP || cleanM.includes(cleanP) || cleanP.includes(cleanM));
            if (!isNameMatch) return false;

            const mSigungu = (m.sigungu || '').replace(/[시군구]$/, '');
            // Only match if Sigungu also overlaps partially
            return (mSigungu.includes(normSigungu) || normSigungu.includes(mSigungu) || !mSigungu);
        });

        if (match) {
            matched.push({ landmark: p.name, dbName: match.name, dbSigungu: match.sigungu, status: 'MATCHED' });
        } else {
            gaps.push(p);
        }
    });

    const report = {
        summary: {
            total_prestige: prestigeList.length,
            total_master_spot: allMasterSpots.length,
            matched_count: matched.length,
            gap_count: gaps.length,
            coverage: ((matched.length / prestigeList.length) * 100).toFixed(1) + '%'
        },
        matched_samples: matched.slice(0, 30),
        gap_samples: gaps.slice(0, 30),
        gaps: gaps
    };

    fs.writeFileSync('precise_audit_report_v2.json', JSON.stringify(report, null, 2));
    
    console.log(`\n--- [Audit Report v2 Summary] ---`);
    console.log(`- 전체 프리스티지 대상: ${report.summary.total_prestige}개`);
    console.log(`- ✅ 매칭 성공: ${report.summary.matched_count}개`);
    console.log(`- ❌ 최종 누락: ${report.summary.gap_count}개`);
    console.log(`- 리포트: precise_audit_report_v2.json\n`);
}

preciseNationwideAuditV2().catch(console.error);

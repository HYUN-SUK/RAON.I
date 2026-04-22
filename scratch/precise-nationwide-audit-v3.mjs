import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getCleanString(str) {
    if (!str) return '';
    // Keep Hangul, English, and Numbers. Lowercase everything.
    return String(str).replace(/[^a-z0-9가-힣]/gi, '').toLowerCase();
}

async function preciseNationwideAuditV3() {
    console.log('--- [Precise Nationwide Audit v3] Final Precision Logic ---');

    const prestigeList = [];
    const t1 = fs.readFileSync('korea_tourism_100_official.md', 'utf8');
    const t2 = fs.readFileSync('regional_8_sceneries_FULL.md', 'utf8');

    // 1. Parsing
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
    console.log(`📥 Fetching Master Data...`);
    let allMasterSpots = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase.from('master_places').select('id, name, sigungu, address, category').eq('category', 'SPOT').range(page * 1000, (page + 1) * 1000 - 1);
        if (error || !data || data.length === 0) break;
        allMasterSpots.push(...data);
        page++;
    }

    // 3. Precision Matching
    const matched = [];
    const gaps = [];

    prestigeList.forEach((p, idx) => {
        const cleanP = getCleanString(p.name);
        const normSigungu = p.sigungu.replace(/[시군구]$/, '');

        if (cleanP.length < 2) { gaps.push(p); return; }

        let match = allMasterSpots.find(m => {
            const cleanM = getCleanString(m.name);
            if (cleanM.length < 2) return false;
            
            // Precise Match: Exact or Inclusion
            const isNameMatch = (cleanM === cleanP || cleanM.includes(cleanP) || cleanP.includes(cleanM));
            if (!isNameMatch) return false;

            const mSigungu = (m.sigungu || '').replace(/[시군구]$/, '');
            // Sigungu must match if both exist
            if (mSigungu && normSigungu) {
                return (mSigungu.includes(normSigungu) || normSigungu.includes(mSigungu));
            }
            return true; // Match if sigungu info is missing in DB
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
        matched_samples: matched.slice(0, 50),
        gap_samples: gaps.slice(0, 50),
        gaps: gaps
    };

    fs.writeFileSync('precise_audit_report_v3.json', JSON.stringify(report, null, 2));
    
    console.log(`\n--- [Audit Report v3 Summary] ---`);
    console.log(`- 전체 프리스티지 대상: ${report.summary.total_prestige}개`);
    console.log(`- ✅ 매칭 성공: ${report.summary.matched_count}개`);
    console.log(`- ❌ 최종 누락: ${report.summary.gap_count}개`);
    console.log(`- 결과 파일: precise_audit_report_v3.json\n`);
}

preciseNationwideAuditV3().catch(console.error);

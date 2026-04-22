import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getCleanString(str) {
    if (!str) return '';
    // Aggressive cleaning: only hangul and numbers
    return String(str).replace(/[^가-힣0-9]/g, '');
}

async function preciseNationwideAudit() {
    console.log('--- [Precise Nationwide Audit] Matching 2,000+ Landmarks with 12,700 Master Data ---');

    // 1. Load All Prestige Landmarks (2,070 items)
    const prestigeList = [];
    const t1 = fs.readFileSync('korea_tourism_100_official.md', 'utf8');
    const t2 = fs.readFileSync('regional_8_sceneries_FULL.md', 'utf8');

    // Parsing logic (same as before but unified)
    let currentSido = '', currentSigungu = '';
    t1.split('\n').forEach(line => {
        const sidoMatch = line.match(/^## \d+\. (.+?)( |$)/);
        if (sidoMatch) currentSido = sidoMatch[1].trim();
        const sigunguMatch = line.match(/^### (.+?)( |\(|$)/);
        if (sigunguMatch) currentSigungu = sigunguMatch[1].trim();
        if (line.startsWith('- ')) {
            const raw = line.replace('- ', '').trim();
            const names = raw.includes('5대 고궁') ? ['경복궁', '창덕궁', '창경궁', '덕수궁', '경희궁'] : [raw.split('(')[0].trim()];
            names.forEach(n => prestigeList.push({ name: n, tier: 1, sigungu: currentSigungu || currentSido }));
        }
    });

    let t2Sigungu = '';
    t2Content.split('\n').forEach(line => {
        const h3Match = line.match(/^### (.+)$/);
        if (h3Match) t2Sigungu = h3Match[1].split('(')[0].trim();
        else if (line.startsWith('- ') && t2Sigungu) {
            line.replace('- ', '').split(',').map(n => n.trim()).filter(n => n).forEach(n => prestigeList.push({ name: n, tier: 2, sigungu: t2Sigungu }));
        }
    });

    // 2. Fetch ALL 12,700 Master SPOT Data (Paged)
    console.log(`📥 Fetching all Master SPOT data...`);
    let allMasterSpots = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase.from('master_places').select('id, name, sigungu, address, category').eq('category', 'SPOT').range(page * 1000, (page + 1) * 1000 - 1);
        if (error || !data || data.length === 0) break;
        allMasterSpots.push(...data);
        page++;
    }
    console.log(`✅ Loaded ${allMasterSpots.length} Master SPOT records.`);

    // 3. Matching Engine (with correction logic)
    const matched = [];
    const gaps = [];
    
    prestigeList.forEach((p, idx) => {
        const cleanP = getCleanString(p.name);
        const normSigungu = p.sigungu.replace(/[시군구]$/, '');
        
        // Match 1: Direct Clean Match
        let match = allMasterSpots.find(m => {
            const cleanM = getCleanString(m.name);
            const mSigungu = (m.sigungu || '').replace(/[시군구]$/, '');
            return (cleanM === cleanP || cleanM.includes(cleanP) || cleanP.includes(cleanM)) && (mSigungu.startsWith(normSigungu) || normSigungu.startsWith(mSigungu));
        });

        // Match 2: Name match without sigungu (Broad check for correction)
        if (!match) {
            match = allMasterSpots.find(m => {
                const cleanM = getCleanString(m.name);
                return (cleanM === cleanP || (cleanP.length > 2 && cleanM.includes(cleanP)));
            });
            if (match) match.note = '명칭 유사 (지역 상이 가능성)';
        }

        if (match) {
            matched.push({ landmark: p.name, dbName: match.name, dbSigungu: match.sigungu, status: 'MATCHED', note: match.note || '정상' });
        } else {
            gaps.push(p);
        }
        
        if ((idx + 1) % 500 === 0) console.log(`  Processed ${idx + 1}/${prestigeList.length}...`);
    });

    // 4. Report Generation
    const report = {
        summary: {
            total_prestige: prestigeList.length,
            total_master_spot: allMasterSpots.length,
            matched_count: matched.length,
            gap_count: gaps.length,
            coverage: ((matched.length / prestigeList.length) * 100).toFixed(1) + '%'
        },
        matched_samples: matched.slice(0, 20),
        gap_samples: gaps.slice(0, 20),
        gaps: gaps // Full list for the user
    };

    fs.writeFileSync('precise_audit_report.json', JSON.stringify(report, null, 2));
    
    console.log(`\n--- [Audit Report Summary] ---`);
    console.log(`- 전체 프리스티지 대상: ${report.summary.total_prestige}개`);
    console.log(`- 마스터 디비 명소(SPOT): ${report.summary.total_master_spot}개`);
    console.log(`- ✅ 매칭 성공 (보정 포함): ${report.summary.matched_count}개`);
    console.log(`- ❌ 최종 누락 (추가 필요): ${report.summary.gap_count}개`);
    console.log(`- 결과 파일: precise_audit_report.json\n`);
}

// Fixed t2Content loading inside the function
const t2Content = fs.readFileSync('regional_8_sceneries_FULL.md', 'utf8');

preciseNationwideAudit().catch(console.error);

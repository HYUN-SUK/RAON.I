import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getCleanString(str) {
    if (!str) return '';
    // Remove parentheses, special chars, and whitespace
    return String(str).replace(/\(.+?\)/g, '').replace(/[^a-zA-Z0-9가-힣]/g, '').toLowerCase();
}

function normalizeSigungu(str) {
    if (!str) return '';
    // Remove '시', '군', '구' suffix for looser matching
    return str.replace(/[시군구]$/, '').trim();
}

async function nationwideGapCheckV2() {
    console.log('--- [Nationwide Gap Analysis v2] Looser Matching ---');

    const tier1File = 'korea_tourism_100_official.md';
    const tier2File = 'regional_8_sceneries_FULL.md';
    const prestigeList = [];

    // 1. Parsing Tier 1
    const t1Content = fs.readFileSync(tier1File, 'utf8');
    let currentSido = '', currentSigungu = '';
    t1Content.split('\n').forEach(line => {
        const sidoMatch = line.match(/^## \d+\. (.+?) /);
        if (sidoMatch) currentSido = sidoMatch[1];
        const sigunguMatch = line.match(/^### (.+?) \(/);
        if (sigunguMatch) currentSigungu = sigunguMatch[1];
        if (line.startsWith('- ')) {
            let namePart = line.replace('- ', '').trim();
            if (namePart.includes('5대 고궁')) {
                ['경복궁', '창덕궁', '창경궁', '덕수궁', '경희궁'].forEach(p => 
                    prestigeList.push({ name: p, tier: 1, sigungu: currentSigungu || currentSido }));
            } else {
                const cleanName = namePart.split('(')[0].trim();
                prestigeList.push({ name: cleanName, tier: 1, sigungu: currentSigungu || currentSido });
            }
        }
    });

    // 2. Parsing Tier 2
    const t2Content = fs.readFileSync(tier2File, 'utf8');
    t2Content.split('\n').forEach(line => {
        const match = line.match(/^- \*\*(.+?)\(.+?\):\*\* (.+)$/);
        if (match) {
            const rawSigungu = match[1].trim();
            const sigungu = rawSigungu.replace(/군$/, ''); // 예산군 -> 예산
            const names = match[2].split(',').map(n => n.trim()).filter(n => n);
            names.forEach(n => prestigeList.push({ name: n, tier: 2, sigungu }));
        }
    });

    console.log(`🚀 Total Landmarks to check: ${prestigeList.length}`);

    const gaps = [];
    const matched = [];

    // Group by Normalized Sigungu
    const groups = {};
    prestigeList.forEach(p => {
        const norm = normalizeSigungu(p.sigungu);
        if (!groups[norm]) groups[norm] = [];
        groups[norm].push(p);
    });

    for (const [normSigungu, list] of Object.entries(groups)) {
        process.stdout.write(`\r- Checking ${normSigungu}...`);
        
        // Fetch all spots in this sigungu (using ilike for sigungu)
        const { data, error } = await supabase
            .from('master_places')
            .select('name, sigungu')
            .ilike('sigungu', `${normSigungu}%`)
            .eq('category', 'SPOT');

        if (error) {
            console.error(`Error fetching ${normSigungu}:`, error);
            continue;
        }

        const dbItems = (data || []).map(d => ({
            cleanName: getCleanString(d.name),
            rawName: d.name
        }));
        
        list.forEach(p => {
            const cleanP = getCleanString(p.name);
            const found = dbItems.find(db => db.cleanName.includes(cleanP) || cleanP.includes(db.cleanName));
            
            if (found) {
                matched.push({ ...p, matchedWith: found.rawName });
            } else {
                gaps.push(p);
            }
        });
    }

    console.log(`\n\n--- Analysis Result (v2) ---`);
    console.log(`✅ Matched: ${matched.length}`);
    console.log(`❌ Gaps (Missing in DB): ${gaps.length}`);
    
    if (gaps.length > 0) {
        fs.writeFileSync('prestige_gaps_v2.json', JSON.stringify(gaps, null, 2));
        console.log(`\nFull gap list saved to: prestige_gaps_v2.json`);
    }
}

nationwideGapCheckV2().catch(console.error);

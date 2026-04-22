import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getCleanString(str) {
    if (!str) return '';
    return String(str).replace(/\(.+?\)/g, '').replace(/\s+/g, '').toLowerCase();
}

async function nationwideGapCheck() {
    console.log('--- [Nationwide Gap Analysis] Tier 1 & 2 vs Master DB ---');

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
                    prestigeList.push({ name: p, tier: 1, sigungu: currentSigungu }));
            } else {
                const cleanName = namePart.split('(')[0].trim();
                prestigeList.push({ name: cleanName, tier: 1, sigungu: currentSigungu });
            }
        }
    });

    // 2. Parsing Tier 2 (Fixed Regex for current format)
    const t2Content = fs.readFileSync(tier2File, 'utf8');
    t2Content.split('\n').forEach(line => {
        // Match "- **시군구명 (경칭):** 명소1, 명소2..."
        const match = line.match(/^- \*\*(.+?)군?\(.+?\):\*\* (.+)$/);
        if (match) {
            const sigungu = match[1].trim();
            const names = match[2].split(',').map(n => n.trim()).filter(n => n);
            names.forEach(n => prestigeList.push({ name: n, tier: 2, sigungu }));
        }
    });

    console.log(`🚀 Total Landmarks to check: ${prestigeList.length}`);

    // 3. Gap Checking (Batch query to avoid massive individual requests)
    const gaps = [];
    const matched = [];

    // Group by Sigungu for efficient DB querying
    const groups = {};
    prestigeList.forEach(p => {
        if (!groups[p.sigungu]) groups[p.sigungu] = [];
        groups[p.sigungu].push(p);
    });

    for (const [sigungu, list] of Object.entries(groups)) {
        process.stdout.write(`\r- Checking ${sigungu}...`);
        const { data, error } = await supabase
            .from('master_places')
            .select('name, sigungu')
            .eq('sigungu', sigungu)
            .eq('category', 'SPOT');

        if (error) {
            console.error(`Error fetching ${sigungu}:`, error);
            continue;
        }

        const dbNames = new Set((data || []).map(d => getCleanString(d.name)));
        
        list.forEach(p => {
            if (dbNames.has(getCleanString(p.name))) {
                matched.push(p);
            } else {
                gaps.push(p);
            }
        });
    }

    console.log(`\n\n--- Analysis Result ---`);
    console.log(`✅ Matched: ${matched.length}`);
    console.log(`❌ Gaps (Missing in DB): ${gaps.length}`);
    
    if (gaps.length > 0) {
        console.log(`\nSample Gaps:`);
        gaps.slice(0, 10).forEach(g => console.log(`- [Tier ${g.tier}] ${g.sigungu}: ${g.name}`));
        
        // Write full gaps to file for review
        fs.writeFileSync('prestige_gaps_full.json', JSON.stringify(gaps, null, 2));
        console.log(`\nFull gap list saved to: prestige_gaps_full.json`);
    }
}

nationwideGapCheck().catch(console.error);

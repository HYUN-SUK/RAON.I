import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getCleanString(str) {
    if (!str) return '';
    return String(str).replace(/\(.+?\)/g, '').replace(/[^a-zA-Z0-9가-힣]/g, '').toLowerCase();
}

function normalizeSigungu(str) {
    if (!str) return '';
    return str.replace(/[시군구]$/, '').trim();
}

async function nationwideFullAudit() {
    console.log('--- [Nationwide FULL Audit] Correct Parsing ---');

    const tier1File = 'korea_tourism_100_official.md';
    const tier2File = 'regional_8_sceneries_FULL.md';
    const prestigeList = [];

    // 1. Parsing Tier 1 (100선)
    const t1Content = fs.readFileSync(tier1File, 'utf8');
    let currentSido = '';
    let currentSigungu = '';
    t1Content.split('\n').forEach(line => {
        const sidoMatch = line.match(/^## \d+\. (.+?)( |$)/);
        if (sidoMatch) currentSido = sidoMatch[1].trim();
        const sigunguMatch = line.match(/^### (.+?)( |\(|$)/);
        if (sigunguMatch) currentSigungu = sigunguMatch[1].trim();
        
        if (line.startsWith('- ')) {
            const rawNames = line.replace('- ', '').trim();
            let names = [];
            if (rawNames.includes('5대 고궁')) names = ['경복궁', '창덕궁', '창경궁', '덕수궁', '경희궁'];
            else names = [rawNames.split('(')[0].trim()];
            
            names.forEach(n => {
                prestigeList.push({ name: n, tier: 1, sigungu: currentSigungu || currentSido });
            });
        }
    });

    // 2. Parsing Tier 2 (전국 8경/10경 - Correct Format)
    const t2Content = fs.readFileSync(tier2File, 'utf8');
    let t2Sigungu = '';
    t2Content.split('\n').forEach(line => {
        const h3Match = line.match(/^### (.+)$/);
        if (h3Match) {
            t2Sigungu = h3Match[1].split('(')[0].trim();
        } else if (line.startsWith('- ') && t2Sigungu) {
            const names = line.replace('- ', '').split(',').map(n => n.trim()).filter(n => n);
            names.forEach(n => {
                prestigeList.push({ name: n, tier: 2, sigungu: t2Sigungu });
            });
        }
    });

    console.log(`🚀 Total Prestige Landmarks Parsed: ${prestigeList.length}`);
    
    if (prestigeList.length < 2000) {
        console.warn(`⚠️ Warning: Parsed count (${prestigeList.length}) is lower than expected (2000+). Check parsing logic.`);
    }

    // Grouping for DB Check
    const groups = {};
    prestigeList.forEach(p => {
        const norm = normalizeSigungu(p.sigungu);
        if (!groups[norm]) groups[norm] = [];
        groups[norm].push(p);
    });

    const gaps = [];
    const matched = [];

    console.log(`🔍 Checking against Master DB (12.7k entries)...`);
    
    for (const [normSigungu, list] of Object.entries(groups)) {
        process.stdout.write(`\r- Processing ${normSigungu} (${list.length} items)...`);
        
        const { data, error } = await supabase
            .from('master_places')
            .select('name, sigungu')
            .ilike('sigungu', `${normSigungu}%`)
            .eq('category', 'SPOT');

        if (error) {
            console.error(`Error fetching ${normSigungu}:`, error);
            continue;
        }

        const dbItems = (data || []).map(d => getCleanString(d.name));
        
        list.forEach(p => {
            const cleanP = getCleanString(p.name);
            const found = dbItems.some(db => db.includes(cleanP) || cleanP.includes(db));
            if (found) matched.push(p);
            else gaps.push(p);
        });
    }

    console.log(`\n\n--- Final Audit Result ---`);
    console.log(`✅ Matched: ${matched.length}`);
    console.log(`❌ Gaps: ${gaps.length}`);
    console.log(`📈 Coverage: ${((matched.length / prestigeList.length) * 100).toFixed(1)}%`);

    fs.writeFileSync('prestige_full_audit_list.json', JSON.stringify({ matched, gaps }, null, 2));
    console.log(`\nAudit list saved to: prestige_full_audit_list.json`);
}

nationwideFullAudit().catch(console.error);

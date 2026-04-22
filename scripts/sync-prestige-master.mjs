import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const normalize = (str) => (str || '').replace(/\s/g, '').replace(/충남/g, '충청남도').replace(/경북/g, '경상북도').replace(/경남/g, '경상남도').replace(/전북/g, '전라북도').replace(/전남/g, '전라남도').replace(/충북/g, '충청북도').replace(/\*\*.*?\*\*/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9가-힣]/gi, '').toLowerCase();

async function syncPrestigeMaster() {
    console.log('📖 Loading reference landmark lists (Tier 2 ONLY)...');
    const t2 = fs.readFileSync('regional_8_sceneries_FULL.md', 'utf-8');

    const prestigeList = []; // { name, sigungu, tier }

    // Tier 2 Parsing ONLY
    let currentSigungu = '';
    t2.split('\n').forEach(l => {
        const h3 = l.match(/^### (.+?)(?:\s+\(|$)/);
        const listMatch = l.match(/^- \*\*(.+?)(?:\(.+?\))?:\*\*\s+(.+)$/);
        if (h3) {
            currentSigungu = h3[1].trim().replace(/[시군구]$/, '');
        } else if (listMatch) {
            const sigungu = listMatch[1].trim().replace(/[시군구]$/, '');
            const names = listMatch[2].split(',').map(n => n.trim());
            names.forEach(n => prestigeList.push({ name: n, sigungu, tier: 2 }));
        } else if (l.startsWith('- ') && currentSigungu) {
            const names = l.replace('- ', '').split(',').map(n => n.trim());
            names.forEach(n => prestigeList.push({ name: n, sigungu: currentSigungu, tier: 2 }));
        }
    });

    console.log(`✅ Loaded ${prestigeList.length} landmark definitions from files.`);

    console.log('📡 Fetching Master SPOT records for matching...');
    const { data: masterSpots, error } = await supabase.from('master_places').select('*').eq('category', 'SPOT');
    if (error) { console.error(error); return; }

    const updatePack = [];
    const newPack = [];

    prestigeList.forEach(p => {
        const pName = normalize(p.name);
        const pSig = normalize(p.sigungu);
        
        const match = masterSpots.find(m => {
            const mName = normalize(m.name);
            const mSig = normalize(m.sigungu || (m.address || '').split(' ')[1] || '');
            return mName === pName && (mSig.includes(pSig) || pSig.includes(mSig));
        }) || masterSpots.find(m => normalize(m.name) === pName);

        if (match) {
            const currentTier = match.raw_data ? match.raw_data.tier : null;
            if (currentTier !== p.tier) {
                updatePack.push({
                    ...match,
                    raw_data: { ...(match.raw_data || {}), tier: p.tier },
                    api_source: 'TOUR_SPOT' // Ensure it's marked as master source
                });
            }
        } else {
            // New Landmark to add
            newPack.push({
                name: p.name,
                category: 'SPOT',
                api_source: 'TOUR_SPOT',
                address: `${p.sigungu} 일대`,
                lat: 0, lng: 0, // Should be updated later via Kakao enrichment
                raw_data: { tier: p.tier },
                trust_score: 50
            });
        }
    });

    console.log(`🚀 Syncing to DB: ${updatePack.length} updates, ${newPack.length} new additions...`);

    if (updatePack.length > 0) {
        for (let i = 0; i < updatePack.length; i += 50) {
            await supabase.from('master_places').upsert(updatePack.slice(i, i + 50));
        }
    }
    if (newPack.length > 0) {
        await supabase.from('master_places').insert(newPack);
    }

    console.log('✨ Synchronization Complete!');
}

syncPrestigeMaster();

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

async function syncPrestigeMetadata() {
    console.log('--- [Prestige Metadata Synchronizer] Tagging Tier 1/2 in Master DB ---');

    // 1. Load MD Lists
    const t1 = fs.readFileSync('korea_tourism_100_official.md', 'utf8');
    const t2 = fs.readFileSync('regional_8_sceneries_FULL.md', 'utf8');

    const prestigeList = [];
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

    console.log(`🚀 Total ${prestigeList.length} landmark references loaded.`);

    // 2. Fetch All SPOTs from Master DB
    let totalUpdated = 0;
    let page = 0;
    while (true) {
        const { data: spots, error } = await supabase
            .from('master_places')
            .select('id, name, sigungu, raw_data')
            .eq('category', 'SPOT')
            .range(page * 1000, (page + 1) * 1000 - 1);

        if (error || !spots || spots.length === 0) break;

        const batch = [];
        for (const spot of spots) {
            const cleanSpotName = getCleanString(spot.name);
            const spotSigungu = (spot.sigungu || '').replace(/[시군구]$/, '');
            
            // Find Match
            const match = prestigeList.find(p => {
                const cleanPName = getCleanString(p.name);
                const pSigungu = p.sigungu.replace(/[시군구]$/, '');
                return (cleanSpotName === cleanPName || cleanSpotName.includes(cleanPName) || cleanPName.includes(cleanSpotName)) 
                        && (spotSigungu === pSigungu || spotSigungu.includes(pSigungu));
            });

            const currentTier = spot.raw_data?.prestige_tier || null;
            const newTier = match ? match.tier : null;

            if (currentTier !== newTier) {
                const updatedRaw = { ...(spot.raw_data || {}), prestige_tier: newTier };
                batch.push({ id: spot.id, raw_data: updatedRaw });
                totalUpdated++;
            }
        }

        if (batch.length > 0) {
            await supabase.from('master_places').upsert(batch, { onConflict: 'id' });
        }

        process.stdout.write(`\rProcessed: ${(page + 1) * 1000} | Tags Updated: ${totalUpdated}`);
        page++;
    }

    console.log(`\n\n✨ Prestige Metadata Sync Completed. Total ${totalUpdated} tags updated.`);
}

syncPrestigeMetadata().catch(console.error);

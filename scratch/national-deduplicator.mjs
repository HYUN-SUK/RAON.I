import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getCleanString(str) {
    if (!str) return '';
    return String(str).replace(/\s+/g, '').replace(/[^a-z0-9가-힣]/gi, '').toLowerCase();
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

async function nationalDeduplicator() {
    console.log('--- [National Master Deduplicator] Cleaning up Twin Data ---');

    let page = 0;
    const allSpots = [];
    
    // 1. Fetch All Active SPOTs (Nationwide)
    while (true) {
        const { data, error } = await supabase
            .from('master_places')
            .select('id, name, lat, lng, trust_score, raw_data, sigungu')
            .eq('category', 'SPOT')
            .eq('is_active', true)
            .range(page * 1000, (page + 1) * 1000 - 1);

        if (error || !data || data.length === 0) break;
        allSpots.push(...data);
        process.stdout.write(`\rLoaded: ${allSpots.length} spots...`);
        page++;
    }
    console.log('\n✅ Loading finished. Analyzing duplicates...');

    const deactivateIds = new Set();
    const clusters = new Map();

    // 2. Group by Normalized Name
    allSpots.forEach(s => {
        const key = getCleanString(s.name) + '|' + (s.sigungu || '').replace(/[시군구]$/, '');
        if (!clusters.has(key)) clusters.set(key, []);
        clusters.get(key).push(s);
    });

    let totalDuplicates = 0;
    for (const [key, items] of clusters.entries()) {
        if (items.length < 2) continue;

        // 3. Coordinate check within each name cluster
        const sortedItems = [...items].sort((a, b) => {
            // Priority: Prestige Tier > Trust Score > Recent (ID based)
            const tierA = a.raw_data?.prestige_tier || 0;
            const tierB = b.raw_data?.prestige_tier || 0;
            if (tierB !== tierA) return tierB - tierA;
            return (b.trust_score || 0) - (a.trust_score || 0);
        });

        const master = sortedItems[0];
        for (let i = 1; i < sortedItems.length; i++) {
            const current = sortedItems[i];
            const dist = getDistance(master.lat, master.lng, current.lat, current.lng);
            
            if (dist < 150) { // 150m radius for deduplication
                deactivateIds.add(current.id);
                totalDuplicates++;
            }
        }
    }

    console.log(`🚀 Found ${totalDuplicates} duplicates to deactivate.`);

    // 4. Batch Deactivate
    const idsToDeactivate = Array.from(deactivateIds);
    for (let i = 0; i < idsToDeactivate.length; i += 200) {
        const chunk = idsToDeactivate.slice(i, i + 200);
        await supabase
            .from('master_places')
            .update({ is_active: false })
            .in('id', chunk);
        process.stdout.write(`\rDeactivating: ${i + chunk.length}/${idsToDeactivate.length}`);
    }

    console.log(`\n\n✨ National Deduplication Completed. ${totalDuplicates} items deactivated.`);
}

nationalDeduplicator().catch(console.error);

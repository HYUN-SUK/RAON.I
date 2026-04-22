import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyHybridEngine() {
    console.log('🧪 Simulating Hybrid Engine v2.6 (Spot Category)...');
    
    // Target: A camping site in Yongin, Gyeonggi (Near Everland)
    const lat = 37.2939; 
    const lng = 127.2025;
    const radius = 30000; // 30km

    console.log(`- Scanning spots within 30km of [${lat}, ${lng}]...`);

    const { data: spots, error } = await supabase.rpc('get_master_places_in_radius_v2', {
        p_lat: lat,
        p_lng: lng,
        p_radius_meters: radius,
        p_category: 'SPOT'
    });

    if (error) {
        console.error('RPC Error:', error.message);
        return;
    }

    console.log(`- Found ${spots.length} spots. Applying Hybrid v2.6 Logic...`);

    // In-memory version of the engine logic
    const inScoreMap = new Map();
    const freqMap = new Map();
    const nameToId = new Map();
    spots.forEach(x => nameToId.set(x.name.trim(), x.id));

    spots.forEach(spot => {
        const relations = spot.raw_data?.tmap_related || [];
        relations.forEach(rel => {
            const targetId = nameToId.get(rel.target.trim());
            if (targetId) {
                const score = 1 / Math.log2(rel.rank + 1);
                inScoreMap.set(targetId, (inScoreMap.get(targetId) || 0) + score);
                freqMap.set(targetId, (freqMap.get(targetId) || 0) + 1);
            }
        });
    });

    const sortedRawRelated = spots.map(s => {
        const relatedSum = inScoreMap.get(s.id) || 0;
        const freq = freqMap.get(s.id) || 0;
        return { id: s.id, val: relatedSum * (1 + Math.log1p(freq)) };
    }).sort((a,b) => b.val - a.val);

    const scored = spots.map(spot => {
        // Prestige (60%)
        let prestigeScore = 15;
        const tier = spot.raw_data?.prestige?.tier;
        if (tier === 1) prestigeScore = 100;
        else if (tier === 2) prestigeScore = 80;

        // Popularity (40%)
        let ktoScore = 10;
        const ktoRank = spot.raw_data?.kto_official?.rank;
        if (ktoRank && ktoRank <= 100) {
            ktoScore = 100 * (1 - (ktoRank - 1) / 100);
        } else {
            const tmapRank = sortedRawRelated.findIndex(x => x.id === spot.id);
            ktoScore = ((sortedRawRelated.length - 1 - tmapRank) / Math.max(1, sortedRawRelated.length - 1)) * 100;
        }

        const tmapIdx = sortedRawRelated.findIndex(x => x.id === spot.id);
        const tmapScore = ((sortedRawRelated.length - 1 - tmapIdx) / Math.max(1, sortedRawRelated.length - 1)) * 100;
        const ktScore = parseFloat(spot.raw_data?.kt_concentration || spot.raw_data?.popularity_v2?.base_pop || 10);

        const combinedPop = (ktoScore * 0.6) + (tmapScore * 0.2) + (ktScore * 0.2);
        const hasRel = (spot.raw_data?.tmap_related?.length > 0) ? 0.4 : 0;
        const hasConc = (spot.raw_data?.kt_concentration > 0 || spot.raw_data?.popularity_v2?.base_pop > 0) ? 0.3 : 0;
        const hasPrestige = tier ? 0.3 : 0;
        const confMultiplier = 0.80 + (0.20 * (hasRel + hasConc + hasPrestige));

        const qualityScore = (prestigeScore * 0.6) + (combinedPop * 0.4);
        const trustScore = Math.round(qualityScore * confMultiplier);
        
        // Final Score with Distance Penalty (0.5/km)
        const distKm = (spot.distance_meters || 0) / 1000;
        const finalScore = parseFloat((trustScore - (distKm * 0.5)).toFixed(2));

        return { 
            name: spot.name, 
            tier: tier || 'N/A', 
            prestigeScore, 
            combinedPop: combinedPop.toFixed(1),
            trustScore, 
            distKm: distKm.toFixed(1), 
            finalScore 
        };
    }).sort((a,b) => b.finalScore - a.finalScore);

    console.log('\n--- Top 20 Recommendations (Hybrid v2.6) ---');
    console.table(scored.slice(0, 20));
}

verifyHybridEngine().catch(console.error);

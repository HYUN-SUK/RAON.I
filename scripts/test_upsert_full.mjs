import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import proj4 from 'proj4';
import { v5 as uuidv5 } from 'uuid';

dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const generateFactId = (source, name, address) => uuidv5(`${source}|${String(name).trim()}|${String(address).trim()}`, MY_NAMESPACE);

async function testFilterAndUpsert() {
    const targetLat = 36.626; 
    const targetLng = 126.83; 

    // Simulation of Route.ts candidates
    const { data: dbItems } = await supabase.rpc('get_master_places_in_radius', {
        target_lat: targetLat, target_lng: targetLng, radius_meters: 30000, limit_count: 500
    });
    
    let candidates = dbItems || [];
    const getDist = (lat, lng) => {
        const R = 6371; const dLat = (lat - targetLat) * Math.PI / 180; const dLon = (lng - targetLng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(targetLat*Math.PI/180) * Math.cos(lat*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };
    candidates.forEach(c => c._dist = getDist(c.lat, c.lng));

    const selectedCandidates = [];

    const marts = candidates.filter(c => c.category === 'MART').map(c => {
        let s = 0;
        if (c.name.match(/이마트|홈플러스|롯데마트|트레이더스|에브리데이|익스프레스/)) s += 50;
        else if (c.name.match(/하나로마트|탑마트|메가마트|농협/)) s += 40;
        else if (c.name.match(/식자재|도매|마트/)) s += 20;
        const ar = c.raw_data?.ar ? parseFloat(c.raw_data.ar) : 0;
        if (ar > 3000) s += 10; else if (ar > 1000) s += 5;
        s += Math.max(0, (1 - (c._dist / 20.0)) * 40);
        return { ...c, _sortScore: s };
    }).sort((a,b) => b._sortScore - a._sortScore).slice(0, 15);
    selectedCandidates.push(...marts);

    ['SPOT', 'FESTIVAL', 'HOSPITAL'].forEach(cat => {
        const list = candidates.filter(c => c.category === cat)
                               .sort((a,b) => a._dist - b._dist)
                               .slice(0, 15);
        selectedCandidates.push(...list);
    });

    const gasFiltered = candidates.filter(c => c.category === 'GAS_STATION').sort((a,b) => {
        const pA = a.raw_data?.K_PRICE ? parseFloat(a.raw_data.K_PRICE) : 99999;
        const pB = b.raw_data?.K_PRICE ? parseFloat(b.raw_data.K_PRICE) : 99999;
        if (pA === pB) return a._dist - b._dist;
        return pA - pB;
    }).slice(0, 10);
    selectedCandidates.push(...gasFiltered);

    const rests = candidates.filter(c => c.category === 'RESTAURANT').sort((a,b) => {
        const tA = a.trust_score || 0; const tB = b.trust_score || 0;
        if (tA === tB) return a._dist - b._dist;
        return tB - tA;
    }).slice(0, 20);
    selectedCandidates.push(...rests);

    // Mock Kakao
    const allFacts = [];
    const categoriesToEnrich = ['HOSPITAL', 'FESTIVAL', 'RESTAURANT', 'SPOT', 'MART', 'GAS_STATION'];

    for (const cat of categoriesToEnrich) {
        const catCands = selectedCandidates.filter(c => c.category === cat);
        if (catCands.length === 0) continue;

        const enrichedResults = await Promise.all(catCands.map(async (cand) => {
            return {
                id: generateFactId('MASTER_ENRICHED', cand.name, cand.address),
                api_source: 'MASTER_ENRICHED', category: cand.category,
                name: cand.name, address: cand.address, lat: cand.lat, lng: cand.lng,
                trust_score: Math.min(cand.trust_score || 50, 100),
                description: cand.description || '',
                raw_data: { ...cand.raw_data, kakao_matched: false }
            };
        }));
        allFacts.push(...enrichedResults.filter(Boolean));
    }

    const validFacts = allFacts.filter(f => f.name && !isNaN(f.lat) && !isNaN(f.lng));
    console.log(`Trying to upsert ${validFacts.length} facts to smart_plan_facts...`);
    if (validFacts.length > 0) {
        const { error } = await supabase.from('smart_plan_facts').upsert(validFacts, { onConflict: 'id' });
        console.log("Upsert Error:", error);
    }
}
testFilterAndUpsert();

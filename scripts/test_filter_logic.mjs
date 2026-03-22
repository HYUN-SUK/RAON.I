import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testFilter() {
    const targetLat = 36.6575; 
    const targetLng = 126.6853;
    const { data: dbItems } = await supabase.rpc('get_master_places_in_radius', {
        target_lat: targetLat, target_lng: targetLng, radius_meters: 30000, limit_count: 50
    });
    
    let candidates = dbItems || [];
    console.log("Initial Candidates:", candidates.length);

    const getDist = (lat, lng) => {
        const R = 6371; const dLat = (lat - targetLat) * Math.PI / 180; const dLon = (lng - targetLng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(targetLat*Math.PI/180) * Math.cos(lat*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };
    candidates.forEach(c => c._dist = getDist(c.lat, c.lng));

    const selectedCandidates = [];

    const marts = candidates.filter(c => c.category === 'MART').slice(0, 15);
    selectedCandidates.push(...marts);
    console.log("Marts selected:", marts.length);

    ['SPOT', 'FESTIVAL', 'HOSPITAL'].forEach(cat => {
        const list = candidates.filter(c => c.category === cat).slice(0, 15);
        selectedCandidates.push(...list);
        console.log(`${cat} selected:`, list.length);
    });

    const rests = candidates.filter(c => c.category === 'RESTAURANT').slice(0, 20);
    selectedCandidates.push(...rests);
    console.log("Restaurants selected:", rests.length);

    console.log("Total Selected Candidates:", selectedCandidates.length);

    // Mock Enrichment
    const enrichedResults = await Promise.all(selectedCandidates.map(async (cand) => {
        const kakaoKey = process.env.KAKAO_REST_API_KEY;
        if (!kakaoKey) { console.log("Missing kakao key!"); return null; }
        
        // Simulating the fallback
        return {
            id: cand.id, api_source: cand.api_source, category: cand.category,
            name: cand.name, address: cand.address, lat: cand.lat, lng: cand.lng,
            trust_score: cand.trust_score || 50, description: cand.description || ''
        };
    }));

    const validEnriched = enrichedResults.filter(Boolean);
    console.log("Valid Enriched:", validEnriched.length);

    const validFacts = validEnriched.filter(f => f.name && !isNaN(f.lat) && !isNaN(f.lng));
    console.log("Valid Facts to Upsert:", validFacts.length);
    
    // Check if they are valid
    if(validFacts.length > 0) {
        console.log("Sample 1 valid facts id type:", typeof validFacts[0].id, validFacts[0].id);
    }
}
testFilter();


import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// We'll import directly or re-define if import fails due to TS/JS issues
// But since we exported them, it should work if we use the correct path.
// Actually, let's just re-implement the logic here to be absolutely sure and transparent in the report.

function calcContextFitDeep(f: any, weather: string, isWinter: boolean, persona: any): number {
    let score = 25; // Base contextFit
    const name = f.name || '';
    const desc = f.description || (f.raw_data?.description) || '';
    const text = name + ' ' + desc;

    const adults = persona.guestDetails?.adults || 2;
    const seniors = persona.guestDetails?.seniors || 0;
    const kids = persona.guestDetails?.kids || { preschool: 0, elementary: 0, teen: 0 };
    const hasKids = kids.preschool > 0 || kids.elementary > 0 || kids.teen > 0;
    const hasPet = persona.guestDetails?.hasPet || false;
    const isCouple = adults === 2 && seniors === 0 && !hasKids;

    // 1. Weather
    if (weather.includes('비') || weather.includes('눈')) {
        if (text.match(/탕|찌개|칼국수|국밥|전골/)) score += 20;
        if (text.match(/박물관|실내|미술관/)) score += 20;
        if (f.category === 'SPOT' && !text.match(/박물관|실내|미술관/)) score -= 20;
    }
    if (weather.includes('맑음')) {
        if (text.match(/막국수|냉면|구이/)) score += 15;
        if (text.match(/수목원|둘레길|계곡|야외|산책/)) score += 15;
    }
    if (isWinter && f.category === 'GAS_STATION') score += 20;

    // 2. Persona
    if (hasKids) {
        if (f.category === 'HOSPITAL' && text.match(/소아과|아동병원/)) score += 50;
        if (text.match(/돈까스|피자|어린이|불고기|뷔페|놀이방/)) score += 30;
        if (f.category === 'SPOT' && text.match(/동물|목장|아쿠아리움|체험|공룡|생태|과학관/)) score += 30;
    }
    if (hasPet) {
        if (text.match(/애견동반|야외테라스|반려견|산책|운동장|해변|반려/)) score += 30;
    }
    if (seniors > 0) {
        if (text.match(/한정식|백숙|보양식|장어|한우|전통|향토/)) score += 30;
    }
    return Math.max(0, Math.min(100, score));
}

async function runVerification() {
    const userId = '4730be31-30b5-4594-a993-d8f5a7a5e26c';
    const scheduleId = '110e9047-ee12-4abd-98df-974ed57277e5';
    const location = { lat: 36.626909, lng: 126.7647868 };
    
    // [1] Context
    const { data: userData } = await supabase.from('reservations').select('guest_details').eq('user_id', userId).limit(1).single();
    const persona = { guestDetails: userData?.guest_details };
    const weatherSummary = '맑음'; // 4월 29일 예보 가정
    const isWinter = false;

    console.log('=== [1] Track A: Destination (Cached Today for D+3) ===');
    const { data: trackA } = await supabase.from('smart_plan_candidates').select('*').eq('reservation_id', scheduleId);
    
    if (trackA) {
        const results = trackA.map(c => {
            const cFit = calcContextFitDeep(c, weatherSummary, isWinter, persona);
            return {
                Name: c.name,
                Category: c.category,
                'Before Weight (Cached)': c.final_score.toFixed(1),
                'ContextFit': `+${cFit}`,
                'After Weight': (c.final_score + cFit).toFixed(1)
            };
        }).sort((a, b) => parseFloat(b['After Weight']) - parseFloat(a['After Weight']));
        console.table(results.slice(0, 15));
    }

    console.log('\n=== [2] Track B: Journey (Midpoint Real-time) ===');
    const midpoint = { lat: 36.626909, lng: 126.7647868 }; // Using same area for now
    const { data: rawB } = await supabase.rpc('get_master_places_in_radius_v2', {
        target_lat: midpoint.lat,
        target_lng: midpoint.lng,
        radius_meters: 10000,
        limit_count: 20,
        p_category: 'RESTAURANT'
    });

    if (rawB) {
        const resultsB = rawB.map((p: any) => {
            const cFit = calcContextFitDeep(p, weatherSummary, isWinter, persona);
            const quality = 50; // Base
            const distKm = p.distance_meters / 1000;
            const logistics = -(distKm * 3.0); // Restaurant Factor 3.0
            return {
                Name: p.name,
                Quality: quality,
                Logistics: logistics.toFixed(1),
                ContextFit: cFit,
                Total: (quality + logistics + cFit).toFixed(1)
            };
        }).sort((a: any, b: any) => parseFloat(b.Total) - parseFloat(a.Total));
        console.table(resultsB.slice(0, 15));
    }
}

runVerification().catch(console.error);

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

async function executeFullMetadataRepair() {
    console.log('🚀 Executing Full Master Metadata Repair for 강릉바다내음...\n');

    const gangneungResId = '6933ec4b-4646-46b0-a768-04d1d181f0cd';

    const { data: sched } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('id', gangneungResId)
        .single();

    const { data: cands } = await supabase
        .from('smart_plan_candidates')
        .select('*')
        .eq('reservation_id', gangneungResId);

    console.log(`Found ${cands.length} candidates for ${sched.campground_name}.`);

    const factIds = cands.map(c => c.fact_id);
    const { data: masterPlaces } = await supabase
        .from('master_places')
        .select('id, name, address, api_source, lat, lng, description, raw_data')
        .in('id', factIds);

    const masterMap = new Map((masterPlaces || []).map(m => [m.id, m]));

    const repaired = [];
    for (const cand of cands) {
        const mPlace = masterMap.get(cand.fact_id);
        const pLat = cand.lat || mPlace?.lat;
        const pLng = cand.lng || mPlace?.lng;

        if (pLat && pLng) {
            const distKm = haversineKm(sched.campground_lat, sched.campground_lng, pLat, pLng);
            const distMeters = Math.round(distKm * 1000);

            const oldBadges = cand?.raw_data?.badges || mPlace?.raw_data?.badges || [];
            const seeded = [];
            if (mPlace?.api_source === 'SAFE_RESTAURANT' || mPlace?.raw_data?.RELAX_SEQ != null || mPlace?.raw_data?.RELAX_USE_YN === 'Y' || cand?.raw_data?.RELAX_SEQ != null) {
                seeded.push('안심식당');
            }
            if (mPlace?.api_source === 'MOIS_GOOD_RESTAURANT') seeded.push('모범음식점');
            if (mPlace?.api_source === 'SMBA_BAEK') seeded.push('백년가게');
            if (mPlace?.api_source === 'LX_RESTAURANT') seeded.push('LX인증맛집');

            const mergedBadges = Array.from(new Set([...oldBadges, ...seeded]));
            const mergedRawData = {
                ...(mPlace?.raw_data || {}),
                ...(cand?.raw_data || {}),
                api_source: mPlace?.api_source || cand?.raw_data?.api_source || '',
                badges: mergedBadges,
                description: cand?.raw_data?.description || mPlace?.description || cand?.description || ''
            };

            const rowToUpsert = {
                id: cand.id,
                reservation_id: cand.reservation_id,
                fact_id: cand.fact_id,
                category: cand.category,
                name: mPlace?.name || cand.name,
                address: mPlace?.address || cand.address,
                lat: pLat,
                lng: pLng,
                quality_score: cand.quality_score,
                distance_meters: distMeters,
                penalty_score: cand.penalty_score,
                final_score: cand.final_score,
                raw_data: mergedRawData
            };

            repaired.push(rowToUpsert);
        }
    }

    console.log(`Repaired ${repaired.length} candidate rows with full Master DB metadata. Upserting into DB...`);
    for (let i = 0; i < repaired.length; i += 500) {
        const { error } = await supabase.from('smart_plan_candidates').upsert(repaired.slice(i, i + 500), { onConflict: 'reservation_id,fact_id' });
        if (error) console.error('Upsert Error:', error);
    }

    console.log('✅ Full Metadata Repair Complete!\n');

    // Verify 정동진해물탕
    const { data: verifyCand } = await supabase
        .from('smart_plan_candidates')
        .select('name, raw_data')
        .eq('reservation_id', gangneungResId)
        .ilike('name', '%정동진해물탕%')
        .single();

    console.log('=== Verified 정동진해물탕 after Full Metadata Repair ===');
    console.log('Name:', verifyCand.name);
    console.log('raw_data.api_source:', verifyCand.raw_data?.api_source);
    console.log('raw_data.badges:', verifyCand.raw_data?.badges);
    console.log('raw_data.RELAX_SEQ:', verifyCand.raw_data?.RELAX_SEQ);
}

executeFullMetadataRepair();

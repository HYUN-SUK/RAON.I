import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// smartPlan.ts의 로직을 그대로 가져와서 시뮬레이션
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function testGeneratePreview() {
    const lat = 35.1609477290535;
    const lng = 129.167194019805;
    const radiusMeters = 20000;

    const [restRes, spotRes, hospRes] = await Promise.all([
        supabase.rpc('get_master_places_in_radius_v2', {
            target_lat: lat,
            target_lng: lng,
            radius_meters: radiusMeters,
            limit_count: 300,
            p_category: 'RESTAURANT'
        }),
        supabase.rpc('get_master_places_in_radius_v2', {
            target_lat: lat,
            target_lng: lng,
            radius_meters: radiusMeters,
            limit_count: 300,
            p_category: 'SPOT'
        }),
        supabase.rpc('get_master_places_in_radius_v2', {
            target_lat: lat,
            target_lng: lng,
            radius_meters: radiusMeters,
            limit_count: 100,
            p_category: 'HOSPITAL'
        })
    ]);

    const rawRestaurants = restRes.data || [];
    const rawSpots = spotRes.data || [];
    const rawHospitals = hospRes.data || [];

    console.log(`RPC Return: rest=${rawRestaurants.length}, spot=${rawSpots.length}, hosp=${rawHospitals.length}`);

    const calcDist = (pLat, pLng) => {
        const R = 6371;
        const dLat = (pLat - lat) * (Math.PI / 180);
        const dLng = (pLng - lng) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat * (Math.PI / 180)) * Math.cos(pLat * (Math.PI / 180)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return parseFloat((R * c).toFixed(1));
    };

    const globalBlacklist = /정비|카센터|공업사|세차|타이어|배터리|공인중개사|부동산|장례|상조|종교|교회|사찰$|센터$|학원|관리소|사무소|지물포|건재|상사|유통|공구|이발|미용|세탁|철물|사진관|인쇄소|스튜디오|모텔|여관|호텔|약국|디지털|분재|연구소|양복|안경|서점|서적/;

    const parseAndScore = (places) => {
        return places
            .filter(r => {
                const name = r.name || '';
                if (r.category !== 'HOSPITAL' && globalBlacklist.test(name)) return false;
                return true;
            })
            .map(r => {
                const dKm = calcDist(r.lat, r.lng);
                let certBonus = 0;
                let baseScore = r.quality_score || 50;
                const source = r.api_source || '';

                if (r.category === 'RESTAURANT' || r.category === 'ROUTE_RESTAURANT') {
                    if (source === 'SMBA_BAEK') certBonus += 80;
                    if (source === 'LX_RESTAURANT') certBonus += 80;
                    if (source === 'MOIS_GOOD_RESTAURANT' || source === 'LOCALDATA_RESTAURANT_GOOD') certBonus += 30;
                    if (source === 'SAFE_RESTAURANT' || source === 'LOCALDATA_RESTAURANT_SAFE') certBonus += 20;

                    const distPenalty = dKm * 3.0;
                    const trustScore = baseScore + certBonus - distPenalty;

                    return {
                        id: r.id,
                        name: r.name,
                        category: 'RESTAURANT',
                        distanceKm: dKm,
                        trustScore
                    };
                }
                return null;
            }).filter(Boolean);
    };

    const scoredRest = parseAndScore(rawRestaurants);
    console.log(`Scored Restaurants count: ${scoredRest.length}`);
    scoredRest.sort((a, b) => (b.trustScore || 0) - (a.trustScore || 0));
    console.log(`Top 3 Restaurants:`, scoredRest.slice(0, 3));
}

testGeneratePreview();

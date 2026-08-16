import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function testHaeundaeDirect() {
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
        const seenIds = new Set();
        const uniqueById = places.filter(r => {
            if (seenIds.has(r.id)) return false;
            seenIds.add(r.id);
            return true;
        });

        const cleanName = (s) => (s || '').replace(/\[.*?\]|\(.*?\)/g, '').replace(/\s+/g, '').toLowerCase();
        const deduplicated = [];

        for (const item of uniqueById) {
            const n1 = cleanName(item.name);
            if (!n1) continue;

            let isDup = false;
            for (const existing of deduplicated) {
                const n2 = cleanName(existing.name);
                if (!n2) continue;

                const sameName = n1 === n2 || (n1.length >= 4 && n2.length >= 4 && (n1.includes(n2) || n2.includes(n1)));
                const distDiff = Math.abs(calcDist(item.lat, item.lng) - calcDist(existing.lat, existing.lng));
                
                if (sameName && distDiff < 1.0) {
                    isDup = true;
                    break;
                }
            }
            if (!isDup) {
                deduplicated.push(item);
            }
        }

        return deduplicated
            .filter(r => {
                const name = r.name || '';
                if (r.category !== 'HOSPITAL' && globalBlacklist.test(name)) return false;
                return true;
            })
            .map(r => {
                const dKm = calcDist(r.lat, r.lng);
                const name = r.name || '';
                const desc = r.description || r.raw_data?.description || '';
                const fullText = `${name} ${desc}`;
                const source = r.api_source || r.raw_data?.api_source || '';
                const rawBadges = r.badges || r.raw_data?.badges || [];

                let certBonus = 0;
                let whitelistBonus = 0;
                let distPenalty = 0;
                let baseScore = r.quality_score || 50;

                if (r.category === 'RESTAURANT' || r.category === 'ROUTE_RESTAURANT') {
                    if (source === 'SMBA_BAEK' || rawBadges.includes('백년가게')) certBonus += 80;
                    if (source === 'LX_RESTAURANT' || rawBadges.includes('LX인증맛집') || rawBadges.includes('LX인증')) certBonus += 80;
                    if (source === 'MOIS_GOOD_RESTAURANT' || source === 'LOCALDATA_RESTAURANT_GOOD' || rawBadges.includes('모범음식점')) certBonus += 30;
                    if (source === 'SAFE_RESTAURANT' || source === 'LOCALDATA_RESTAURANT_SAFE' || rawBadges.includes('안심식당')) certBonus += 20;

                    if (/미쉐린|미슐랭|블루리본|식신/.test(name)) {
                        if (baseScore + certBonus < 110) certBonus = Math.max(certBonus, 110 - baseScore);
                    }

                    distPenalty = dKm * 3.0;
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

    const restaurants = parseAndScore(rawRestaurants)
        .sort((a, b) => (b.trustScore || 0) - (a.trustScore || 0) || (a.distanceKm || 0) - (b.distanceKm || 0))
        .slice(0, 3);

    console.log('Result restaurants length:', restaurants.length);
    console.log('Top 1 restaurant:', restaurants[0]);
}

testHaeundaeDirect();

#!/usr/bin/env node
/**
 * @file caching-smart-plan.mjs
 * @version 11.0 (Hyper-Personalization Engine)
 * @description 스마트 캠핑 플랜 D-3 캐싱 고도화 스크립트. 
 * Vercel 타임아웃(5분)을 극복하고 식당/명소 쿼터를 300개로 대폭 확대하여 날씨/페르소나 개인화 품질을 극대화합니다.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';
import proj4 from 'proj4';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const OPINET_API_KEY = process.env.OPINET_API_KEY;
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

if (!SUPABASE_URL || !SUPABASE_KEY || !PUBLIC_API_KEY) {
    console.error('Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const fetchOptions = { headers: { 'User-Agent': 'Mozilla/5.0' } };
const generateFactId = (source, name, address) => uuidv5(`${source}|${String(name || '').trim()}|${String(address || '').trim()}`, MY_NAMESPACE);

/**
 * 카카오맵 상세페이지를 분석하여 별점과 리뷰 수를 추출합니다 (Scraper v11.0 port)
 */
async function scrapeKakaoPlace(url) {
    try {
        const placeIdMatch = url.match(/\/(\d+)$/);
        if (!placeIdMatch) return { rating: 0, reviewCount: 0, success: false };
        const placeId = placeIdMatch[1];
        const apiHeaders = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
            'Referer': `https://place.map.kakao.com/${placeId}`
        };

        const [mainRes, reviewRes] = await Promise.all([
            fetch(`https://place-api.map.kakao.com/places/panel3/${placeId}`, { headers: apiHeaders }),
            fetch(`https://place-api.map.kakao.com/places/reviews/kakaomap/meta/${placeId}`, { headers: apiHeaders })
        ]);

        let rating = 0, reviewCount = 0;
        if (mainRes.ok) {
            const mainData = await mainRes.json();
            if (mainData.basicInfo?.feedback?.score) rating = parseFloat(mainData.basicInfo.feedback.score);
        }
        if (reviewRes.ok) {
            const reviewData = await reviewRes.json();
            if (reviewData.reviewCount !== undefined) reviewCount = parseInt(reviewData.reviewCount, 10);
        }
        return { rating, reviewCount, success: rating > 0 || reviewCount > 0 };
    } catch (e) {
        return { rating: 0, reviewCount: 0, success: false };
    }
}

async function main() {
    const startTime = Date.now();
    console.log('🚀 RAONAI SMART PLAN CACHING ENGINE v11.0 (Hyper-Personalization)');

    // 1. 대상 예약(Target Reservations) 조회
    const now = new Date();
    const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const targetDate = new Date(kstNow);
    targetDate.setDate(kstNow.getDate() + 3);
    const targetStr = targetDate.toISOString().split('T')[0];
    
    console.log(`[Phase 1] Target Date: ${targetStr}`);

    const { data: schedules } = await supabase
        .from('user_schedules')
        .select('campground_lat, campground_lng, campground_name, campground_address')
        .eq('check_in', targetStr);

    if (!schedules || schedules.length === 0) {
        console.log('No reservations for D-3. Execution completed.');
        process.exit(0);
    }

    // 2. 지리적 클러스터링 (Geo-Clustering)
    const clusters = [];
    for (const s of schedules) {
        let lat = s.campground_lat, lng = s.campground_lng;
        if (!lat || !lng) continue; // Skip if no coords

        let found = false;
        for (const c of clusters) {
            const dist = Math.sqrt(Math.pow(c.lat - lat, 2) + Math.pow(c.lng - lng, 2));
            if (dist <= 0.2) { // 20km 병합
                if (!c.names.includes(s.campground_name)) c.names.push(s.campground_name);
                found = true; break;
            }
        }
        if (!found) clusters.push({ lat, lng, names: [s.campground_name], address: s.campground_address || '충청남도 예산군' });
    }
    console.log(`[Phase 2] Formed ${clusters.length} region clusters.`);

    const allFacts = [];
    const totalTracking = {
        stepA_dynamic: { HOSPITAL: 0, FESTIVAL: 0, GAS_STATION: 0 },
        stepB_filter: { MART: 0, SPOT: 0, FESTIVAL: 0, HOSPITAL: 0, GAS_STATION: 0, RESTAURANT: 0 },
        stepC_kakao_attempts: 0, stepC_kakao_success: 0
    };

    for (const cluster of clusters) {
        console.log(`\n📦 Processing Cluster: ${cluster.names[0]} (+${cluster.names.length - 1})`);
        const { lat: targetLat, lng: targetLng, address } = cluster;
        const addrParts = address.split(' ');
        const doNm = addrParts[0] || '충청남도';
        const sigunguNm = addrParts[1] || '예산군';

        const rawMasterInserts = [];

        // A-1. Hospital (NMC + Kakao HP8)
        try {
            const nmcRes = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${PUBLIC_API_KEY}&STAGE1=${encodeURIComponent(doNm)}&STAGE2=${encodeURIComponent(sigunguNm)}&pageNo=1&numOfRows=100&_type=json`, fetchOptions);
            const nmcData = await nmcRes.json();
            if (nmcData.response?.body?.items?.item) {
                const items = Array.isArray(nmcData.response.body.items.item) ? nmcData.response.body.items.item : [nmcData.response.body.items.item];
                items.forEach(item => {
                    rawMasterInserts.push({
                        id: generateFactId('NMC_HOSPITAL', item.dutyName, item.dutyAddr),
                        api_source: 'NMC_HOSPITAL', category: 'HOSPITAL',
                        name: item.dutyName, description: '응급실 가동 응급의료기관', address: item.dutyAddr,
                        lat: parseFloat(item.wgs84Lat), lng: parseFloat(item.wgs84Lon),
                        trust_score: item.dutyName?.includes('소아') ? 100 : 55, raw_data: item
                    });
                });
                totalTracking.stepA_dynamic.HOSPITAL += items.length;
            }
        } catch (e) {}

        // A-2. Festival
        try {
            const festRes = await fetch(`http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${PUBLIC_API_KEY}&numOfRows=50&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=15&mapX=${targetLng}&mapY=${targetLat}&radius=20000`, fetchOptions);
            const festData = await festRes.json();
            if (festData.response?.body?.items?.item) {
                const items = Array.isArray(festData.response.body.items.item) ? festData.response.body.items.item : [festData.response.body.items.item];
                items.forEach(item => {
                    rawMasterInserts.push({
                        id: generateFactId('TOUR_FSTVL', item.title, item.addr1),
                        api_source: 'TOUR_FSTVL', category: 'FESTIVAL',
                        name: item.title, description: '주변 로컬 축제/이벤트', address: item.addr1,
                        lat: parseFloat(item.mapy), lng: parseFloat(item.mapx), trust_score: 45, raw_data: item
                    });
                });
                totalTracking.stepA_dynamic.FESTIVAL += items.length;
            }
        } catch (e) {}

        // A-3. Gas Station (Opinet Kerosene v10.7 + Spiral Search & 3-Step Address Fallback)
        if (OPINET_API_KEY) {
            try {
                proj4.defs("TM128", "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43");
                const [wtmX, wtmY] = proj4("EPSG:4326", "TM128", [targetLng, targetLat]);
                const seenGas = new Set();
                const currentMonth = kstNow.getMonth() + 1;
                const isWinterSearch = [11, 12, 1, 2, 3].includes(currentMonth);
                const prodCode = 'C004'; // Kerosene

                // Spiral Search Logic (from Manual 4.4 + route.ts 5km Radius Consistency)
                const spiralShifts = [
                    [{x:0,y:0}], // 5km radius center
                    [{x:10000,y:0}, {x:-10000,y:0}, {x:0,y:10000}, {x:0,y:-10000}], 
                    [{x:20000,y:0}, {x:-20000,y:0}, {x:0,y:20000}, {x:0,y:-20000}, {x:15000,y:15000}, {x:-15000,y:15000}, {x:15000,y:-15000}, {x:-15000,y:-15000}],
                    [{x:30000,y:0}, {x:-30000,y:0}, {x:0,y:30000}, {x:0,y:-30000}]
                ];

                for (const group of spiralShifts) {
                    if (seenGas.size >= 15) break; 
                    const gasPromises = group.map(async s => {
                        const url = `http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_API_KEY}&x=${Math.round(wtmX+s.x)}&y=${Math.round(wtmY+s.y)}&radius=5000&sort=1&prodcd=${prodCode}&out=json`;
                        try {
                            const r = await fetch(url, fetchOptions);
                            return await r.json();
                        } catch (e) { return null; }
                    });
                    const results = await Promise.all(gasPromises);
                    
                    const gasGroupInserts = [];
                    for (const data of results) {
                        if (data?.RESULT?.OIL) {
                            const items = Array.isArray(data.RESULT.OIL) ? data.RESULT.OIL : [data.RESULT.OIL];
                            for (const item of items) {
                                const key = (item.OS_NM || 'NONE') + (item.VAN_ADR || 'ADDR');
                                if (!seenGas.has(key) && (item.PRICE || item.K_PRICE)) {
                                    seenGas.add(key);
                                    const [lon, lat] = proj4("TM128", "EPSG:4326", [parseFloat(item.GIS_X_COOR), parseFloat(item.GIS_Y_COOR)]);
                                    
                                    // 3-Step Address Fallback (from Manual 4.4)
                                    let finalAddr = item.VAN_ADR || item.NEW_ADR || '';
                                    if (!finalAddr && KAKAO_KEY && lat && lon) {
                                        try {
                                            const revRes = await fetch(`https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lon}&y=${lat}`, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } });
                                            const revData = await revRes.json();
                                            if (revData.documents?.[0]) {
                                                finalAddr = revData.documents[0].road_address?.address_name || revData.documents[0].address?.address_name || '';
                                            }
                                        } catch (e) {}
                                    }

                                    gasGroupInserts.push({
                                        id: generateFactId('OPINET_GAS', item.OS_NM, finalAddr || 'COORD_ONLY'),
                                        api_source: 'OPINET_GAS', category: 'GAS_STATION',
                                        name: item.OS_NM, description: `실내등유: ${item.PRICE || item.K_PRICE}원`, address: finalAddr,
                                        lat, lng: lon, trust_score: 55, raw_data: item
                                    });
                                }
                            }
                        }
                    }
                    if (gasGroupInserts.length > 0) rawMasterInserts.push(...gasGroupInserts);
                }
                totalTracking.stepA_dynamic.GAS_STATION += seenGas.size;
            } catch (e) { console.error("Gas Spiral Error:", e.message); }
        }

        // DB Upsert to master_places
        if (rawMasterInserts.length > 0) {
            const { error } = await supabase.from('master_places').upsert(rawMasterInserts, { onConflict: 'id' });
            if (error) console.error("MasterPlaces Upsert Error", error.message);
        }

        // Step B. 1차 선별 (Quota 300 Expansion for v11.0)
        const categories = [
            { cat: 'RESTAURANT', limit: 300 },
            { cat: 'SPOT', limit: 300 },
            { cat: 'MART', limit: 30 },
            { cat: 'FESTIVAL', limit: 30 },
            { cat: 'HOSPITAL', limit: 20 },
            { cat: 'GAS_STATION', limit: 20 }
        ];

        const clusterCandidates = [];
        for (const { cat, limit } of categories) {
            const { data } = await supabase.rpc('get_master_places_in_radius', {
                target_lat: targetLat, target_lng: targetLng, radius_meters: 30000, limit_count: limit, p_category: cat
            });
            if (data) clusterCandidates.push(...data);
        }

        // Step C. Kakao Verifier & Scraper (v11.0 Parallel with Concurrency Control)
        console.log(`[Step C] Enriching ${clusterCandidates.length} candidates using Kakao...`);
        
        const CHUNK_SIZE = 50; 
        for (let i = 0; i < clusterCandidates.length; i += CHUNK_SIZE) {
            const chunk = clusterCandidates.slice(i, i + CHUNK_SIZE);
            const enriched = await Promise.all(chunk.map(async (cand) => {
                try {
                    totalTracking.stepC_kakao_attempts++;
                    const kRes = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(cand.name)}&x=${cand.lng}&y=${cand.lat}&radius=5000`, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } });
                    const kData = await kRes.json();
                    const matched = kData.documents?.find(d => d.place_name.replace(/\s/g,'') === cand.name.replace(/\s/g,'')) || kData.documents?.[0];

                    if (matched?.place_url) {
                        const scResult = await scrapeKakaoPlace(matched.place_url);
                        totalTracking.stepC_kakao_success++;
                        return {
                            id: generateFactId('MASTER_ENRICHED', cand.name, cand.address), 
                            api_source: 'MASTER_ENRICHED', category: cand.category,
                            name: cand.name, address: cand.address, lat: cand.lat, lng: cand.lng,
                            trust_score: cand.trust_score || 50,
                            description: scResult.success ? `${cand.description || ''} (별점: ${scResult.rating}, 리뷰: ${scResult.reviewCount}건)` : (cand.description || ''),
                            raw_data: { ...cand.raw_data, kakao_url: matched.place_url, scraping: scResult }
                        };
                    }
                } catch (err) {}
                // Fallback to existing or raw ID
                return { ...cand, id: generateFactId('MASTER_RAW', cand.name, cand.address) };
            }));

            allFacts.push(...enriched.filter(Boolean));
            process.stdout.write(`\r  Progress: ${allFacts.length} items enriched...`);
        }
    }

    // Step D. Final Batch Upsert to smart_plan_facts
    console.log(`\n\n[Step D] Saving facts to smart_plan_facts...`);
    const finalQuotaFacts = Object.values(allFacts.reduce((acc, f) => ({ ...acc, [f.id]: f }), {}));
    
    // Chunk upsert (1000 items per call)
    for (let i = 0; i < finalQuotaFacts.length; i += 1000) {
        const chunk = finalQuotaFacts.slice(i, i + 1000);
        const { error } = await supabase.from('smart_plan_facts').upsert(chunk, { onConflict: 'id' });
        if (error) console.error(`Batch Upsert Error at ${i}:`, error.message);
    }

    // 5. Logging
    const duration = Date.now() - startTime;
    await supabase.from('automation_logs').insert({
        job_name: 'SMART_PLAN_CACHING',
        status: 'SUCCESS',
        processed_count: finalQuotaFacts.length,
        message: JSON.stringify({ version: "11.0", clusters: clusters.length, tracking: totalTracking, note: "Quota expanded to 300 for SPOT/RESTAURANT" }),
        duration_ms: duration,
        target_date: targetStr
    });

    console.log(`\n🏁 Done! Total ${finalQuotaFacts.length} facts cached in ${Math.round(duration/1000)}s.`);
    process.exit(0);
}

main();

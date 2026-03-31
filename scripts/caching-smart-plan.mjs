#!/usr/bin/env node
/**
 * @file caching-smart-plan.mjs
 * @version 11.6.1 (Deployment Trigger)
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';
import proj4 from 'proj4';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const OPINET_API_KEY = process.env.OPINET_API_KEY;
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const generateFactId = (source, name, address) => uuidv5(`${source}|${String(name || '').trim()}|${String(address || '').trim()}`, MY_NAMESPACE);

async function scrapeKakaoPlace(url) {
    try {
        const placeId = url.match(/\/(\d+)$/)?.[1];
        if (!placeId) return { rating: 0, reviewCount: 0, success: false };
        const h = { 'User-Agent': 'Mozilla/5.0', 'Referer': `https://place.map.kakao.com/${placeId}` };
        const [m, r] = await Promise.all([
            fetch(`https://place-api.map.kakao.com/places/panel3/${placeId}`, { headers: h }).then(res => res.json()),
            fetch(`https://place-api.map.kakao.com/places/reviews/kakaomap/meta/${placeId}`, { headers: h }).then(res => res.json())
        ]);
        const rating = m.basicInfo?.feedback?.score || 0;
        const reviewCount = r.reviewCount || 0;
        return { rating, reviewCount, success: rating > 0 || reviewCount > 0 };
    } catch { return { rating: 0, reviewCount: 0, success: false }; }
}

async function main() {
    const args = process.argv.slice(2);
    const dateArg = args.find(a => a.startsWith('--target-date='))?.split('=')[1];
    let targetStr = dateArg || new Date(new Date().getTime() + 12 * 3600000 + 3 * 86400000).toISOString().split('T')[0];
    const isSunday = new Date(targetStr).getDay() === 0;

    console.log(`🚀 v11.6 | Target: ${targetStr}`);
    const { data: schedules } = await supabase.from('user_schedules').select('campground_lat, campground_lng, campground_name, campground_address').eq('check_in', targetStr);
    if (!schedules?.length) process.exit(0);

    const clusters = [];
    for (const s of schedules) {
        let lat = Number(s.campground_lat), lng = Number(s.campground_lng);
        if (!lat || !lng) continue;
        let c = clusters.find(c => Math.sqrt(Math.pow(c.lat-lat,2)+Math.pow(c.lng-lng,2)) <= 0.15);
        if (c) { if(!c.names.includes(s.campground_name)) c.names.push(s.campground_name); }
        else clusters.push({ lat, lng, names: [s.campground_name], address: s.campground_address || '' });
    }

    const totalFactMap = new Map();
    for (const cluster of clusters) {
        const { lat, lng, address } = cluster;
        const addr = address.split(' ');
        const doNm = addr[0] || '충청남도';
        const sigunguNm = addr[1] || '예산군';

        // Step A: Real-time (Hosp, Fest, Gas) - [v11.8.5 Restore]
        let rawMasterInserts = [];

        // A-1. Hospital (Local City Fetch)
        try {
            const hRes = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${PUBLIC_API_KEY}&STAGE1=${encodeURIComponent(doNm)}&STAGE2=${encodeURIComponent(sigunguNm)}&pageNo=1&numOfRows=100&_type=json`);
            const hData = await hRes.json();
            if (hData.response?.body?.items?.item) {
                const items = Array.isArray(hData.response.body.items.item) ? hData.response.body.items.item : [hData.response.body.items.item];
                items.forEach((item) => {
                    rawMasterInserts.push({
                        id: generateFactId('NMC_HOSPITAL', item.dutyName, item.dutyAddr),
                        api_source: 'NMC_HOSPITAL', category: 'HOSPITAL',
                        name: item.dutyName, description: '응급실 가동 응급의료기관', address: item.dutyAddr,
                        lat: parseFloat(item.wgs84Lat), lng: parseFloat(item.wgs84Lon),
                        trust_score: item.dutyName?.includes('소아') ? 100 : 55, raw_data: item
                    });
                });
            }
        } catch (e) { console.error("Hospital Fetch Error:", e.message); }

        // A-1-2. Kakao Hospital (HP8)
        try {
            const kRes = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?category_group_code=HP8&x=${lng}&y=${lat}&radius=20000&size=15`, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } });
            const kData = await kRes.json();
            if (kData.documents) {
                kData.documents.forEach((item) => {
                    rawMasterInserts.push({
                        id: generateFactId('KAKAO_HP8', item.place_name, item.road_address_name || item.address_name),
                        api_source: 'KAKAO_HP8', category: 'HOSPITAL',
                        name: item.place_name, description: item.category_name || '일반 병원/의원', address: item.road_address_name || item.address_name,
                        lat: parseFloat(item.y), lng: parseFloat(item.x),
                        trust_score: item.place_name?.match(/종합병원|의료원|대학병원/) ? 50 : 20, raw_data: item
                    });
                });
            }
        } catch (e) { console.error("Kakao HP8 Error:", e.message); }

        // A-2. Festival
        try {
            const fRes = await fetch(`http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${PUBLIC_API_KEY}&numOfRows=50&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=15&mapX=${lng}&mapY=${lat}&radius=20000`);
            const fData = await fRes.json();
            if (fData.response?.body?.items?.item) {
                const items = Array.isArray(fData.response.body.items.item) ? fData.response.body.items.item : [fData.response.body.items.item];
                items.forEach((item) => {
                    rawMasterInserts.push({
                        id: generateFactId('TOUR_FSTVL', item.title, item.addr1),
                        api_source: 'TOUR_FSTVL', category: 'FESTIVAL',
                        name: item.title, description: '주변 로컬 축제/이벤트', address: item.addr1,
                        lat: parseFloat(item.mapy), lng: parseFloat(item.mapx), trust_score: 45, raw_data: item
                    });
                });
            }
        } catch (e) { console.error("Festival Fetch Error:", e.message); }

        // A-3. Gas Station (Spiral Search v11.8.5)
        try {
            if (OPINET_API_KEY) {
                proj4.defs("TM128", "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43");
                const [wtmX, wtmY] = proj4("EPSG:4326", "TM128", [lng, lat]);
                const seenGas = new Set();
                const spiralShifts = [
                    [{x:0, y:0}],
                    [{x:10000,y:0}, {x:-10000,y:0}, {x:0,y:10000}, {x:0,y:-10000}],
                    [{x:25000,y:0}, {x:-25000,y:0}, {x:0,y:25000}, {x:0,y:-25000}]
                ];
                const currentMonth = new Date().getMonth() + 1;
                const isWinter = [11, 12, 1, 2, 3].includes(currentMonth);
                
                for (const group of spiralShifts) {
                    if (seenGas.size >= 15) break;
                    const results = await Promise.all(group.map(s => {
                        const url = `http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_API_KEY}&x=${Math.round(wtmX+s.x)}&y=${Math.round(wtmY+s.y)}&radius=5000&sort=1&prodcd=C004&out=json`;
                        return fetch(url).then(r => r.json()).catch(() => null);
                    }));
                    
                    for (const data of results) {
                        if (data?.RESULT?.OIL) {
                            const items = Array.isArray(data.RESULT.OIL) ? data.RESULT.OIL : [data.RESULT.OIL];
                            for (const item of items) {
                                const key = (item.OS_NM || 'NONE') + (item.VAN_ADR || 'ADDR');
                                const price = parseFloat(item.PRICE || item.K_PRICE || "0");
                                if (!seenGas.has(key) && price > 0) {
                                    seenGas.add(key);
                                    const [gLon, gLat] = proj4("TM128", "EPSG:4326", [parseFloat(item.GIS_X_COOR), parseFloat(item.GIS_Y_COOR)]);
                                    let address = item.VAN_ADR || item.NEW_ADR || '';
                                    if (!address && KAKAO_KEY) {
                                        try {
                                            const rgr = await fetch(`https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${gLon}&y=${gLat}`, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } }).then(r=>r.json());
                                            if (rgr.documents?.[0]) {
                                                const d = rgr.documents[0];
                                                address = d.road_address?.address_name || d.address?.address_name || '';
                                            }
                                        } catch {}
                                    }
                                    rawMasterInserts.push({
                                        id: generateFactId('OPINET_GAS', item.OS_NM, address || '주소없음'),
                                        api_source: 'OPINET_GAS', category: 'GAS_STATION',
                                        name: item.OS_NM, description: `등유: ${price}원`, address: address,
                                        lat: gLat, lng: gLon, trust_score: 55, raw_data: item
                                    });
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) { console.error("Gas Fetch Error:", e.message); }

        // A-4. Persist to Master DB (SSOT Organic Growth)
        if (rawMasterInserts.length > 0) {
            console.log(`  -> Persisting ${rawMasterInserts.length} dynamic items to master_places...`);
            await supabase.from('master_places').upsert(rawMasterInserts, { onConflict: 'id' });
        }
        
        const categories = [
            { cat: 'RESTAURANT', limit: 300 }, { cat: 'SPOT', limit: 300 },
            { cat: 'MART', limit: 20 }, { cat: 'HOSPITAL', limit: 15 },
            { cat: 'GAS_STATION', limit: 10 }, { cat: 'FESTIVAL', limit: 15 }
        ];

        let clusterCands = [];
        for (const { cat, limit } of categories) {
            const { data } = await supabase.rpc('get_master_places_in_radius', { target_lat: lat, target_lng: lng, radius_meters: 30000, p_category: cat, limit_count: 800 });
            if (!data?.length) continue;

            const noise = /안경|의상|장례|보청기|수선|공방|부동산|세탁|학원|미용|세차|노래|당구|정신|피부|비만|디톡스|산후|동물|휴대폰|정비|공인중개/;
            const map = new Map();
            for (const item of data) {
                const name = (item.name || '').trim();
                const induty = (item.raw_data?.INDUTY_NM || item.raw_data?.indutyNm || '').trim();
                if (noise.test(name) || noise.test(induty)) continue;

                let s = 50;
                if (cat === 'RESTAURANT') {
                    s = 10;
                    if (item.api_source === 'SMBA_BAEK') s += 50;
                    if (item.api_source === 'MOIS_GOOD_RESTAURANT') s += 30;
                    if (item.api_source === 'SAFE_REST') s += 20;
                    if (/커피|카페|베이커리/.test(name)) s -= 5;
                } else if (cat === 'MART') {
                    if (/하나로|NH/.test(name)) s = 90;
                    else if (/이마트|롯데마트|홈플러스|트레이더스|노브랜드/.test(name)) s = isSunday ? 65 : 80;
                    else s = 65;
                } else if (cat === 'SPOT') {
                    s = 50;
                    if (/국립|수목원|휴양림|관광지|출렁다리|모노레일|케이블카|해수욕장|테마파크|사찰|읍성/.test(name)) s += 45;
                    else if (/박물관|미술관|천문대|역사|향교|전통가옥/.test(name)) s += 30;
                    const rc = parseInt(item.raw_data?.readcount || 0, 10);
                    s += (rc >= 10000 ? 40 : rc >= 5000 ? 30 : rc >= 1000 ? 20 : rc >= 500 ? 10 : 0);
                    if (item.raw_data?.firstimage) s += 40;
                } else if (cat === 'HOSPITAL') {
                    if (item.api_source === 'NMC_HOSPITAL' || /종합병원|의료원/.test(name)) s = 100;
                    else if (/내과|소아|외과|가정/.test(name) || /내과|소아|외과|가정/.test(induty)) s = 70;
                    if (/응급|야간|24시/.test(name)) s += 40;
                    if (/성형|피부|비만|치과|한의원/.test(name)) continue;
                }
                const k = `${name}|${item.address}`;
                if (map.has(k)) { if(cat==='RESTAURANT') map.get(k).trust_score+=(s-10); else if(s>map.get(k).trust_score) map.get(k).trust_score=s; }
                else map.set(k, { ...item, trust_score: s });
            }
            clusterCands.push(...Array.from(map.values()).sort((a,b)=>b.trust_score-a.trust_score).slice(0, limit));
        }

        for (let i = 0; i < clusterCands.length; i += 40) {
            const chunk = clusterCands.slice(i, i + 40);
            await Promise.all(chunk.map(async (c) => {
                const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(c.name)}&x=${c.lng}&y=${c.lat}&radius=10000`, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } }).then(r=>r.json());
                const m = res.documents?.find(d => d.place_name.replace(/\s/g,'') === c.name.replace(/\s/g,'')) || res.documents?.[0];
                if (m) {
                    const sc = await scrapeKakaoPlace(m.place_url);
                    const f = { ...c, id: generateFactId('MASTER_ENRICHED', c.name, c.address), api_source: 'MASTER_ENRICHED', target_date: targetStr, raw_data: { ...c.raw_data, kakao_url: m.place_url, scraping: sc } };
                    totalFactMap.set(f.id, f);
                }
            }));
        }
    }
    const final = Array.from(totalFactMap.values());
    for (let i = 0; i < final.length; i += 500) await supabase.from('smart_plan_facts').upsert(final.slice(i, i + 500), { onConflict: 'id' });
    console.log(`🏁 Done: ${final.length} facts.`);
    process.exit(0);
}
main();

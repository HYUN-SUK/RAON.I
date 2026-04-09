#!/usr/bin/env node
/**
 * @file caching-smart-plan.mjs
 * @version 11.6.2 (Session Wrap-up)
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';
import proj4 from 'proj4';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
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

    // [v11.9.8] Enhanced Metrics for SOP v11
    const metrics = {
        reservations: 0,
        clusters: 0,
        dynamic_api: {
            HOSPITAL: { existing: 0, received: 0, new: 0, updated: 0, total: 0 },
            GAS_STATION: { existing: 0, received: 0, new: 0, updated: 0, total: 0 },
            FESTIVAL: { existing: 0, received: 0, new: 0, updated: 0, total: 0 }
        },
        quota_flow: {
            RESTAURANT: { raw: 0, quota: 0, verified: 0, final: 0 },
            SPOT: { raw: 0, quota: 0, verified: 0, final: 0 },
            MART: { raw: 0, quota: 0, verified: 0, final: 0 },
            HOSPITAL: { raw: 0, quota: 0, verified: 0, final: 0 },
            GAS_STATION: { raw: 0, quota: 0, verified: 0, final: 0 },
            FESTIVAL: { raw: 0, quota: 0, verified: 0, final: 0 }
        }
    };

    console.log(`🚀 v11.6 | Target: ${targetStr}`);
    const { data: schedules } = await supabase.from('user_schedules').select('campground_lat, campground_lng, campground_name, campground_address').eq('check_in', targetStr);
    
    if (!schedules?.length) {
        console.log(`  ℹ️ No reservations found for ${targetStr}. Skipping...`);
        await recordAutomationLog(metrics, targetStr, 'SKIPPED');
        process.exit(0);
    }

    metrics.reservations = schedules.length;

    let clusters = [];
    const totalFactMap = new Map();
    for (const s of schedules) {
        let lat = Number(s.campground_lat), lng = Number(s.campground_lng), address = s.campground_address || '';
        let campground_name = s.campground_name || '';

        // [v11.9.5] Location Recovery Fallback
        if (!lat || !lng) {
            console.log(`  🔍 Missing location for ${campground_name}, searching campgrounds...`);
            const { data: masterInfo } = await supabase.from('campgrounds').select('lat, lng, address').ilike('name', `%${campground_name}%`).limit(1).single();
            if (masterInfo) {
                lat = masterInfo.lat; lng = masterInfo.lng; address = masterInfo.address;
                console.log(`  ✅ Recovered ${campground_name} location from campgrounds.`);
            } else if (address) {
                console.log(`  🌐 Master missing, attempting Geocoding for: ${address}`);
                const geoRes = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } }).then(r=>r.json());
                if (geoRes.documents?.[0]) {
                    lat = parseFloat(geoRes.documents[0].y); lng = parseFloat(geoRes.documents[0].x);
                    console.log(`  ✅ Geocoded ${campground_name} successfully.`);
                }
            }
        }
        if (!lat || !lng) { console.log(`  ⚠️ Skipping ${campground_name}: No location root found.`); continue; }

        let cluster = clusters.find(c => Math.sqrt(Math.pow(c.lat-lat,2)+Math.pow(c.lng-lng,2)) <= 0.15);
        if (cluster) { if(!cluster.names.includes(campground_name)) cluster.names.push(campground_name); }
        else clusters.push({ lat, lng, names: [campground_name], address: address });
    }

    metrics.clusters = clusters.length;

    for (const cluster of clusters) {
        const { lat, lng, address } = cluster;
        const addr = address.split(' ');
        const doNm = addr[0] || '충청남도';
        const sigunguNm = addr[1] || '예산군';

        // Get existing counts for Part 1 reporting
        const { count: hCount } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'HOSPITAL');
        const { count: gCount } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'GAS_STATION');
        const { count: fCount } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'FESTIVAL');
        metrics.dynamic_api.HOSPITAL.existing = Math.max(metrics.dynamic_api.HOSPITAL.existing, hCount || 0);
        metrics.dynamic_api.GAS_STATION.existing = Math.max(metrics.dynamic_api.GAS_STATION.existing, gCount || 0);
        metrics.dynamic_api.FESTIVAL.existing = Math.max(metrics.dynamic_api.FESTIVAL.existing, fCount || 0);

        // Step A: Real-time (Hosp, Fest, Gas) - [v11.8.5 Restore]
        let rawMasterInserts = [];

        // A-1. Hospital (Local City Fetch)
        try {
            const hRes = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${PUBLIC_API_KEY}&STAGE1=${encodeURIComponent(doNm)}&STAGE2=${encodeURIComponent(sigunguNm)}&pageNo=1&numOfRows=100&_type=json`);
            const hData = await hRes.json();
            if (hData.response?.body?.items?.item) {
                const items = Array.isArray(hData.response.body.items.item) ? hData.response.body.items.item : [hData.response.body.items.item];
                metrics.dynamic_api.HOSPITAL.received += items.length;
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
                metrics.dynamic_api.HOSPITAL.received += kData.documents.length;
                kData.documents.forEach((item) => {
                    rawMasterInserts.push({
                        id: generateFactId('KAKAO_HP8', item.place_name, item.road_address_name || item.address_name),
                        api_source: 'KAKAO_HP8', category: 'HOSPITAL',
                        name: item.place_name, description: item.category_name || '일반 병원/의원', address: item.road_address_name || item.address_name || '주소정보없음',
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
                metrics.dynamic_api.FESTIVAL.received += items.length;
                items.forEach((item) => {
                    rawMasterInserts.push({
                        id: generateFactId('TOUR_FSTVL', item.title, item.addr1),
                        api_source: 'TOUR_FSTVL', category: 'FESTIVAL',
                        name: item.title, description: '주변 로컬 축제/이벤트', address: item.addr1 || '주소정보없음',
                        lat: parseFloat(item.mapy), lng: parseFloat(item.mapx),
                        trust_score: 45, raw_data: item
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
                            metrics.dynamic_api.GAS_STATION.received += items.length;
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
                                        name: item.OS_NM, description: `등유: ${price}원`, address: address || '주소정보없음',
                                        lat: gLat, lng: gLon,
                                        trust_score: 55, raw_data: item
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
            const now = new Date().toISOString();
            // [v11.9.5] DB 제약조건(not-null) 및 공간 데이터 최종 무결성 필터링
            const sanitized = rawMasterInserts
                .filter(item => item.id && item.name && item.address && item.lat && item.lng) // 필수 필드 검증
                .map(item => ({
                    ...item,
                    address: item.address.trim(),
                    location: { type: 'Point', coordinates: [item.lng, item.lat] },
                    created_at: now,
                    updated_at: now
                }));

            if (sanitized.length > 0) {
                const ids = sanitized.map(s => s.id);
                const { data: existingIds } = await supabase.from('master_places').select('id').in('id', ids);
                const existingSet = new Set(existingIds?.map(e => e.id) || []);
                
                const news = sanitized.filter(s => !existingSet.has(s.id));
                const upds = sanitized.filter(s => existingSet.has(s.id));

                metrics.dynamic_api.HOSPITAL.new += news.filter(n => n.category === 'HOSPITAL').length;
                metrics.dynamic_api.HOSPITAL.updated += upds.filter(u => u.category === 'HOSPITAL').length;
                metrics.dynamic_api.GAS_STATION.new += news.filter(n => n.category === 'GAS_STATION').length;
                metrics.dynamic_api.GAS_STATION.updated += upds.filter(u => u.category === 'GAS_STATION').length;
                metrics.dynamic_api.FESTIVAL.new += news.filter(n => n.category === 'FESTIVAL').length;
                metrics.dynamic_api.FESTIVAL.updated += upds.filter(u => u.category === 'FESTIVAL').length;

                const { error: upsertError } = await supabase.from('master_places').upsert(sanitized, { onConflict: 'id' });
                if (upsertError) console.error("  ❌ Master Upsert Error:", upsertError.message);
            }
        }
        
        const categories = [
            { cat: 'RESTAURANT', limit: 300, rawLimit: 1000 },
            { cat: 'SPOT', limit: 300, rawLimit: 500 },
            { cat: 'MART', limit: 20, rawLimit: 100 },
            { cat: 'HOSPITAL', limit: 15, rawLimit: 100 },
            { cat: 'GAS_STATION', limit: 10, rawLimit: 100 },
            { cat: 'FESTIVAL', limit: 15, rawLimit: 100 }
        ];

        let clusterCands = [];
        let rawCandidatesForAudit = []; // spot_final_audit.md 출력용

        for (const { cat, limit, rawLimit } of categories) {
            const { data } = await supabase.rpc('get_master_places_in_radius_v2', { 
                target_lat: lat, target_lng: lng, 
                radius_meters: 30000, p_category: cat, 
                limit_count: rawLimit 
            });
            metrics.quota_flow[cat].raw += (data?.length || 0);
            if (!data?.length) continue;

            const noise = /안경|의상|장례|보청기|수선|공방|부동산|세탁|학원|미용|세차|노래|당구|정신|피부|비만|디톡스|산후|동물|휴대폰|정비|공인중개|방앗간|이미용/;
            const map = new Map();
            for (const item of data) {
                const name = (item.name || '').trim();
                const induty = (item.raw_data?.INDUTY_NM || item.raw_data?.indutyNm || '').trim();
                
                // 12종 블랙리스트 및 정밀 필터링
                if (noise.test(name) || noise.test(induty)) continue;

                let s = 50;
                if (cat === 'RESTAURANT') {
                    s = 10;
                    if (item.api_source === 'SMBA_BAEK') s += 50;
                    if (item.api_source === 'MOIS_GOOD_RESTAURANT') s += 30;
                    if (item.api_source === 'SAFE_RESTAURANT') s += 20;
                    if (/커피|카페|베이커리/.test(name)) s -= 5;
                } else if (cat === 'MART') {
                    if (/하나로|NH/.test(name)) s = 90;
                    else if (/이마트|롯데마트|홈플러스|트레이더스|노브랜드/.test(name)) s = isSunday ? 65 : 80;
                    else s = 65;
                    // 노이즈 필터 (패션/가전/가구)
                    if (/아울렛|패션|의류|디지털|하이마트|전자랜드|가구/.test(name)) continue;
                } else if (cat === 'SPOT') {
                    s = 50;
                    if (/국립|수목원|휴양림|관광지|출렁다리|모노레일|케이블카|해수욕장|테마파크|사찰|읍성/.test(name)) s += 45;
                    else if (/박물관|미술관|천문대|역사|향교|전통가옥/.test(name)) s += 30;
                    const rc = parseInt(item.raw_data?.readcount || 0, 10);
                    s += (rc >= 10000 ? 40 : rc >= 5000 ? 30 : rc >= 1000 ? 20 : rc >= 500 ? 10 : 0);
                    // 미디어 가점 (이미지 + 상세설명)
                    if (item.raw_data?.firstimage) s += 20;
                    if (item.raw_data?.overview?.length > 100) s += 20;
                } else if (cat === 'HOSPITAL') {
                    if (item.api_source === 'NMC_HOSPITAL' || /종합병원|의료원/.test(name)) s = 100;
                    else if (/내과|소아|외과|가정/.test(name) || /내과|소아|외과|가정/.test(induty)) s = 70;
                    else if (/보건소|보건지소/.test(name)) s = 50; // Tier 3
                    
                    if (/응급|야간|24시/.test(name)) s += 40;
                    // 정밀 제외 (안과, 치과, 한의원, 산후조리 등)
                    if (/성형|피부|비만|치과|한의원|안과|산후|요양/.test(name)) continue;
                } else if (cat === 'FESTIVAL') {
                    s = 45;
                    // 기간 매칭 체크 (v10.7)
                    const start = item.raw_data?.eventstartdate;
                    const end = item.raw_data?.eventenddate;
                    if (start && end) {
                        const targetDateNum = parseInt(targetStr.replace(/-/g, ''));
                        if (targetDateNum < parseInt(start) - 3 || targetDateNum > parseInt(end) + 2) continue;
                    }
                } else if (cat === 'GAS_STATION') {
                    s = 50;
                    // 최저가 가점 (v11.9): 등유 가격이 낮을수록 고득점 부여
                    const priceMatch = item.description?.match(/(\d+)원/);
                    if (priceMatch) {
                        const price = parseInt(priceMatch[1]);
                        // 기준가(2500원) 대비 10원당 1점 가산 (예: 1500원 -> +100점)
                        s += Math.max(0, Math.floor((2500 - price) / 10));
                    }
                }

                const k = `${name}|${item.address}`;
                const dist = item.distance || 99999;
                if (map.has(k)) { 
                    if(cat==='RESTAURANT') map.get(k).trust_score+=(s-10); 
                    else if(s>map.get(k).trust_score) map.get(k).trust_score=s; 
                } else {
                    map.set(k, { ...item, trust_score: s, distance: dist });
                }
            }

            // 1차 선별 완료본 정렬 및 슬라이싱
            const sorted = Array.from(map.values()).sort((a,b) => {
                if (b.trust_score !== a.trust_score) return b.trust_score - a.trust_score;
                return (a.distance || 0) - (b.distance || 0); // 2순위 거리
            });

            // 마트 부족 시 편의점 폴백 (Step B-Fallback)
            if (cat === 'MART' && sorted.length < 3) {
                console.log(`  -> Mart low (${sorted.length}), triggering CS2 fallback...`);
                try {
                    const fallbackRes = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?category_group_code=CS2&x=${lng}&y=${lat}&radius=10000&size=5`, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } }).then(r=>r.json());
                    if (fallbackRes.documents) {
                        fallbackRes.documents.forEach(d => {
                            sorted.push({
                                id: generateFactId('KAKAO_CS2', d.place_name, d.address_name),
                                api_source: 'KAKAO_CS2', category: 'MART',
                                name: d.place_name, address: d.address_name, trust_score: 40, isFallback: true, distance: parseInt(d.distance),
                                lat: parseFloat(d.y), lng: parseFloat(d.x), raw_data: d
                            });
                        });
                    }
                } catch {}
            }

            rawCandidatesForAudit.push(...sorted);
            const sliced = sorted.slice(0, limit);
            metrics.quota_flow[cat].quota += sliced.length;
            clusterCands.push(...sliced);
        }

        // 전체 리스트 출력 (SOP 규격)
        if (rawCandidatesForAudit.length > 0) {
            let auditContent = `# 3일 전 스마트 플랜 캐싱 1차 선별 리스트 (Quota Applied)\n\n`;
            auditContent += `| 번호 | 카테고리 | 이름 | 신뢰점수 | 주소 | 거리(m) |\n`;
            auditContent += `| :--- | :--- | :--- | :---: | :--- | :---: |\n`;
            rawCandidatesForAudit.forEach((c, idx) => {
                auditContent += `| ${idx + 1} | ${c.category} | ${c.name} | ${c.trust_score} | ${c.address} | ${Math.round(c.distance)} |\n`;
            });
            fs.writeFileSync('C:\\Users\\USER\\Desktop\\RAON.I\\spot_final_audit.md', auditContent, 'utf-8');
            console.log(`📝 Audit list generated: ${rawCandidatesForAudit.length} items.`);
        }

        for (let i = 0; i < clusterCands.length; i += 40) {
            const chunk = clusterCands.slice(i, i + 40);
            await Promise.all(chunk.map(async (c) => {
                const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(c.name)}&x=${c.lng}&y=${c.lat}&radius=10000`, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } }).then(r=>r.json());
                const m = res.documents?.find(d => d.place_name.replace(/\s/g,'') === c.name.replace(/\s/g,'')) || res.documents?.[0];
                if (m) {
                    metrics.quota_flow[c.category].verified++;
                    const sc = await scrapeKakaoPlace(m.place_url);
                    const safeFact = {
                        id: generateFactId('MASTER_ENRICHED', c.name, c.address),
                        api_source: 'MASTER_ENRICHED',
                        category: c.category,
                        name: c.name,
                        description: c.description || '',
                        address: c.address,
                        lat: c.lat,
                        lng: c.lng,
                        trust_score: c.trust_score,
                        raw_data: { ...c.raw_data, kakao_url: m.place_url, scraping: sc }
                    };
                    totalFactMap.set(safeFact.id, safeFact);
                }
            }));
        }
    }
    const final = Array.from(totalFactMap.values());
    final.forEach(f => {
        if (metrics.quota_flow[f.category]) metrics.quota_flow[f.category].final++;
    });

    for (let i = 0; i < final.length; i += 500) await supabase.from('smart_plan_facts').upsert(final.slice(i, i + 500), { onConflict: 'id' });
    console.log(`🏁 Done: ${final.length} facts.`);

    // Update dynamic API total counts
    const { count: finalH } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'HOSPITAL');
    const { count: finalG } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'GAS_STATION');
    const { count: finalF } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'FESTIVAL');
    metrics.dynamic_api.HOSPITAL.total = finalH || 0;
    metrics.dynamic_api.GAS_STATION.total = finalG || 0;
    metrics.dynamic_api.FESTIVAL.total = finalF || 0;

    await recordAutomationLog(metrics, targetStr, 'SUCCESS');
    process.exit(0);
}

async function recordAutomationLog(metrics, targetDate, status) {
    console.log(`📊 Recording automation log for ${targetDate}...`);
    
    // SOP v11 Part 1 & 2 Structure
    const apiStatus = Object.entries(metrics.dynamic_api).map(([cat, val]) => ({
        category: cat,
        existing: val.existing,
        received: val.received,
        new: val.new,
        updated: val.updated,
        total: val.total
    }));

    const quotaFlow = Object.entries(metrics.quota_flow).map(([cat, val]) => ({
        category: cat,
        raw_query: val.raw,
        top_quota: val.quota,
        verified: val.verified,
        final: val.final
    }));

    const { error } = await supabase.from('automation_logs').insert({
        job_name: 'SMART_PLAN_CACHING',
        status: status,
        processed_count: metrics.reservations,
        message: JSON.stringify({
            text: `${targetDate} 예약 ${metrics.reservations}건 대상 캐싱 완료 (${metrics.clusters}개 클러스터)`,
            quota_flow: quotaFlow
        }),
        api_status: apiStatus, // Part 1
        created_at: new Date().toISOString()
    });

    if (error) console.error("  ❌ Logging Error:", error.message);
}

main();

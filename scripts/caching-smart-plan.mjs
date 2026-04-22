#!/usr/bin/env node
/**
 * @file caching-smart-plan.mjs
 * @version 11.6.3 (Recovery & Optimization)
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

// [v11.9.15] Dynamic Prestige Matching System
let PRESTIGE_MAP = new Map();

function loadPrestigeLists() {
    try {
        const t1 = fs.readFileSync('korea_tourism_100_official.md', 'utf8');
        const t2 = fs.readFileSync('regional_8_sceneries_FULL.md', 'utf8');
        
        // Tier 1 Parsing
        let currentSido = '', currentSigungu = '';
        t1.split('\n').forEach(line => {
            const sidoMatch = line.match(/^## \d+\. (.+?) /);
            if (sidoMatch) currentSido = sidoMatch[1];
            const sigunguMatch = line.match(/^### (.+?) \(/);
            if (sigunguMatch) currentSigungu = sigunguMatch[1];
            if (line.startsWith('- ')) {
                const names = line.includes('5대 고궁') ? ['경복궁', '창덕궁', '창경궁', '덕수궁', '경희궁'] : [line.replace('- ', '').split('(')[0].trim()];
                names.forEach(n => {
                    const key = getCleanString(n) + '|' + (currentSigungu || currentSido).replace(/[시군구]$/, '');
                    PRESTIGE_MAP.set(key, 1);
                });
            }
        });

        // Tier 2 Parsing (v11.9.15 Ultimate Fix)
        let t2Sigungu = '';
        t2.split('\n').forEach(line => {
            const h3Match = line.match(/^### (.+?)(?:\s+\(|$)/);
            const listMatch = line.match(/^- \*\*(.+?)(?:\(.+?\))?:\*\*\s+(.+)$/);
            
            if (h3Match) {
                t2Sigungu = h3Match[1].trim().replace(/[시군구]$/, '');
            } else if (listMatch) {
                const sigungu = listMatch[1].trim().replace(/[시군구]$/, '');
                const names = listMatch[2].split(',').map(n => n.trim()).filter(n => n);
                names.forEach(n => {
                    const key = getCleanString(n) + '|' + sigungu;
                    PRESTIGE_MAP.set(key, 2);
                });
            } else if (line.startsWith('- ') && t2Sigungu) {
                const names = line.replace('- ', '').split(',').map(n => n.trim()).filter(n => n);
                names.forEach(n => {
                    const key = getCleanString(n) + '|' + t2Sigungu;
                    PRESTIGE_MAP.set(key, 2);
                });
            }
        });
        
        // Debug: Check if Yesan is loaded
        const checkKey = getCleanString('예당호 출렁다리') + '|예산';
        console.log(`🔍 Map Check [예당호 출렁다리|예산]: ${PRESTIGE_MAP.has(checkKey) ? '✅ FOUND' : '❌ NOT FOUND'} (Tier: ${PRESTIGE_MAP.get(checkKey)})`);
        console.log(`✅ Prestige List Loaded: ${PRESTIGE_MAP.size} items mapped.`);
    } catch (e) {
        console.warn(`⚠️ Failed to load prestige lists: ${e.message}`);
    }
}

function getNormalizedAddr(addr) {
    if (!addr) return '';
    let a = addr.replace(/,\s?대한민국$/, '').trim();
    // [v11.2 Master Sync Standard] Regularize Sido names to full official names
    a = a.replace(/^(서울|서울특별시)\s?/, '서울특별시 ');
    a = a.replace(/^(부산|부산광역시)\s?/, '부산광역시 ');
    a = a.replace(/^(대구|대구광역시)\s?/, '대구광역시 ');
    a = a.replace(/^(인천|인천광역시)\s?/, '인천광역시 ');
    a = a.replace(/^(광주|광주광역시)\s?/, '광주광역시 ');
    a = a.replace(/^(대전|대전광역시)\s?/, '대전광역시 ');
    a = a.replace(/^(울산|울산광역시)\s?/, '울산광역시 ');
    a = a.replace(/^(세종|세종특별자치시)\s?/, '세종특별자치시 ');
    a = a.replace(/^(경기|경기도)\s?/, '경기도 ');
    a = a.replace(/^(강원|강원도|강원특별자치도)\s?/, '강원특별자치도 ');
    a = a.replace(/^(충북|충청북도)\s?/, '충청북도 ');
    a = a.replace(/^(충남|충청남도)\s?/, '충청남도 ');
    a = a.replace(/^(전북|전라북도|전북특별자치도)\s?/, '전북특별자치도 ');
    a = a.replace(/^(전남|전라남도)\s?/, '전라남도 ');
    a = a.replace(/^(경북|경상북도)\s?/, '경상북도 ');
    a = a.replace(/^(경남|경상남도)\s?/, '경상남도 ');
    a = a.replace(/^(제주|제주도|제주특별자치도)\s?/, '제주특별자치도 ');
    return a.trim();
}

const extractSido = (addr) => {
    if (!addr) return null;
    const normalized = getNormalizedAddr(addr);
    const standardSidos = [
        '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시', 
        '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도'
    ];
    return standardSidos.find(s => normalized.startsWith(s)) || null;
};

const extractSigungu = (addr) => {
    if (!addr) return null;
    const normalized = getNormalizedAddr(addr);
    const sido = extractSido(addr);
    if (!sido) return null;
    const parts = normalized.replace(sido, '').trim().split(' ');
    // Handle cases like '수원시 장안구' (takes first 2 words if both are cities/districts)
    if (parts.length >= 2 && (parts[0].endsWith('시') || parts[0].endsWith('군')) && (parts[1].endsWith('구') || parts[1].endsWith('시'))) {
        return `${parts[0]} ${parts[1]}`;
    }
    return parts[0] || null;
};

const getCleanString = (str) => {
    if (!str) return '';
    let s = String(str);
    // [v11.9.15] Ultimate Cleaning: Remove prefixes, Bold, and Parentheses
    if (s.includes(':')) s = s.split(':').pop();
    return s
        .replace(/\*\*.*?\*\*/g, '') 
        .replace(/\(.*?\)/g, '')    // Remove (mangled) or (sub-name)
        .replace(/[^a-z0-9가-힣]/gi, '') 
        .toLowerCase()
        .trim();
};

const generateFactId = (source, name, address) => {
    const cleanSource = getCleanString(source);
    const cleanName = getCleanString(name);
    const cleanAddr = getCleanString(getNormalizedAddr(address));
    return uuidv5(`${cleanSource}|${cleanName}|${cleanAddr}`, MY_NAMESPACE);
};

// [v11.9.16] Spatial Merge Engine (Internal)
async function performSpatialMerge() {
    console.log('📡 [Auto-Merge] Checking for spatial duplicates in SPOT category...');
    const { data: allData, error } = await supabase.from('master_places').select('*').eq('category', 'SPOT');
    if (error || !allData) return 0;

    const getDist = (lat1, lng1, lat2, lng2) => {
        const R = 6371e3;
        const f1 = lat1 * Math.PI/180, f2 = lat2 * Math.PI/180;
        const df = (lat2-lat1) * Math.PI/180, dl = (lng2-lng1) * Math.PI/180;
        const a = Math.sin(df/2) * Math.sin(df/2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dl/2) * Math.sin(dl/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };
    const clean = (s) => (s || '').replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').replace(/\s/g, '').toLowerCase();

    let mergedCount = 0;
    const processed = new Set();
    for (let i = 0; i < allData.length; i++) {
        if (processed.has(allData[i].id)) continue;
        for (let j = i + 1; j < allData.length; j++) {
            if (processed.has(allData[j].id)) continue;
            const dist = getDist(allData[i].lat, allData[i].lng, allData[j].lat, allData[j].lng);
            const n1 = clean(allData[i].name), n2 = clean(allData[j].name);
            if (dist < 500 && (n1.includes(n2) || n2.includes(n1))) {
                const winner = (allData[i].raw_data?.tier || 99) <= (allData[j].raw_data?.tier || 99) ? allData[i] : allData[j];
                const loser = winner.id === allData[i].id ? allData[j] : allData[i];
                // Simple Merge: Capture tier if loser has it
                if (loser.raw_data?.tier && (!winner.raw_data?.tier || loser.raw_data.tier < winner.raw_data.tier)) {
                    winner.raw_data.tier = loser.raw_data.tier;
                    await supabase.from('master_places').update({ raw_data: winner.raw_data }).eq('id', winner.id);
                }
                await supabase.from('master_places').delete().eq('id', loser.id);
                processed.add(loser.id);
                mergedCount++;
                break; 
            }
        }
    }
    if (mergedCount > 0) console.log(`  ✨ [Auto-Merge] Successfully merged ${mergedCount} duplicates.`);
    return mergedCount;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function upsertAndTrack(items, metricObj) {
    if (items.length === 0) return;
    
    const ids = items.map(it => it.id);
    let allExisting = [];
    
    for (let i = 0; i < ids.length; i += 100) {
        const chunkIds = ids.slice(i, i + 100);
        const { data, error } = await supabase.from('master_places')
            .select('id, lat, lng, name, address, trust_score, is_active, raw_data')
            .in('id', chunkIds);
            
        if (error) {
            console.error(`[CRITICAL] DB Existence Check Failed: ${error.message}`);
            metricObj.note = '💥 ERROR (조회/통신 실패)';
            return;
        }
        if (data) allExisting.push(...data);
    }
    
    const existingMap = new Map(allExisting.map(e => [e.id, e]));
    
    let news = 0;
    let trueUpdates = 0;

    for (const it of items) {
        if (existingMap.has(it.id)) {
            const ext = existingMap.get(it.id);
            if (ext.lat !== undefined && ext.lat !== null) it.lat = ext.lat;
            if (ext.lng !== undefined && ext.lng !== null) it.lng = ext.lng;

            const nameChanged = ext.name !== it.name;
            const addrChanged = ext.address !== it.address;
            const scoreChanged = ext.trust_score !== it.trust_score;
            const statusChanged = ext.is_active !== it.is_active;
            
            if (nameChanged || addrChanged || scoreChanged || statusChanged) {
                trueUpdates++;
            }
        } else {
            news++;
        }
    }
    
    metricObj.new += news;
    metricObj.updated += trueUpdates;
    
    for (let i = 0; i < items.length; i += 500) {
        const chunk = items.slice(i, i + 500);
        const { error } = await supabase.from('master_places').upsert(chunk, { onConflict: 'id' });
        if (error) console.error(`[ERROR] UPSERT Failed: ${error.message}`);
    }
}

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
    
    loadPrestigeLists(); // [v11.9.15] Load MD lists once at start
    
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

        // [v11.9.13] Clustering based on 20km Radius (Geo-Clustering 병합)
        let cluster = clusters.find(c => {
            const dLine = Math.sqrt(Math.pow(c.points[0].lat - lat, 2) + Math.pow(c.points[0].lng - lng, 2)) * 111;
            return dLine <= 20; 
        });
        
        if (cluster) { 
            if(!cluster.names.includes(campground_name)) cluster.names.push(campground_name); 
            cluster.points.push({ lat, lng });
        }
        else clusters.push({ points: [{ lat, lng }], names: [campground_name], address: address });
    }

    metrics.clusters = clusters.length;

    // [v11.9.8 Optimization] Step A-0. Accumulators for Bulk Persistence
    const aggregatedMaster = {
        HOSPITAL: new Map(),
        FESTIVAL: new Map(),
        GAS_STATION: new Map()
    };

    // [v11.9.8 Optimization] Step A-0.1 Get initial counts from Master DB (Once per run)
    const { count: hCount } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'HOSPITAL');
    const { count: gCount } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'GAS_STATION');
    const { count: fCount } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'FESTIVAL');
    metrics.dynamic_api.HOSPITAL.existing = hCount || 0;
    metrics.dynamic_api.GAS_STATION.existing = gCount || 0;
    metrics.dynamic_api.FESTIVAL.existing = fCount || 0;

    for (let idx = 0; idx < clusters.length; idx++) {
        const cluster = clusters[idx];
        const address = cluster.address || '';

        console.log(`🎡 Processing Cluster ${idx + 1}/${clusters.length}: ${cluster.names[0]}...`);

        // [v11.9.13 Standardization] Multi-Point Extraction to avoid Distance Bias
        // 추출된 예약자 좌표들 중 상호 5km 이상 이격된 대표 지점(repPoints)들을 독립적인 수집 기점으로 선정
        const repPoints = [];
        cluster.points.forEach(p => {
            if (!repPoints.some(rp => {
                const dist = Math.sqrt(Math.pow(rp.lat - p.lat, 2) + Math.pow(rp.lng - p.lng, 2)) * 111; 
                return dist < 5;
            })) {
                repPoints.push(p);
            }
        });
        console.log(`  🔍 Cluster Representative Selection: ${repPoints.length} points from ${cluster.points.length} campgrounds.`);

        // Step A: Real-time (Hosp, Fest, Gas) - [v11.9.13 Enhanced for Multi-point]
        for (const pt of repPoints) {
            const ptLat = pt.lat;
            const ptLng = pt.lng;
            const ptSido = extractSido(address) || '충청남도';
            const ptSigungu = extractSigungu(address) || '예산군';

            console.log(`  🚀 Fetching dynamic data for point: (${ptLat.toFixed(4)}, ${ptLng.toFixed(4)}) in ${ptSigungu}...`);
            const fetchTasks = [];

            // A-1. Hospital (Local City Fetch)
            fetchTasks.push((async () => {
                try {
                    const hRes = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${PUBLIC_API_KEY}&STAGE1=${encodeURIComponent(ptSido.replace('특별시','').replace('광역시',''))}&STAGE2=${encodeURIComponent(ptSigungu)}&pageNo=1&numOfRows=100&_type=json`);
                    const hData = await hRes.json();
                    if (hData.response?.body?.items?.item) {
                        const items = Array.isArray(hData.response.body.items.item) ? hData.response.body.items.item : [hData.response.body.items.item];
                        metrics.dynamic_api.HOSPITAL.received += items.length;
                        items.forEach((item) => {
                            const fact = {
                                id: generateFactId('NMC_HOSPITAL', item.dutyName, item.dutyAddr),
                                api_source: 'NMC_HOSPITAL', category: 'HOSPITAL',
                                name: item.dutyName, description: '응급실 가동 응급의료기관', address: item.dutyAddr,
                                lat: parseFloat(item.wgs84Lat), lng: parseFloat(item.wgs84Lon),
                                trust_score: item.dutyName?.includes('소아') ? 100 : 55, raw_data: item
                            };
                            aggregatedMaster.HOSPITAL.set(fact.id, fact);
                        });
                    }
                } catch (e) { console.error("Hospital Fetch Error:", e.message); }
            })());

            // A-1-2. Kakao Hospital (HP8)
            fetchTasks.push((async () => {
                try {
                    const kRes = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?category_group_code=HP8&x=${ptLng}&y=${ptLat}&radius=20000&size=15`, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } });
                    const kData = await kRes.json();
                    if (kData.documents) {
                        metrics.dynamic_api.HOSPITAL.received += kData.documents.length;
                        kData.documents.forEach((item) => {
                            const fact = {
                                id: generateFactId('KAKAO_HP8', item.place_name, item.road_address_name || item.address_name),
                                api_source: 'KAKAO_HP8', category: 'HOSPITAL',
                                name: item.place_name, description: item.category_name || '일반 병원/의원', address: item.road_address_name || item.address_name || '주소정보없음',
                                lat: parseFloat(item.y), lng: parseFloat(item.x),
                                trust_score: item.place_name?.match(/종합병원|의료원|대학병원/) ? 50 : 20, raw_data: item
                            };
                            aggregatedMaster.HOSPITAL.set(fact.id, fact);
                        });
                    }
                } catch (e) { console.error("Kakao HP8 Error:", e.message); }
            })());

            // A-2. Festival
            fetchTasks.push((async () => {
                try {
                    const fRes = await fetch(`http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${PUBLIC_API_KEY}&numOfRows=50&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=15&mapX=${ptLng}&mapY=${ptLat}&radius=20000`);
                    const fData = await fRes.json();
                    if (fData.response?.body?.items?.item) {
                        const items = Array.isArray(fData.response.body.items.item) ? fData.response.body.items.item : [fData.response.body.items.item];
                        metrics.dynamic_api.FESTIVAL.received += items.length;
                        items.forEach((item) => {
                            const fact = {
                                id: generateFactId('TOUR_FSTVL', item.title, item.addr1),
                                api_source: 'TOUR_FSTVL', category: 'FESTIVAL',
                                name: item.title, description: '주변 로컬 축제/이벤트', address: item.addr1 || '주소정보없음',
                                lat: parseFloat(item.mapy), lng: parseFloat(item.mapx),
                                trust_score: 45, raw_data: item
                            };
                            aggregatedMaster.FESTIVAL.set(fact.id, fact);
                        });
                    }
                } catch (e) { console.error("Festival Fetch Error:", e.message); }
            })());

            // A-3. Gas Station (Spiral Search v11.8.5)
            fetchTasks.push((async () => {
                try {
                    if (OPINET_API_KEY) {
                        proj4.defs("TM128", "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43");
                        const [wtmX, wtmY] = proj4("EPSG:4326", "TM128", [ptLng, ptLat]);
                        const seenGas = new Set();
                        const spiralShifts = [
                            [{x:0, y:0}],
                            [{x:10000,y:0}, {x:-10000,y:0}, {x:0,y:10000}, {x:0,y:-10000}]
                        ];
                        
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
                                            let gasAddress = item.VAN_ADR || item.NEW_ADR || '';
                                            if (!gasAddress && KAKAO_KEY) {
                                                try {
                                                    const rgr = await fetch(`https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${gLon}&y=${gLat}`, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } }).then(r=>r.json());
                                                    if (rgr.documents?.[0]) {
                                                        const d = rgr.documents[0];
                                                        gasAddress = d.road_address?.address_name || d.address?.address_name || '';
                                                    }
                                                } catch {}
                                            }
                                            const fact = {
                                                id: generateFactId('OPINET_GAS', item.OS_NM, gasAddress || '주소없음'),
                                                api_source: 'OPINET_GAS', category: 'GAS_STATION',
                                                name: item.OS_NM, description: `등유: ${price}원`, address: gasAddress || '주소정보없음',
                                                lat: gLat, lng: gLon,
                                                trust_score: 55, raw_data: item
                                            };
                                            aggregatedMaster.GAS_STATION.set(fact.id, fact);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (e) { console.error("Gas Fetch Error:", e.message); }
            })());

            await Promise.all(fetchTasks);

            // [v11.9.13] Throttling between points within the same cluster
            await sleep(500);
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
            const map = new Map();
            
            // 각 대표 지점별로 RPC 호출하여 광범위하게 수집 (데이터 편향 완벽 해소)
            for (const pt of repPoints) {
                let data = null;
                for (let attempt = 1; attempt <= 2; attempt++) {
                    const result = await supabase.rpc('get_master_places_in_radius_v2', { 
                        target_lat: pt.lat, target_lng: pt.lng, 
                        radius_meters: 25000, p_category: cat, 
                        limit_count: 3000 // [v11.9.13] 원격 품질 데이터 확보를 위해 limit 대폭 상향
                    });
                    if (!result.error) { data = result.data; break; }
                    await sleep(1000);
                }
                
                if (!data) continue;
                metrics.quota_flow[cat].raw += data.length;

                const noise = /안경|의상|장례|보청기|수선|공방|부동산|세탁|학원|미용|세차|노래|당구|정신|피부|비만|디톡스|산후|동물|휴대폰|정비|공인중개|방앗간|이미용|사진관|약국|목공/;
                const mart_blacklist = ['패션', '아울렛', '의류', '가전', '가구', '전자', '디지털프라자', '하이마트', '전자랜드'];
                for (const item of data) {
                    const name = (item.name || '').trim();
                    const induty = (item.raw_data?.INDUTY_NM || item.raw_data?.indutyNm || '').trim();
                    const biz = (item.raw_data?.biz_name || item.raw_data?.BIZPLC_NM || '').trim();
                    if (noise.test(name) || noise.test(induty) || noise.test(biz)) continue;

                    let s = 10; // Base score
                    if (cat === 'RESTAURANT') {
                        if (item.api_source === 'LX_RESTAURANT') s += 50;
                        if (item.api_source === 'SMBA_BAEK') s += 50;
                        if (item.api_source === 'LOCALDATA_RESTAURANT_GOOD') s += 30;
                        if (item.api_source === 'SAFE_RESTAURANT' || item.api_source === 'LOCALDATA_RESTAURANT_SAFE') s += 20;
                        
                        // [v11.9.13] 인증 없는 식당(10점)은 리스트에서 즉시 제거
                        if (s <= 10) continue; 
                    } else if (cat === 'MART') {
                        if (/하나로|NH/.test(name)) s = 90;
                        else if (/이마트|롯데마트|홈플러스|트레이더스|노브랜드/.test(name)) s = isSunday ? 65 : 80;
                        else s = 65;
                        if (/아울렛|패션|의류|디지털|하이마트|전자랜드|가구|가전|타운/.test(name)) continue;
                    } else if (cat === 'SPOT') {
                        // [v2.6 Hybrid Engine] Prestige & Popularity Synthesis
                        const spotData = data.filter(d => d.category === 'SPOT');
                        const inScoreMap = new Map();
                        const freqMap = new Map();
                        const nameToId = new Map();
                        spotData.forEach(x => nameToId.set(x.name.trim(), x.id));

                        // 1. Popularity Sub-Metrics Pre-calculation (TMAP Centrality)
                        spotData.forEach(spot => {
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

                        // 2. Hybrid Score Synthesis (60% Prestige / 40% Popularity)
                        const finalSpotMap = new Map();
                        const sortedRawRelated = spotData.map(s => {
                            const relatedSum = inScoreMap.get(s.id) || 0;
                            const freq = freqMap.get(s.id) || 0;
                            return { id: s.id, val: relatedSum * (1 + Math.log1p(freq)) };
                        }).sort((a,b) => b.val - a.val);

                        spotData.forEach(spot => {
                            // A. Prestige Component (60%)
                            let prestigeScore = 15; // Base
                            
                            // [v11.9.15] Runtime Matching (Dynamic)
                            const cleanName = getCleanString(spot.name);
                            const normSigungu = (spot.sigungu || '').replace(/[시군구]$/, '');
                            const matchKey = `${cleanName}|${normSigungu}`;
                            
                            const dynamicTier = PRESTIGE_MAP.get(matchKey);
                            const dbTier = spot.raw_data?.prestige_tier; // [v11.9.15] SSOT Sync
                            const tier = dbTier || dynamicTier;

                            if (tier === 1) prestigeScore = 100;      // 한국관광 100선
                            else if (tier === 2) prestigeScore = 80;  // 지역 8경
                            
                            if (dynamicTier) console.log(`   ✨ Prestige Match: ${spot.name} (${spot.sigungu}) -> Tier ${dynamicTier}`);

                            // B. Popularity Component (40%) - [KTO 60 : TMAP 20 : KT 20]
                            // B-1. KTO Official (Fallback to TMAP dynamic rank if missing)
                            let ktoScore = 10; 
                            const ktoRank = spot.raw_data?.kto_official?.rank;
                            if (ktoRank && ktoRank <= 100) {
                                ktoScore = 100 * (1 - (ktoRank - 1) / 100);
                            } else {
                                // Fallback: Use pool-wide TMAP rank
                                const tmapRank = sortedRawRelated.findIndex(x => x.id === spot.id);
                                ktoScore = ((sortedRawRelated.length - 1 - tmapRank) / Math.max(1, sortedRawRelated.length - 1)) * 100;
                            }

                            // B-2. TMAP Centrality (20%)
                            const tmapIdx = sortedRawRelated.findIndex(x => x.id === spot.id);
                            const tmapScore = ((sortedRawRelated.length - 1 - tmapIdx) / Math.max(1, sortedRawRelated.length - 1)) * 100;

                            // B-3. KT Concentration / Demographic (20%)
                            const ktScore = parseFloat(spot.raw_data?.kt_concentration || spot.raw_data?.popularity_v2?.base_pop || 10);

                            const combinedPop = (ktoScore * 0.6) + (tmapScore * 0.2) + (ktScore * 0.2);
                            
                            // C. Confidence Multiplier (Consistency check)
                            const hasRel = (spot.raw_data?.tmap_related?.length > 0) ? 0.4 : 0;
                            const hasConc = (spot.raw_data?.kt_concentration > 0 || spot.raw_data?.popularity_v2?.base_pop > 0) ? 0.3 : 0;
                            const hasPrestige = tier ? 0.3 : 0;
                            const confMultiplier = 0.80 + (0.20 * (hasRel + hasConc + hasPrestige));

                            // D. Final Quality Score Synthesis
                            const qualityScore = (prestigeScore * 0.6) + (combinedPop * 0.4);
                            finalSpotMap.set(spot.id, Math.round(qualityScore * confMultiplier));
                        });

                        s = finalSpotMap.get(item.id) || 10;
                    } else if (cat === 'HOSPITAL') {
                        if (item.api_source === 'NMC_HOSPITAL' || /종합병원|의료원/.test(name)) s = 100;
                        else if (/내과|소아|외과|가정/.test(name) || /내과|소아|외과|가정/.test(induty)) s = 70;
                        else if (/보건소|보건지소/.test(name)) s = 50;
                        if (/응급|야간|24시/.test(name)) s += 40;
                        if (/성형|피부|비만|치과|한의원|안과|산후|요양/.test(name)) continue;
                    } else if (cat === 'FESTIVAL') {
                        s = 45;
                        const start = item.raw_data?.eventstartdate;
                        const end = item.raw_data?.eventenddate;
                        if (start && end) {
                            const targetDateNum = parseInt(targetStr.replace(/-/g, ''));
                            if (targetDateNum < parseInt(start) - 3 || targetDateNum > parseInt(end) + 2) continue;
                        }
                    } else if (cat === 'GAS_STATION') {
                        s = 50;
                        const priceMatch = item.description?.match(/(\d+)원/);
                        if (priceMatch) s += Math.max(0, Math.floor((2500 - parseInt(priceMatch[1])) / 10));
                    }

                    const k = `${name}|${item.address}`;
                    const dist = item.distance_meters || 99999;
                    if (map.has(k)) { 
                        // [User Request] 동일 장소(상호+주소) 중복 시 점수 누적 합산
                        if(cat==='RESTAURANT') map.get(k).trust_score += (s - 10); 
                        else if(s > map.get(k).trust_score) map.get(k).trust_score = s; 
                        // 거리는 해당 캠핑장에서 가장 가까운 거리 유지
                        if(dist < map.get(k).distance) map.get(k).distance = dist;
                    } else {
                        map.set(k, { ...item, trust_score: s, distance: dist });
                    }
                }
            }

            const penaltyMap = { RESTAURANT: 3.0, SPOT: 0.5, MART: 2.0, HOSPITAL: 5.0, GAS_STATION: 2.0, FESTIVAL: 1.0 };
            
            // [v11.9.13] Stage 1: Raw Aggregated Result (Sort by Quality only for logging)
            const stage1 = Array.from(map.values()).sort((a,b) => b.trust_score - a.trust_score);
            rawCandidatesForAudit.push(...stage1.map(x => ({ ...x, stage: 1 })));

            // [v11.9.13] Stage 2: Hybrid Priority (Quality + Prestige - Distance Penalty)
            const stage2 = Array.from(map.values()).map(x => {
                const distKm = x.distance / 1000;
                const penalty = distKm * (penaltyMap[cat] || 1.0);
                
                let prestigeScore = 0;
                if (cat === 'SPOT') {
                    // [v11.9.15] SSOT-first Scoring: Trust the Unified Master DB Tier
                    let tier = x.raw_data?.tier;
                    
                    // Fallback to real-time matching only if DB has no tier (Safety Net)
                    if (!tier) {
                        const rawSigungu = x.sigungu || extractSigungu(x.address) || '';
                        const cleanName = getCleanString(x.name);
                        const normSigungu = rawSigungu.replace(/[시군구]$/, '');
                        const matchKey = `${cleanName}|${normSigungu}`;
                        tier = PRESTIGE_MAP.get(matchKey);
                        
                        if (!tier) {
                            for (let [key, val] of PRESTIGE_MAP.entries()) {
                                if (key.startsWith(cleanName + '|')) { tier = val; break; }
                            }
                        }
                    }
                    
                    if (tier === 1) prestigeScore = 100;
                    else if (tier === 2) prestigeScore = 80;
                }

                return { ...x, prestigeScore, final_score: parseFloat((x.trust_score + prestigeScore - penalty).toFixed(2)) };
            }).sort((a,b) => {
                if (b.final_score !== a.final_score) return b.final_score - a.final_score;
                return a.distance - b.distance;
            });

            // 마트 부족 시 편의점 폴백 (Step B-Fallback)
            if (cat === 'MART' && stage2.length < 3) {
                console.log(`  -> Mart low (${stage2.length}), triggering CS2 fallback...`);
                try {
                    const fallbackRes = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?category_group_code=CS2&x=${lngs[0]}&y=${lats[0]}&radius=10000&size=5`, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } }).then(r=>r.json());
                    if (fallbackRes.documents) {
                        fallbackRes.documents.forEach(d => {
                            stage2.push({
                                id: generateFactId('KAKAO_CS2', d.place_name, d.address_name),
                                api_source: 'KAKAO_CS2', category: 'MART',
                                name: d.place_name, address: d.address_name, trust_score: 40, isFallback: true, distance: parseInt(d.distance),
                                lat: parseFloat(d.y), lng: parseFloat(d.x), raw_data: d
                            });
                        });
                    }
                } catch {}
            }

            const sliced = stage2.slice(0, limit);
            rawCandidatesForAudit.push(...sliced.map(x => ({ ...x, stage: 2 })));
            metrics.quota_flow[cat].quota += sliced.length;
            clusterCands.push(...sliced);
        }

        // [v11.9.13] Audit Report Upgrade: Dual Section (Stage 1 vs Stage 2)
        if (rawCandidatesForAudit.length > 0) {
            let auditContent = `# 3일 전 스마트 플랜 캐싱 정밀 분석 리포트 (${targetStr})\n\n`;
            
            auditContent += `## [SECTION 1] 1차 쿼터 DB 수집 리스트 (품질 우선 정제 전)\n`;
            auditContent += `| 번호 | 카테고리 | 이름 | 품질 점수 | 주소 | 거리(m) |\n`;
            auditContent += `| :--- | :--- | :--- | :---: | :--- | :---: |\n`;
            let s1Idx = 1;
            rawCandidatesForAudit.filter(x => x.stage === 1).forEach(c => {
                auditContent += `| ${s1Idx++} | ${c.category} | ${c.name} | ${c.trust_score} | ${c.address} | ${Math.round(c.distance)} |\n`;
            });

            auditContent += `\n---\n\n## [SECTION 2] 2차 쿼터 하이브리드 최종 리스트 (품질-거리 최적화)\n`;
            auditContent += `| 번호 | 카테고리 | 이름 | 최종 점수 | 명성 점수 | 품질 점수 | 거리(km) | 주소 |\n`;
            auditContent += `| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |\n`;
            let s2Idx = 1;
            rawCandidatesForAudit.filter(x => x.stage === 2).forEach(c => {
                auditContent += `| ${s2Idx++} | ${c.category} | ${c.name} | **${c.final_score}** | ${c.prestigeScore || 0} | ${c.trust_score} | ${(c.distance/1000).toFixed(1)} | ${c.address} |\n`;
            });

            fs.writeFileSync('spot_final_audit.md', auditContent, 'utf-8');
            console.log(`📝 Dual-stage Audit list generated: spot_final_audit.md`);
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

        // [v11.9.8 Optimization] 6.3 Throttling - 3s Delay between clusters
        if (idx < clusters.length - 1) {
            console.log(`  🕒 Throttling: Resting 3s before next cluster...`);
            await sleep(3000);
        }
    }

    // [v11.9.8 Optimization] Step A-4. Final Bulk Persistence to Master DB
    const nowBulk = new Date().toISOString();
    const sanitizeAndMap = (map) => Array.from(map.values())
        .filter(item => item.id && item.name && item.address && item.lat && item.lng)
        .map(item => ({
            ...item,
            address: item.address.trim(),
            sido: extractSido(item.address),
            location: { type: 'Point', coordinates: [item.lng, item.lat] },
            created_at: nowBulk,
            updated_at: nowBulk
        }));

    console.log(`🚀 Step A-4. Starting Bulk Upsert to master_places...`);
    await upsertAndTrack(sanitizeAndMap(aggregatedMaster.HOSPITAL), metrics.dynamic_api.HOSPITAL);
    await upsertAndTrack(sanitizeAndMap(aggregatedMaster.GAS_STATION), metrics.dynamic_api.GAS_STATION);
    await upsertAndTrack(sanitizeAndMap(aggregatedMaster.FESTIVAL), metrics.dynamic_api.FESTIVAL);

    const final = Array.from(totalFactMap.values());
    final.forEach(f => {
        if (metrics.quota_flow[f.category]) metrics.quota_flow[f.category].final++;
    });

    for (let i = 0; i < final.length; i += 500) await supabase.from('smart_plan_facts').upsert(final.slice(i, i + 500), { onConflict: 'id' });
    console.log(`🏁 Done: ${final.length} facts cached in smart_plan_facts.`);

    // Update dynamic API final total counts (Post-Upsert)
    const { count: finalH } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'HOSPITAL');
    const { count: finalG } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'GAS_STATION');
    const { count: finalF } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'FESTIVAL');
    metrics.dynamic_api.HOSPITAL.total = finalH || 0;
    metrics.dynamic_api.GAS_STATION.total = finalG || 0;
    metrics.dynamic_api.FESTIVAL.total = finalF || 0;

    // [v11.9.16] Execute Auto-Merge for SPOT (Final Cleanliness)
    const mergedSpots = await performSpatialMerge();
    metrics.dynamic_api.SPOT = { existing: 0, received: 0, new: 0, updated: 0, total: 0, merged: mergedSpots, note: '공간 병합 완료' };
    const { count: finalS } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('category', 'SPOT');
    metrics.dynamic_api.SPOT.total = finalS || 0;

    function printCachingAuditTable() {
        console.log(`\n📋 [Precision Audit Report] D-3 스마트 캐싱 (권역 API 정밀 동기화)`);
        console.log(`| 대상 스케줄 | 카테고리 | 기존 | 수신 | 신규 | 갱신 | 병합 | 최종 총계 | 비고 |`);
        console.log(`| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |`);
        
        const rows = [
            { cat: 'HOSPITAL', val: metrics.dynamic_api.HOSPITAL, source: 'NMC / Kakao' },
            { cat: 'GAS_STATION', val: metrics.dynamic_api.GAS_STATION, source: 'Opinet' },
            { cat: 'FESTIVAL', val: metrics.dynamic_api.FESTIVAL, source: 'TourAPI' },
            { cat: 'SPOT (Master)', val: metrics.dynamic_api.SPOT, source: 'Internal' }
        ];

        for (const r of rows) {
            const mergedStr = r.val.merged !== undefined ? r.val.merged.toLocaleString() : '-';
            console.log(`| ${targetStr} | ${r.cat} | ${r.val.existing.toLocaleString()} | ${r.val.received.toLocaleString()} | ${r.val.new.toLocaleString()} | ${r.val.updated.toLocaleString()} | ${mergedStr} | ${r.val.total.toLocaleString()} | ${r.val.note || r.source} |`);
        }
        console.log(`\n✨ [Smart Plan Caching] 중복 제거 및 공간 병합 정규화 완료!\n`);
    }

    printCachingAuditTable();
    await recordAutomationLog(metrics, targetStr, 'SUCCESS');
    process.exit(0);
}

async function recordAutomationLog(metrics, targetDate, status) {
    console.log(`📊 Recording automation log for ${targetDate}...`);
    
    // SOP v11 Part 1 & 2 Structure
    const apiStatus = Object.entries(metrics.dynamic_api).map(([cat, val]) => ({
        region: `${targetDate}`,
        title: cat === 'HOSPITAL' ? 'HOSPITAL (일반/응급)' : (cat === 'GAS_STATION' ? 'GAS_STATION (주유소)' : 'FESTIVAL (지역행사)'),
        category: cat,
        existing: val.existing,
        received: val.received,
        new: val.new,
        updated: val.updated,
        merged: val.merged || 0,
        total: val.total,
        note: val.note || '권역 병합(Radius)'
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

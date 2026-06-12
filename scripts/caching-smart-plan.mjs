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
                    PRESTIGE_MAP.set(key, { tier: 1, name: '한국관광 100선' });
                });
            }
        });

        // Tier 2 Parsing (v11.9.15 Ultimate Fix)
        let t2Sigungu = '', t2BadgeName = '';
        t2.split('\n').forEach(line => {
            const h3Match = line.match(/^### (.+?)(?:\s+\(|$)/);
            const listMatch = line.match(/^- \*\*(.+?)(?:\(.+?\))?:\*\*\s+(.+)$/);
            
            if (h3Match) {
                t2Sigungu = h3Match[1].trim().replace(/[시군구]$/, '');
                t2BadgeName = `${t2Sigungu} 8경`;
            } else if (listMatch) {
                const sigungu = listMatch[1].trim().replace(/[시군구]$/, '');
                const badge = `${sigungu} 8경`;
                const names = listMatch[2].split(',').map(n => n.trim()).filter(n => n);
                names.forEach(n => {
                    const key = getCleanString(n) + '|' + sigungu;
                    PRESTIGE_MAP.set(key, { tier: 2, name: badge });
                });
            } else if (line.startsWith('- ') && t2Sigungu) {
                const names = line.replace('- ', '').split(',').map(n => n.trim()).filter(n => n);
                names.forEach(n => {
                    const key = getCleanString(n) + '|' + t2Sigungu;
                    PRESTIGE_MAP.set(key, { tier: 2, name: t2BadgeName });
                });
            }
        });
        
        // Debug: Check if Yesan is loaded
        console.log(`✅ Prestige List Loaded: ${PRESTIGE_MAP.size} items mapped.`);
    } catch (e) {
        console.warn(`⚠️ Failed to load prestige lists: ${e.message}`);
    }
}

function getStandardNmcSido(sido) {
    if (!sido) return '';
    const cleanSido = sido.trim();
    const nmcSidoMap = {
        '서울특별시': '서울특별시', '서울': '서울특별시',
        '부산광역시': '부산광역시', '부산': '부산광역시',
        '대구광역시': '대구광역시', '대구': '대구광역시',
        '인천광역시': '인천광역시', '인천': '인천광역시',
        '광주광역시': '광주광역시', '광주': '광주광역시',
        '대전광역시': '대전광역시', '대전': '대전광역시',
        '울산광역시': '울산광역시', '울산': '울산광역시',
        '세종특별자치시': '세종특별자치시', '세종': '세종특별자치시',
        '경기도': '경기도', '경기': '경기도',
        '강원특별자치도': '강원특별자치도', '강원도': '강원특별자치도', '강원': '강원특별자치도',
        '충청북도': '충청북도', '충북': '충청북도',
        '충청남도': '충청남도', '충남': '충청남도',
        '전북특별자치도': '전북특별자치도', '전라북도': '전북특별자치도', '전북': '전북특별자치도',
        '전라남도': '전라남도', '전남': '전라남도',
        '경상북도': '경상북도', '경북': '경상북도',
        '경상남도': '경상남도', '경남': '경상남도',
        '제주특별자치도': '제주특별자치도', '제주도': '제주특별자치도', '제주': '제주특별자치도',
        '전남광주통합시': '전남광주통합시'
    };
    return nmcSidoMap[cleanSido] || cleanSido.substring(0, 2);
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
    a = a.replace(/^(세종특별자치시|세종)\s?/, '세종특별자치시 ');
    a = a.replace(/^(경기도|경기)\s?/, '경기도 ');
    a = a.replace(/^(강원특별자치도|강원도|강원)\s?/, '강원특별자치도 ');
    a = a.replace(/^(충청북도|충북)\s?/, '충청북도 ');
    a = a.replace(/^(충청남도|충남)\s?/, '충청남도 ');
    a = a.replace(/^(전북특별자치도|전라북도|전북)\s?/, '전북특별자치도 ');
    a = a.replace(/^(전라남도|전남)\s?/, '전라남도 ');
    a = a.replace(/^(경상북도|경북)\s?/, '경상북도 ');
    a = a.replace(/^(경상남도|경남)\s?/, '경상남도 ');
    a = a.replace(/^(제주특별자치도|제주도|제주)\s?/, '제주특별자치도 ');
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
    if (sido === '세종특별자치시') return ''; // [v11.9.69] Sejong has no Sigungu level
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

// [v11.9.23] Haversine 거리 계산 (km 단위)
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function upsertAndTrack(items, metricObj) {
    if (!items || items.length === 0) return;
    items = items.filter(it => it.id && it.name && it.address && it.lat && it.lng);
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
    const startTime = Date.now();
    const args = process.argv.slice(2);
    const dateArg = args.find(a => a.startsWith('--target-date='))?.split('=')[1];
    const forceArg = args.includes('--force');
    
    // [v11.9.80] KST 오늘 날짜 구하기
    const todayKst = new Date(new Date().getTime() + 12 * 3600000);
    const todayStr = todayKst.toISOString().split('T')[0];
    
    let targetStr = dateArg || new Date(new Date().getTime() + 12 * 3600000 + 3 * 86400000).toISOString().split('T')[0];
    const isSunday = new Date(targetStr).getDay() === 0;

    // 날짜 파싱 헬퍼 함수
    const parseDateStr = (str) => {
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

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
            RESTAURANT: { category: 'RESTAURANT', raw_pool: 0, union_pool: 0, verified: 0, personalized: 0 },
            SPOT: { category: 'SPOT', raw_pool: 0, union_pool: 0, verified: 0, personalized: 0 },
            MART: { category: 'MART', raw_pool: 0, union_pool: 0, verified: 0, personalized: 0 },
            HOSPITAL: { category: 'HOSPITAL', raw_pool: 0, union_pool: 0, verified: 0, personalized: 0 },
            GAS_STATION: { category: 'GAS_STATION', raw_pool: 0, union_pool: 0, verified: 0, personalized: 0 },
            FESTIVAL: { category: 'FESTIVAL', raw_pool: 0, union_pool: 0, verified: 0, personalized: 0 }
        }
    };

    console.log(`🚀 v11.6 | Target today: ${todayStr}`);
    
    loadPrestigeLists(); // [v11.9.15] Load MD lists once at start
    
    let rawSchedules = [];
    if (dateArg) {
        console.log(`  🔍 Manual target date: ${dateArg}`);
        const { data: schedules } = await supabase.from('user_schedules')
            .select('id, campground_lat, campground_lng, campground_name, campground_address, check_in, smart_plan_data')
            .eq('check_in', dateArg);
        rawSchedules = schedules || [];
    } else {
        const startTarget = new Date(todayKst.getTime() + 0 * 86400000).toISOString().split('T')[0];
        const endTarget = new Date(todayKst.getTime() + 10 * 86400000).toISOString().split('T')[0];
        console.log(`  🔍 Auto-rolling caching range: ${startTarget} ~ ${endTarget}`);
        const { data: schedules } = await supabase.from('user_schedules')
            .select('id, campground_lat, campground_lng, campground_name, campground_address, check_in, smart_plan_data')
            .gte('check_in', startTarget)
            .lte('check_in', endTarget);
        rawSchedules = schedules || [];
    }
    
    if (!rawSchedules.length) {
        console.log(`  ℹ️ No reservations found. Skipping...`);
        await recordAutomationLog(metrics, targetStr, 'SKIPPED');
        process.exit(0);
    }

    // 대상 스케줄들의 기존 캐싱 이력 일괄 조회
    const scheduleIds = rawSchedules.map(s => s.id);
    const { data: existingCandidates, error: candError } = await supabase
        .from('smart_plan_candidates')
        .select('reservation_id, created_at')
        .in('reservation_id', scheduleIds);

    if (candError) {
        console.error(`  ❌ Failed to fetch existing candidates: ${candError.message}`);
    }

    const candidateMap = new Map();
    if (existingCandidates) {
        existingCandidates.forEach(c => {
            const list = candidateMap.get(c.reservation_id) || [];
            list.push(new Date(c.created_at));
            candidateMap.set(c.reservation_id, list);
        });
    }

    // Skip Guard 적용 필터링 (D-10~D-4 및 D-3 이내 조건 체크)
    const todayDate = parseDateStr(todayStr);
    const filteredSchedules = [];
    
    for (const s of rawSchedules) {
        if (!s.check_in) continue;
        const checkInDate = parseDateStr(s.check_in);
        const daysDiff = Math.round((checkInDate - todayDate) / 86400000);

        const sCandidates = candidateMap.get(s.id) || [];
        const hasCandidates = sCandidates.length > 0;
        
        let latestCacheDate = null;
        if (hasCandidates) {
            latestCacheDate = new Date(Math.max(...sCandidates.map(d => d.getTime())));
        }

        if (forceArg) {
            console.log(`  🔥 Force option enabled. Bypassing skip guards for Schedule ${s.id}.`);
        } else if (s.smart_plan_data) {
            console.log(`  ℹ️ Schedule ${s.id} (${s.check_in}, D-${daysDiff}) already has finalized plan. Skipping...`);
            continue;
        } else if (hasCandidates) {
            if (daysDiff > 3) {
                // 중기 구간 (D-10 ~ D-4)이고 이미 캐싱된 후보군이 있으므로 스킵
                console.log(`  ℹ️ Schedule ${s.id} (${s.check_in}, D-${daysDiff}) already has mid-term cached candidates. Skipping...`);
                continue;
            } else {
                // 단기 구간 (D-3 이내): 캐싱 생성일과 체크인 날짜 비교
                const checkInMidnight = new Date(checkInDate);
                checkInMidnight.setHours(0, 0, 0, 0);
                const cacheMidnight = new Date(latestCacheDate);
                cacheMidnight.setHours(0, 0, 0, 0);
                
                const cacheDaysDiff = Math.round((checkInMidnight - cacheMidnight) / 86400000);
                
                if (cacheDaysDiff <= 3) {
                    // 단기 구간 진입 후 이미 단기 캐싱이 돌았으므로 스킵
                    console.log(`  ℹ️ Schedule ${s.id} (${s.check_in}, D-${daysDiff}) already has short-term cached candidates (cached D-${cacheDaysDiff}). Skipping...`);
                    continue;
                }
                console.log(`  🔄 Schedule ${s.id} (${s.check_in}, D-${daysDiff}) has mid-term cache (cached D-${cacheDaysDiff}) but now enters D-3 short-term window. Updating cache...`);
            }
        } else {
            console.log(`  🆕 Schedule ${s.id} (${s.check_in}, D-${daysDiff}) is new. Proceeding to cache...`);
        }
        filteredSchedules.push(s);
    }

    if (filteredSchedules.length === 0) {
        console.log(`  ℹ️ All schedules filtered out by cache skip guards. Exit.`);
        process.exit(0);
    }

    // 뒷부분 로직의 호환성을 위해 schedules 변수에 덮어씀
    const schedules = filteredSchedules;
    metrics.reservations = schedules.length;

    let clusters = [];
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
            cluster.reservations.push({ id: s.id, lat, lng, name: campground_name });
        }
        else clusters.push({ points: [{ lat, lng }], names: [campground_name], address: address, reservations: [{ id: s.id, lat, lng, name: campground_name }] });
    }

    metrics.clusters = clusters.length;

    // [v11.9.8 Optimization] Step A-0. Accumulators for Bulk Persistence
    const QUOTAS = { FESTIVAL: 20, HOSPITAL: 10, GAS_STATION: 30 };
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

    let rawCandidatesForAudit = []; // [v11.9.19] Moved outside to aggregate all clusters
    let allCandidateRows = []; // [v11.9.23] Stage 4 결과 전체 클러스터 누적
    const allFactsMap = new Map(); // [v11.9.62] Global accumulator for smart_plan_facts

    for (let idx = 0; idx < clusters.length; idx++) {
        const totalFactMap = new Map(); // [v11.9.61] Moved inside to ensure cluster isolation
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
            const ptSido = extractSido(address);
            const ptSigungu = extractSigungu(address);

            console.log(`  🚀 Fetching dynamic data for point: (${ptLat.toFixed(4)}, ${ptLng.toFixed(4)}) in ${ptSigungu || ptSido}...`);
            const fetchTasks = [];

            // A-1. Hospital (Query master_places within 30km, group by SIDO, fetch live NMC data, and merge)
            fetchTasks.push((async () => {
                try {
                    // 1. Query master_places (category = HOSPITAL) within 30km (30000m)
                    const { data: dbHospitals, error: dbErr } = await supabase.rpc('get_master_places_in_radius_v2', {
                        target_lat: ptLat,
                        target_lng: ptLng,
                        radius_meters: 30000,
                        p_category: 'HOSPITAL',
                        limit_count: 500
                    });

                    if (dbErr) {
                        console.error("  🏥 Error fetching hospitals from master_places:", dbErr.message);
                        return;
                    }

                    if (!dbHospitals || dbHospitals.length === 0) {
                        console.log(`  🏥 No hospitals found in master_places within 30km of (${ptLat.toFixed(4)}, ${ptLng.toFixed(4)}).`);
                        return;
                    }

                    console.log(`  🏥 Found ${dbHospitals.length} hospitals in master_places within 30km.`);

                    // 2. Extract unique SIDO names
                    const sidos = new Set();
                    for (const h of dbHospitals) {
                        const s = extractSido(h.address);
                        if (s) {
                            const stdSido = getStandardNmcSido(s);
                            if (stdSido) sidos.add(stdSido);
                        }
                    }

                    // 3. For each SIDO, fetch live NMC hospital data
                    const liveHospitalsMap = new Map();
                    for (const sido of sidos) {
                        console.log(`  📡 Querying live NMC data for SIDO: ${sido}...`);
                        try {
                            const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${PUBLIC_API_KEY}&STAGE1=${encodeURIComponent(sido)}&STAGE2=&pageNo=1&numOfRows=100&_type=json`;
                            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                            const data = await res.json();
                            const items = data.response?.body?.items?.item;

                            if (items) {
                                const itemList = Array.isArray(items) ? items : [items];
                                metrics.dynamic_api.HOSPITAL.received += itemList.length;
                                for (const item of itemList) {
                                    const hAddr = item.dutyAddr || '';
                                    const fid = generateFactId('NMC_HOSPITAL', item.dutyName, hAddr);
                                    liveHospitalsMap.set(fid, item);
                                    if (item.hpid) liveHospitalsMap.set(item.hpid, item);
                                    if (item.dutyName) liveHospitalsMap.set(item.dutyName, item);
                                }
                            }
                        } catch (err) {
                            console.error(`  ⚠️ NMC live fetch error for ${sido}:`, err.message);
                        }
                    }

                    // 4. Merge live NMC data with dbHospitals and store in aggregatedMaster
                    for (const h of dbHospitals) {
                        const liveItem = liveHospitalsMap.get(h.id) || 
                                         (h.raw_data?.hpid ? liveHospitalsMap.get(h.raw_data.hpid) : null) || 
                                         liveHospitalsMap.get(h.name);
                        
                        let trustScore = 150; // Keep NMC trust_score 150 as requested!
                        let badgeList = h.raw_data?.badges || [];
                        if (h.api_source !== 'NMC_HOSPITAL') {
                            trustScore = h.api_source === 'KAKAO_HP8' && !h.name?.match(/종합병원|의료원|대학병원/) ? 20 : 100;
                        }

                        if (!badgeList.includes('응급의료센터') && (h.api_source === 'NMC_HOSPITAL' || liveItem)) {
                            badgeList.push('응급의료센터');
                        }

                        const mergedRawData = {
                            ...(h.raw_data || {}),
                            ...(liveItem || {}),
                            badges: badgeList
                        };

                        const fact = {
                            id: h.id,
                            api_source: h.api_source,
                            category: 'HOSPITAL',
                            name: h.name,
                            description: liveItem ? '응급의료센터 (실시간 병상정보 연동)' : (h.description || '종합의료기관'),
                            address: h.address,
                            lat: h.lat,
                            lng: h.lng,
                            trust_score: trustScore,
                            raw_data: mergedRawData
                        };

                        aggregatedMaster.HOSPITAL.set(fact.id, fact);
                    }
                } catch (e) {
                    console.error("  🏥 Hospital Process Error:", e.message);
                }
            })());

            // A-1-2. Kakao Hospital (HP8)
            fetchTasks.push((async () => {
                try {
                    const kRes = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?category_group_code=HP8&x=${ptLng}&y=${ptLat}&radius=20000&size=15`, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } });
                    const kData = await kRes.json();
                    if (kData.documents) {
                        metrics.dynamic_api.HOSPITAL.received += kData.documents.length;
                        kData.documents.forEach((item) => {
                            const isBig = item.place_name?.match(/종합병원|의료원|대학병원/);
                            const fact = {
                                id: generateFactId('KAKAO_HP8', item.place_name, item.road_address_name || item.address_name),
                                api_source: 'KAKAO_HP8', category: 'HOSPITAL',
                                name: item.place_name, description: item.category_name || '일반 병원/의원', address: item.road_address_name || item.address_name || '주소정보없음',
                                lat: parseFloat(item.y), lng: parseFloat(item.x),
                                trust_score: isBig ? 100 : 20, raw_data: item // [v11.9.64] 종합병원 기본 점수 100으로 조정 (밸런스 최적화)
                            };
                            aggregatedMaster.HOSPITAL.set(fact.id, fact);
                        });
                    }
                } catch (e) { console.error("Kakao HP8 Error:", e.message); }
            })());

            // A-1-3. Kakao Big Hospital Search (Keyword Search to ensure inclusion)
            fetchTasks.push((async () => {
                try {
                    const searchBase = ptSigungu || ptSido; // [v11.9.69] Fallback to Sido if Sigungu is empty (Sejong)
                    const kRes = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchBase + ' 종합병원')}&x=${ptLng}&y=${ptLat}&radius=20000&size=10`, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } });
                    const kData = await kRes.json();
                    if (kData.documents) {
                        kData.documents.forEach((item) => {
                            const fact = {
                                id: generateFactId('KAKAO_BIG_HOSP', item.place_name, item.road_address_name || item.address_name),
                                api_source: 'KAKAO_BIG_HOSP', category: 'HOSPITAL',
                                name: item.place_name, description: '지역 종합의료기관', address: item.road_address_name || item.address_name || '주소정보없음',
                                lat: parseFloat(item.y), lng: parseFloat(item.x),
                                trust_score: 100, raw_data: item
                            };
                            aggregatedMaster.HOSPITAL.set(fact.id, fact);
                        });
                    }
                } catch (e) { console.error("Kakao Big Hospital Search Error:", e.message); }
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

        // [v11.9.18] Step A-1. Persist Dynamically Fetched Data BEFORE RPC/Audit
        for (const cat of ['HOSPITAL', 'FESTIVAL', 'GAS_STATION']) {
            const items = Array.from(aggregatedMaster[cat].values());
            if (items.length > 0) {
                console.log(`  💾 Persisting ${items.length} dynamically fetched ${cat} items...`);
                await upsertAndTrack(items, metrics.dynamic_api[cat]);
            }
        }

        // [v11.9.23] 1차 쿼터: 지점별 독립 스코어링 후 병합
        const categories = [
            { cat: 'RESTAURANT', limit: 50 },
            { cat: 'SPOT', limit: 50 },
            { cat: 'MART', limit: 20 },
            { cat: 'HOSPITAL', limit: 10 },
            { cat: 'GAS_STATION', limit: 10 },
            { cat: 'FESTIVAL', limit: 10 }
        ];

        let clusterCands = [];
        // [v11.9.19] Audit Report Scope: Move outside cluster loop to aggregate all data

        for (const { cat, limit } of categories) {
            const unionPool = new Map(); // [v11.9.23] 지점별 1차 쿼터 결과를 병합하는 최종 풀
            
            // 각 대표 지점별로 RPC 호출하여 광범위하게 수집 (데이터 편향 완벽 해소)
            for (const pt of repPoints) {
                const localMap = new Map(); // [v11.9.23] 지점별 독립 map
                let globalSpotScores = null;
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
                metrics.quota_flow[cat].raw_pool += data.length;

                const noise = /안경|의상|장례|보청기|수선|공방|부동산|세탁|학원|미용|세차|노래|당구|정신|피부|비만|디톡스|산후|동물|휴대폰|정비|공인중개|방앗간|이미용|사진관|약국|목공|주차장|행정|부서|부대시설/;
                const mart_blacklist = ['패션', '아울렛', '의류', '가전', '가구', '전자', '디지털프라자', '하이마트', '전자랜드'];
                for (const item of data) {
                    const name = (item.name || '').trim();
                    const induty = (item.raw_data?.INDUTY_NM || item.raw_data?.indutyNm || '').trim();
                    const biz = (item.raw_data?.biz_name || item.raw_data?.BIZPLC_NM || '').trim();
                    if (noise.test(name) || noise.test(induty) || noise.test(biz)) continue;

                    let s = 10; // Base score
                    if (cat === 'RESTAURANT') {
                        if (!item.raw_data) item.raw_data = {};
                        if (!item.raw_data.badges) item.raw_data.badges = [];
                        
                        // [Cumulative Certification Logic]
                        if (item.api_source === 'LX_RESTAURANT') { s += 50; item.raw_data.badges.push('LX인증맛집'); }
                        if (item.api_source === 'SMBA_BAEK') { s += 50; item.raw_data.badges.push('백년가게'); }
                        if (item.api_source === 'LOCALDATA_RESTAURANT_GOOD') { s += 30; item.raw_data.badges.push('모범음식점'); }
                        if (item.api_source === 'SAFE_RESTAURANT' || item.api_source === 'LOCALDATA_RESTAURANT_SAFE') { s += 20; item.raw_data.badges.push('안심식당'); }
                        
                        // [Vignette keywords for premium branding]
                        const nameCerts = { '미쉐린': '미쉐린 가이드', '미슐랭': '미쉐린 가이드', '블루리본': '블루리본', '식신': '식신 더베스트' };
                        for (const [kw, b] of Object.entries(nameCerts)) {
                            if (name.includes(kw)) {
                                if (!item.raw_data.badges.includes(b)) {
                                    item.raw_data.badges.push(b);
                                    if (s < 110) s = 110; 
                                }
                            }
                        }

                        if (s <= 10) continue; 
                    } else if (cat === 'MART') {
                        // [v11.9.22] Big Brands first but EXCLUDING SSM sub-brands
                        if (/이마트|롯데마트|홈플러스|트레이더스|하나로|NH/.test(name)) {
                            if (/에브리데이|익스프레스|노브랜드|GS더프레시/.test(name)) s = 70;
                            else s = 80;
                        } else {
                            s = 70; // General Mart/Super
                        }
                        if (/아울렛|패션|의류|디지털|하이마트|전자랜드|가구|가전|타운/.test(name)) continue;
                    } else if (cat === 'SPOT') {
                        // [v2.6 Hybrid Engine] Prestige & Popularity Synthesis (v11.9.18 Optimized Outside)
                        if (!globalSpotScores) {
                            const spotData = data.filter(d => d.category === 'SPOT');
                            const inScoreMap = new Map();
                            const freqMap = new Map();
                            const nameToId = new Map();
                            spotData.forEach(x => nameToId.set(x.name.trim(), x.id));
                            
                            spotData.forEach(spot => {
                                (spot.raw_data?.tmap_related || []).forEach(rel => {
                                    const targetId = nameToId.get(rel.target.trim());
                                    if (targetId) {
                                        const score = 1 / Math.log2(rel.rank + 1);
                                        inScoreMap.set(targetId, (inScoreMap.get(targetId) || 0) + score);
                                        freqMap.set(targetId, (freqMap.get(targetId) || 0) + 1);
                                    }
                                });
                            });

                            const sortedRawRelated = spotData.map(s => ({ id: s.id, val: (inScoreMap.get(s.id) || 0) * (1 + Math.log1p(freqMap.get(s.id) || 0)) })).sort((a,b) => b.val - a.val);

                            globalSpotScores = new Map();
                            spotData.forEach(spot => {
                                let prestigeScore = 15;
                                const cleanName = getCleanString(spot.name);
                                const normSigungu = (spot.sigungu || extractSigungu(spot.address) || '').replace(/[시군구]$/, '');
                                const matchKey = `${cleanName}|${normSigungu}`;
                                const dynamicMatch = PRESTIGE_MAP.get(matchKey);
                                const dbTier = spot.raw_data?.tier;
                                const tier = dbTier || dynamicMatch?.tier;
                                
                                if (!spot.raw_data) spot.raw_data = { badges: [] };
                                if (!spot.raw_data.badges) spot.raw_data.badges = [];
                                
                                if (dynamicMatch) {
                                    if (!spot.raw_data.badges.includes(dynamicMatch.name)) spot.raw_data.badges.push(dynamicMatch.name);
                                } else if (dbTier) {
                                    const badge = dbTier === 1 ? '한국관광 100선' : '지역 8경';
                                    if (!spot.raw_data.badges.includes(badge)) spot.raw_data.badges.push(badge);
                                }

                                if (tier === 1) prestigeScore = 100; else if (tier === 2) prestigeScore = 80;

                                let ktoScore = 10;
                                const ktoRank = spot.raw_data?.kto_official?.rank;
                                if (ktoRank && ktoRank <= 100) ktoScore = 100 * (1 - (ktoRank - 1) / 100);
                                else {
                                    const tmapRank = sortedRawRelated.findIndex(x => x.id === spot.id);
                                    ktoScore = ((sortedRawRelated.length - 1 - tmapRank) / Math.max(1, sortedRawRelated.length - 1)) * 100;
                                }
                                const tmapIdx = sortedRawRelated.findIndex(x => x.id === spot.id);
                                const tmapScore = ((sortedRawRelated.length - 1 - tmapIdx) / Math.max(1, sortedRawRelated.length - 1)) * 100;
                                const ktScore = parseFloat(spot.raw_data?.kt_concentration || spot.raw_data?.popularity_v2?.base_pop || 10);
                                const combinedPop = (ktoScore * 0.6) + (tmapScore * 0.2) + (ktScore * 0.2);
                                const confMultiplier = 0.8 + (0.2 * ((spot.raw_data?.tmap_related?.length > 0 ? 0.4 : 0) + (ktScore > 10 ? 0.3 : 0) + (tier ? 0.3 : 0)));
                                globalSpotScores.set(spot.id, Math.round(((prestigeScore * 0.5) + (combinedPop * 0.5)) * confMultiplier));
                            });
                        }
                        s = globalSpotScores.get(item.id) || 10;
                    } else if (cat === 'HOSPITAL') {
                        if (!item.raw_data) item.raw_data = {};
                        if (!item.raw_data.badges) item.raw_data.badges = [];

                        const indutyH = (item.raw_data?.INDUTY_NM || item.raw_data?.indutyNm || '').trim();
                        // [v11.9.72] NMC API 출처라면 무조건 응급의료센터 뱃지 부여
                        const isNMC = item.api_source === 'NMC_HOSPITAL';
                        
                        if (isNMC || item.api_source === 'KAKAO_BIG_HOSP' || /종합병원|의료원|대학병원/.test(name)) {
                            s = isNMC ? 150 : 100;
                            
                            if (isNMC) {
                                if (!item.raw_data.badges.includes('응급의료센터')) item.raw_data.badges.push('응급의료센터');
                            }

                            if (/종합병원/.test(name) && !item.raw_data.badges.includes('종합병원')) item.raw_data.badges.push('종합병원');
                            if (/의료원/.test(name) && !item.raw_data.badges.includes('의료원')) item.raw_data.badges.push('의료원');
                            if (/대학병원/.test(name) && !item.raw_data.badges.includes('대학병원')) item.raw_data.badges.push('대학병원');
                        }
                        else if (/의원|병원/.test(name) || /내과|소아|외과|가정|일반|마취|응급|야간/.test(name) || /의원|병원/.test(indutyH)) s = 50;
                        else if (/보건소|보건지소/.test(name)) s = 40;
                        
                        const isEmergency = /응급|야간|24시|365/.test(name) || /응급|야간|24시/.test(item.description || '');
                        if (isEmergency) {
                            s += 40;
                            if (!item.raw_data.badges.includes('24시 응급')) item.raw_data.badges.push('24시 응급');
                        }
                        if (/성형|피부|비만|치과|한의원|안과|산후|요양|동물|주차장|행정|부서|편의점|이마트24|GS25|CU|부대시설|구두/.test(name)) continue;
                    } else if (cat === 'GAS_STATION') {
                        s = 50;
                        const priceMatch = item.description?.match(/(\d+)원/);
                        if (priceMatch) s += Math.max(0, Math.floor((2500 - parseInt(priceMatch[1])) / 10));
                    } else if (cat === 'FESTIVAL') {
                        s = 45;
                        const start = item.raw_data?.eventstartdate;
                        const end = item.raw_data?.eventenddate;
                        if (!start || !end) continue; 
                        
                        const targetDateNum = parseInt(targetStr.replace(/-/g, ''));
                        if (targetDateNum < parseInt(start) - 3 || targetDateNum > parseInt(end) + 2) continue;
                    }

                    // [v11.9.21] MART는 주소를 키로 사용 (상호 미세 불일치 중복 제거)
                    const k = (cat === 'MART') ? `ADDR|${item.address}` : `${name}|${item.address}`;
                    const dist = item.distance_meters || 99999;
                    if (localMap.has(k)) { 
                        const existing = localMap.get(k);
                        if (cat === 'RESTAURANT' || cat === 'HOSPITAL') {
                            const oldB = existing.raw_data?.badges || [];
                            const newB = item.raw_data?.badges || [];
                            if (!existing.raw_data) existing.raw_data = {};
                            const mergedBadges = Array.from(new Set([...oldB, ...newB]));
                            existing.raw_data.badges = mergedBadges;

                            if (cat === 'RESTAURANT') {
                                let totalScore = 10;
                                if (mergedBadges.includes('LX인증맛집')) totalScore += 50;
                                if (mergedBadges.includes('백년가게')) totalScore += 50;
                                if (mergedBadges.includes('모범음식점')) totalScore += 30;
                                if (mergedBadges.includes('안심식당')) totalScore += 20;

                                const nameCerts = { '미쉐린': '미쉐린 가이드', '미슐랭': '미쉐린 가이드', '블루리본': '블루리본', '식신': '식신 더베스트' };
                                const name = existing.name;
                                for (const [kw, b] of Object.entries(nameCerts)) {
                                    if (name.includes(kw) || mergedBadges.includes(b)) {
                                        if (totalScore < 110) totalScore = 110;
                                    }
                                }
                                existing.trust_score = totalScore;
                            } else {
                                // HOSPITAL
                                if (s > existing.trust_score) existing.trust_score = s;
                            }
                        }
                        else if(cat === 'MART') {
                            if(name.length > existing.name.length) existing.name = name;
                            if(s > existing.trust_score) existing.trust_score = s;
                        }
                        else if(s > existing.trust_score) existing.trust_score = s; 
                        
                        if(dist < existing.distance) existing.distance = dist;
                    } else {
                        localMap.set(k, { ...item, name, trust_score: s, distance: dist });
                    }
                }

                // [v11.9.23] 지점별 1차 쿼터: trust_score 순 정렬 → 상위 N개
                const localStage1 = Array.from(localMap.values())
                    .sort((a, b) => b.trust_score - a.trust_score)
                    .slice(0, limit);

                // unionPool에 병합 (중복 시 높은 점수 유지 + 인증 합산)
                for (const item of localStage1) {
                    const uk = (cat === 'MART' || cat === 'HOSPITAL') ? `ADDR|${getCleanString(item.address)}` : `${item.name}|${item.address}`;
                    if (unionPool.has(uk)) {
                        const ex = unionPool.get(uk);
                        if (cat === 'RESTAURANT' || cat === 'HOSPITAL') {
                            const oldB = ex.raw_data?.badges || [];
                            const newB = item.raw_data?.badges || [];
                            if (!ex.raw_data) ex.raw_data = {};
                            const mergedBadges = Array.from(new Set([...oldB, ...newB]));
                            ex.raw_data.badges = mergedBadges;

                            if (cat === 'RESTAURANT') {
                                let totalScore = 10;
                                if (mergedBadges.includes('LX인증맛집')) totalScore += 50;
                                if (mergedBadges.includes('백년가게')) totalScore += 50;
                                if (mergedBadges.includes('모범음식점')) totalScore += 30;
                                if (mergedBadges.includes('안심식당')) totalScore += 20;

                                const nameCerts = { '미쉐린': '미쉐린 가이드', '미슐랭': '미쉐린 가이드', '블루리본': '블루리본', '식신': '식신 더베스트' };
                                const name = ex.name;
                                for (const [kw, b] of Object.entries(nameCerts)) {
                                    if (name.includes(kw) || mergedBadges.includes(b)) {
                                        if (totalScore < 110) totalScore = 110;
                                    }
                                }
                                ex.trust_score = totalScore;
                            } else {
                                // HOSPITAL
                                if (item.trust_score > ex.trust_score) ex.trust_score = item.trust_score;
                            }
                        } else if (item.trust_score > ex.trust_score) {
                            unionPool.set(uk, item);
                        } else if (item.trust_score === ex.trust_score && item.name.length > ex.name.length) {
                            ex.name = item.name; // Keep longer formal name
                        }
                    } else {
                        unionPool.set(uk, item);
                    }
                }
            }

            // [v11.9.23] Union Pool 출력: 지점별 1차 쿼터 병합 결과
            const poolArray = Array.from(unionPool.values()).sort((a, b) => b.trust_score - a.trust_score);
            rawCandidatesForAudit.push(...poolArray.map(x => ({ ...x, stage: 1 })));
            metrics.quota_flow[cat].union_pool += poolArray.length;

            // 마트 부족 시 편의점 폴백 (Step B-Fallback)
            if (cat === 'MART' && poolArray.length < 3) {
                console.log(`  -> Mart low (${poolArray.length}), triggering CS2 fallback...`);
                try {
                    const fallbackRes = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?category_group_code=CS2&x=${repPoints[0].lng}&y=${repPoints[0].lat}&radius=10000&size=5`, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } }).then(r=>r.json());
                    if (fallbackRes.documents) {
                        fallbackRes.documents.forEach(d => {
                            poolArray.push({
                                id: generateFactId('KAKAO_CS2', d.place_name, d.address_name),
                                api_source: 'KAKAO_CS2', category: 'MART',
                                name: d.place_name, address: d.address_name, trust_score: 40, isFallback: true, distance: parseInt(d.distance),
                                lat: parseFloat(d.y), lng: parseFloat(d.x), raw_data: d
                            });
                        });
                    }
                } catch {}
            }

            clusterCands.push(...poolArray);
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
                    allFactsMap.set(safeFact.id, safeFact); // [v11.9.62] Sync to global map
                }
            }));
        }

        // ━━━━ [v11.9.23] Stage 4: 예약자별 개인화 (거리감점 + 2차 쿼터) ━━━━
        const penaltyFactors = { RESTAURANT: 3.0, SPOT: 2.0, MART: 3.0, HOSPITAL: 3.0, GAS_STATION: 2.0, FESTIVAL: 1.0 };
        const secondQuota = { RESTAURANT: 15, SPOT: 15, MART: 12, HOSPITAL: 6, GAS_STATION: 6, FESTIVAL: 6 };
        const verifiedPool = Array.from(totalFactMap.values());
        const candidateRows = [];

        console.log(`  📊 Stage 4: Personalizing ${verifiedPool.length} verified facts for ${cluster.reservations.length} reservations...`);

        for (const reservation of cluster.reservations) {
            for (const [cat, quota] of Object.entries(secondQuota)) {
                const catItems = verifiedPool.filter(f => f.category === cat);
                const scored = catItems.map(item => {
                    const distKm = haversineKm(reservation.lat, reservation.lng, item.lat, item.lng);
                    const penalty = distKm * (penaltyFactors[cat] || 1.0);
                    return {
                        ...item,
                        distance_km: distKm,
                        final_score: parseFloat((item.trust_score - penalty).toFixed(2))
                    };
                })
                .sort((a, b) => b.final_score - a.final_score)
                .slice(0, quota);

                candidateRows.push(...scored.map(s => ({
                    reservation_id: reservation.id,
                    fact_id: s.id,
                    category: cat,
                    name: s.name,
                    address: s.address,
                    lat: s.lat,
                    lng: s.lng,
                    quality_score: s.trust_score,
                    distance_meters: Math.round(s.distance_km * 1000),
                    penalty_score: parseFloat((s.trust_score - s.final_score).toFixed(2)),
                    final_score: s.final_score,
                    raw_data: s.raw_data
                })));

                // [v11.9.23] Stage 4: 예약자별 최종 적재량 카운트 (개인별 쿼터 누적)
                metrics.quota_flow[cat].personalized += scored.length;
            }
        }

        // [v11.9.82] Clean up existing candidates for the reservations in this cluster before upserting new ones
        const reservationIds = cluster.reservations.map(r => r.id);
        if (reservationIds.length > 0) {
            console.log(`  🧹 Deleting existing candidates for ${reservationIds.length} reservations...`);
            const { error: delErr } = await supabase.from('smart_plan_candidates')
                .delete()
                .in('reservation_id', reservationIds);
            if (delErr) {
                console.error(`  ❌ Failed to delete existing candidates: ${delErr.message}`);
            }
        }

        // Stage 4 Bulk Upsert to smart_plan_candidates
        if (candidateRows.length > 0) {
            for (let i = 0; i < candidateRows.length; i += 500) {
                const { error: candErr } = await supabase.from('smart_plan_candidates')
                    .upsert(candidateRows.slice(i, i + 500), { onConflict: 'reservation_id,fact_id' });
                if (candErr) console.error(`  ❌ Candidate Upsert Error: ${candErr.message}`);
            }
            console.log(`  ✅ Stage 4 Complete: ${candidateRows.length} candidates for ${cluster.reservations.length} reservations.`);
            allCandidateRows.push(...candidateRows);
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

    const final = Array.from(allFactsMap.values());
    final.forEach(f => {
        metrics.quota_flow[f.category].final++;
    });

    for (let i = 0; i < final.length; i += 500) await supabase.from('smart_plan_facts').upsert(final.slice(i, i + 500), { onConflict: 'id' });
    console.log(`🏁 Done: ${final.length} facts cached in smart_plan_facts.`);

    // [v11.9.23] Generate Audit Reports (Enhanced Stage 1 & Stage 4)
    if (rawCandidatesForAudit.length > 0) {
        let stage1Content = `# 1차 쿼터 DB 수집 리스트 (D-3 캐싱: ${targetStr})\n\n`;
        stage1Content += `| 번호 | 카테고리 | 이름 | 품질 점수 | 인증/명성 | 주소 | 거리(m) |\n`;
        stage1Content += `| :--- | :--- | :--- | :---: | :---: | :--- | :---: |\n`;
        let s1Idx = 1;
        rawCandidatesForAudit.filter(x => x.stage === 1).forEach(c => {
            const b = Array.from(new Set(c.raw_data?.badges || [])).join(', ');
            stage1Content += `| ${s1Idx++} | ${c.category} | ${c.name} | ${c.trust_score} | ${b} | ${c.address} | ${Math.round(c.distance)} |\n`;
        });
        fs.writeFileSync('smart_plan_stage1_full.md', stage1Content, 'utf-8');
        console.log(`📝 Stage 1 report generated: smart_plan_stage1_full.md`);
    }

    if (allCandidateRows.length > 0) {
        let stage4Content = `# 2차 쿼터 개인화 적용 리스트 (D-3 캐싱: ${targetStr})\n\n`;
        stage4Content += `| 번호 | 예약ID | 카테고리 | 이름 | 품질 | 인증/명성 | 거리(km) | 감점 | 최종 점수 | 주소 |\n`;
        stage4Content += `| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |\n`;
        allCandidateRows.forEach((c, i) => {
            const b = Array.from(new Set(c.raw_data?.badges || [])).join(', ');
            stage4Content += `| ${i+1} | ${c.reservation_id.slice(0,8)} | ${c.category} | ${c.name} | ${c.quality_score} | ${b} | ${(c.distance_meters/1000).toFixed(2)} | -${c.penalty_score.toFixed(1)} | **${c.final_score.toFixed(1)}** | ${c.address} |\n`;
        });
        fs.writeFileSync('smart_plan_stage4_personalized.md', stage4Content, 'utf-8');
        console.log(`📝 Stage 4 report generated: smart_plan_stage4_personalized.md`);
    }

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

    const finalLog = {
        job_name: 'SMART_PLAN_CACHING',
        status: 'SUCCESS',
        processed_count: metrics.reservations,
        target_date: targetStr,
        message: JSON.stringify({
            text: `D-3 Caching Completed for ${targetStr}`,
            quota_flow: Object.values(metrics.quota_flow)
        }),
        duration_ms: Date.now() - startTime,
        api_status: Object.values(metrics.dynamic_api)
    };
    await supabase.from('automation_logs').insert([finalLog]);

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

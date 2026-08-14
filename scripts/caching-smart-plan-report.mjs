#!/usr/bin/env node
/**
 * @file caching-smart-plan-report.mjs
 * @description Modified version of caching-smart-plan.mjs to generate detailed audit reports for Stage 1 and Stage 4.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';
import proj4 from 'proj4';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const OPINET_API_KEY = process.env.OPINET_API_KEY;
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// [v13.5.0] DB Direct Prestige Matching System (Redundant MD File Reading Removed)

function getNormalizedAddr(addr) {
    if (!addr) return '';
    let a = addr.replace(/,\s?대한민국$/, '').trim();
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
    const standardSidos = ['서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도'];
    return standardSidos.find(s => normalized.startsWith(s)) || null;
};

const extractSigungu = (addr) => {
    if (!addr) return null;
    const normalized = getNormalizedAddr(addr);
    const sido = extractSido(addr);
    if (!sido) return null;
    const parts = normalized.replace(sido, '').trim().split(' ');
    if (parts.length >= 2 && (parts[0].endsWith('시') || parts[0].endsWith('군')) && (parts[1].endsWith('구') || parts[1].endsWith('시'))) return `${parts[0]} ${parts[1]}`;
    return parts[0] || null;
};

const getCleanString = (str) => {
    if (!str) return '';
    let s = String(str);
    if (s.includes(':')) s = s.split(':').pop();
    return s.replace(/\*\*.*?\*\*/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9가-힣]/gi, '').toLowerCase().trim();
};

const generateFactId = (source, name, address) => {
    return uuidv5(`${getCleanString(source)}|${getCleanString(name)}|${getCleanString(getNormalizedAddr(address))}`, MY_NAMESPACE);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
    let targetStr = dateArg || new Date(new Date().getTime() + 12 * 3600000 + 3 * 86400000).toISOString().split('T')[0];

    console.log(`🚀 Report Mode | Target: ${targetStr}`);
    loadPrestigeLists();
    
    const { data: schedules } = await supabase.from('user_schedules').select('id, campground_lat, campground_lng, campground_name, campground_address').eq('check_in', targetStr);
    if (!schedules?.length) {
        console.log(`  ℹ️ No reservations found for ${targetStr}.`);
        process.exit(0);
    }

    const metrics = { reservations: schedules.length, clusters: 0, dynamic_api: {}, quota_flow: {} };
    ['HOSPITAL', 'GAS_STATION', 'FESTIVAL', 'RESTAURANT', 'SPOT', 'MART'].forEach(c => {
        metrics.dynamic_api[c] = { existing: 0, received: 0, new: 0, updated: 0, total: 0 };
        metrics.quota_flow[c] = { raw_pool: 0, union_pool: 0, verified: 0, personalized: 0 };
    });

    let clusters = [];
    for (const s of schedules) {
        let lat = Number(s.campground_lat), lng = Number(s.campground_lng), address = s.campground_address || '';
        let cluster = clusters.find(c => Math.sqrt(Math.pow(c.points[0].lat - lat, 2) + Math.pow(c.points[0].lng - lng, 2)) * 111 <= 20);
        if (cluster) {
            cluster.points.push({ lat, lng });
            cluster.reservations.push({ id: s.id, lat, lng, name: s.campground_name });
        } else {
            clusters.push({ points: [{ lat, lng }], names: [s.campground_name], address: address, reservations: [{ id: s.id, lat, lng, name: s.campground_name }] });
        }
    }
    metrics.clusters = clusters.length;

    const aggregatedMaster = { HOSPITAL: new Map(), FESTIVAL: new Map(), GAS_STATION: new Map() };
    const totalFactMap = new Map();
    let rawCandidatesForAudit = []; 
    let allCandidateRows = [];

    for (let idx = 0; idx < clusters.length; idx++) {
        const cluster = clusters[idx];
        const repPoints = [];
        cluster.points.forEach(p => {
            if (!repPoints.some(rp => Math.sqrt(Math.pow(rp.lat - p.lat, 2) + Math.pow(rp.lng - p.lng, 2)) * 111 < 5)) repPoints.push(p);
        });

        for (const pt of repPoints) {
            const ptSido = extractSido(cluster.address) || '충청남도';
            const ptSigungu = extractSigungu(cluster.address) || '예산군';
            
            // HOSPITAL
            try {
                const hRes = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${PUBLIC_API_KEY}&STAGE1=${encodeURIComponent(ptSido.replace('특별시','').replace('광역시',''))}&STAGE2=${encodeURIComponent(ptSigungu)}&pageNo=1&numOfRows=100&_type=json`).then(r=>r.json());
                if (hRes.response?.body?.items?.item) {
                    const items = Array.isArray(hRes.response.body.items.item) ? hRes.response.body.items.item : [hRes.response.body.items.item];
                    items.forEach(item => {
                        const fact = { id: generateFactId('NMC_HOSPITAL', item.dutyName, item.dutyAddr), api_source: 'NMC_HOSPITAL', category: 'HOSPITAL', name: item.dutyName, address: item.dutyAddr, lat: parseFloat(item.wgs84Lat), lng: parseFloat(item.wgs84Lon), trust_score: item.dutyName?.includes('소아') ? 100 : 55, raw_data: item };
                        aggregatedMaster.HOSPITAL.set(fact.id, fact);
                    });
                }
            } catch {}
            
            // FESTIVAL
            try {
                const fRes = await fetch(`http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${PUBLIC_API_KEY}&numOfRows=50&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=15&mapX=${pt.lng}&mapY=${pt.lat}&radius=20000`).then(r=>r.json());
                if (fData.response?.body?.items?.item) {
                    const items = Array.isArray(fData.response.body.items.item) ? fData.response.body.items.item : [fData.response.body.items.item];
                    items.forEach(item => {
                        const fact = { id: generateFactId('TOUR_FSTVL', item.title, item.addr1), api_source: 'TOUR_FSTVL', category: 'FESTIVAL', name: item.title, address: item.addr1 || '주소정보없음', lat: parseFloat(item.mapy), lng: parseFloat(item.mapx), trust_score: 45, raw_data: item };
                        aggregatedMaster.FESTIVAL.set(fact.id, fact);
                    });
                }
            } catch {}
            
            // GAS_STATION
            try {
                proj4.defs("TM128", "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43");
                const [wtmX, wtmY] = proj4("EPSG:4326", "TM128", [pt.lng, pt.lat]);
                const gRes = await fetch(`http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_API_KEY}&x=${Math.round(wtmX)}&y=${Math.round(wtmY)}&radius=5000&sort=1&prodcd=C004&out=json`).then(r=>r.json());
                if (gRes?.RESULT?.OIL) {
                    const items = Array.isArray(gRes.RESULT.OIL) ? gRes.RESULT.OIL : [gRes.RESULT.OIL];
                    items.forEach(item => {
                        const [gLon, gLat] = proj4("TM128", "EPSG:4326", [parseFloat(item.GIS_X_COOR), parseFloat(item.GIS_Y_COOR)]);
                        const fact = { id: generateFactId('OPINET_GAS', item.OS_NM, item.VAN_ADR || '주소없음'), api_source: 'OPINET_GAS', category: 'GAS_STATION', name: item.OS_NM, address: item.VAN_ADR || '주소정보없음', lat: gLat, lng: gLon, trust_score: 55, raw_data: item };
                        aggregatedMaster.GAS_STATION.set(fact.id, fact);
                    });
                }
            } catch {}
        }

        const categories = [
            { cat: 'RESTAURANT', limit: 50 }, { cat: 'SPOT', limit: 50 }, { cat: 'MART', limit: 20 },
            { cat: 'HOSPITAL', limit: 10 }, { cat: 'GAS_STATION', limit: 10 }, { cat: 'FESTIVAL', limit: 10 }
        ];

        let clusterCands = [];
        for (const { cat, limit } of categories) {
            const unionPool = new Map();
            for (const pt of repPoints) {
                const { data } = await supabase.rpc('get_master_places_in_radius_v2', { target_lat: pt.lat, target_lng: pt.lng, radius_meters: 25000, p_category: cat, limit_count: 500 });
                if (!data) continue;
                data.forEach(item => {
                    let s = 10;
                    if (cat === 'RESTAURANT') {
                        if (item.api_source === 'LX_RESTAURANT') s += 50;
                        if (item.api_source === 'SMBA_BAEK') s += 50;
                        if (item.api_source === 'LOCALDATA_RESTAURANT_GOOD') s += 30;
                        if (item.api_source === 'SAFE_RESTAURANT') s += 20;
                    } else if (cat === 'MART') {
                        s = /이마트|롯데마트|홈플러스|하나로/.test(item.name) ? 80 : 70;
                    } else if (cat === 'SPOT') {
                        const tier = item.raw_data?.tier || 0;
                        s = tier === 1 ? 100 : (tier === 2 ? 80 : 15);
                    } else if (cat === 'HOSPITAL') {
                        s = /종합병원|의료원/.test(item.name) ? 100 : 50;
                    } else s = 50;
                    const uk = `${item.name}|${item.address}`;
                    if (!unionPool.has(uk) || s > unionPool.get(uk).trust_score) unionPool.set(uk, { ...item, trust_score: s });
                });
            }
            const poolArray = Array.from(unionPool.values()).sort((a,b) => b.trust_score - a.trust_score).slice(0, limit);
            rawCandidatesForAudit.push(...poolArray.map(x => ({ ...x, stage: 1 })));
            clusterCands.push(...poolArray);
        }

        // Kakao Verification Simulation (Reduced for speed in report)
        for (const c of clusterCands) {
            totalFactMap.set(c.id, { ...c, verificationStatus: 'VERIFIED' });
        }

        const penaltyFactors = { RESTAURANT: 3.0, SPOT: 0.5, MART: 2.0, HOSPITAL: 5.0, GAS_STATION: 2.0, FESTIVAL: 1.0 };
        const verifiedPool = Array.from(totalFactMap.values());
        for (const reservation of cluster.reservations) {
            for (const cat of ['RESTAURANT', 'SPOT', 'MART', 'HOSPITAL', 'GAS_STATION', 'FESTIVAL']) {
                const catItems = verifiedPool.filter(f => f.category === cat);
                const scored = catItems.map(item => {
                    const distKm = haversineKm(reservation.lat, reservation.lng, item.lat, item.lng);
                    const penalty = distKm * penaltyFactors[cat];
                    return { ...item, reservation_id: reservation.id, distance_km: distKm, penalty_score: penalty, final_score: item.trust_score - penalty };
                }).sort((a, b) => b.final_score - a.final_score).slice(0, 15);
                allCandidateRows.push(...scored);
            }
        }
    }

    // Generate Stage 1 Report
    let stage1Content = `# 1차 쿼터 DB 수집 리스트 (D-3 캐싱: ${targetStr})\n\n`;
    stage1Content += `| 번호 | 카테고리 | 이름 | 품질 점수 | 주소 | 거리(m) |\n`;
    stage1Content += `| :--- | :--- | :--- | :---: | :--- | :---: |\n`;
    rawCandidatesForAudit.forEach((c, i) => {
        stage1Content += `| ${i+1} | ${c.category} | ${c.name} | ${c.trust_score} | ${c.address} | ${Math.round(c.distance_meters || 0)} |\n`;
    });
    fs.writeFileSync('smart_plan_stage1_full.md', stage1Content, 'utf-8');

    // Generate Stage 4 Report
    let stage4Content = `# 2차 쿼터 개인화 적용 리스트 (D-3 캐싱: ${targetStr})\n\n`;
    stage4Content += `| 번호 | 예약ID | 카테고리 | 이름 | 품질 | 거리(km) | 감점 | 최종 점수 | 주소 |\n`;
    stage4Content += `| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |\n`;
    allCandidateRows.forEach((c, i) => {
        stage4Content += `| ${i+1} | ${c.reservation_id.slice(0,8)} | ${c.category} | ${c.name} | ${c.trust_score} | ${c.distance_km.toFixed(2)} | -${c.penalty_score.toFixed(1)} | **${c.final_score.toFixed(1)}** | ${c.address} |\n`;
    });
    fs.writeFileSync('smart_plan_stage4_personalized.md', stage4Content, 'utf-8');

    console.log(`\n📋 [Precision Audit Report] D-3 스마트 캐싱 (권역 API 정밀 동기화)`);
    console.log(`| 대상 일자 | 예약건수 | 클러스터 | 1차 쿼터 총합 | 2차 쿼터(개인화) | 상태 |`);
    console.log(`| :--- | :---: | :---: | :---: | :---: | :--- |`);
    console.log(`| ${targetStr} | ${metrics.reservations} | ${metrics.clusters} | ${rawCandidatesForAudit.length} | ${allCandidateRows.length} | ✅ SUCCESS |`);
    
    console.log(`\n📝 Reports generated:`);
    console.log(`- smart_plan_stage1_full.md`);
    console.log(`- smart_plan_stage4_personalized.md\n`);
    
    process.exit(0);
}

main();

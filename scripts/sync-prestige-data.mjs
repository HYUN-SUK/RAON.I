#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { v5 as uuidv5 } from 'uuid';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

if (!SUPABASE_URL || !SUPABASE_KEY || !KAKAO_KEY) {
    console.error('Missing required env vars (SUPABASE, KAKAO_KEY)');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// SOP v11.3 Standardization
function getNormalizedAddr(addr) {
    if (!addr) return '';
    let normalized = addr.trim();
    const hashSidoMap = {
        '서울': '서울특별시', '부산': '부산광역시', '대구': '대구광역시', '인천': '인천광역시',
        '광주': '광주광역시', '대전': '대전광역시', '울산': '울산광역시', '세종': '세종특별자치시',
        '경기': '경기도', '강원': '강원특별자치도', '충북': '충청북도', '충남': '충청남도',
        '전북': '전북특별자치도', '전남': '전라남도', '경북': '경상북도', '경남': '경상남도', '제주': '제주특별자치도'
    };
    for (const [short, full] of Object.entries(hashSidoMap)) {
        if (normalized.startsWith(short) && !normalized.startsWith(full)) {
            normalized = normalized.replace(short, full);
            break;
        }
    }
    return normalized;
}

function getCleanString(str) {
    if (!str) return '';
    return String(str).replace(/\(.+?\)/g, '').replace(/\s+/g, '').toLowerCase();
}

/**
 * Kakao Keyword Search to get Info
 */
async function searchKakao(name, sigungu) {
    const query = `${sigungu} ${name}`;
    try {
        const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`, {
            headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
        });
        const data = await res.json();
        if (data.documents && data.documents.length > 0) {
            const doc = data.documents[0];
            return {
                name: doc.place_name,
                address: doc.road_address_name || doc.address_name,
                lat: parseFloat(doc.y),
                lng: parseFloat(doc.x),
                kakao_id: doc.id,
                category_name: doc.category_name
            };
        }
        return null;
    } catch (e) {
        console.error(`  [KAKAO_ERR] ${query}:`, e.message);
        return null;
    }
}

/**
 * [v2.0 Optimized] Prestige Data Synchronization
 * - Parallel processing (concurrency 10)
 * - Bulk upserts (chunk size 100)
 * - Deterministic UUIDs for prestige_landmarks
 */
async function syncPrestige() {
    console.log('--- Stage 2: [High-Velocity] Prestige Data Synchronization ---');

    const tier1File = 'korea_tourism_100_official.md';
    const tier2File = 'regional_8_sceneries_FULL.md';
    const prestigeList = [];

    // 1. Parsing (Reuse existing logic)
    console.log('[1/2] Parsing Tier 1...');
    const t1Content = fs.readFileSync(tier1File, 'utf8');
    let currentSido = '', currentSigungu = '';
    t1Content.split('\n').forEach(line => {
        const sidoMatch = line.match(/^## \d+\. (.+?) /);
        if (sidoMatch) currentSido = sidoMatch[1];
        const sigunguMatch = line.match(/^### (.+?) \(/);
        if (sigunguMatch) currentSigungu = sigunguMatch[1];
        if (line.startsWith('- ')) {
            let namePart = line.replace('- ', '').trim();
            if (namePart.includes('5대 고궁')) {
                ['경복궁', '창덕궁', '창경궁', '덕수궁', '경희궁'].forEach(p => 
                    prestigeList.push({ name: p, tier: 1, sido: currentSido, sigungu: currentSigungu, source: 'TOURISM_100' }));
            } else {
                const cleanName = namePart.split('(')[0].trim();
                prestigeList.push({ name: cleanName, tier: 1, sido: currentSido, sigungu: currentSigungu, source: 'TOURISM_100' });
            }
        }
    });

    console.log('[2/2] Parsing Tier 2...');
    const t2Content = fs.readFileSync(tier2File, 'utf8');
    currentSido = '';
    t2Content.split('\n').forEach(line => {
        const sidoMatch = line.match(/^## \d+\. (.+?) /);
        if (sidoMatch) currentSido = sidoMatch[1];
        const sigunguMatch = line.match(/^### (.+?)( \(|$)/);
        if (sigunguMatch) currentSigungu = sigunguMatch[1].trim();
        if (line.startsWith('- ')) {
            const names = line.replace('- ', '').split(',').map(n => n.trim()).filter(n => n);
            names.forEach(n => prestigeList.push({ name: n, tier: 2, sido: currentSido, sigungu: currentSigungu, source: 'REGIONAL_SCENERY' }));
        }
    });

    console.log(`🚀 Total Parsed: ${prestigeList.length}. Starting High-Velocity Sync...`);

    // 2. Parallel Processing with Chunking
    const CONCURRENCY = 10;
    const CHUNK_SIZE = 100;
    const masterEntries = [];
    const prestigeEntries = [];

    for (let i = 0; i < prestigeList.length; i += CONCURRENCY) {
        const chunk = prestigeList.slice(i, i + CONCURRENCY);
        process.stdout.write(`\r- Processing items ${i + 1} to ${Math.min(i + CONCURRENCY, prestigeList.length)}...`);

        const results = await Promise.all(chunk.map(async (item) => {
            try {
                const kakaoInfo = await searchKakao(item.name, item.sigungu);
                if (!kakaoInfo) return null;

                const normAddr = getNormalizedAddr(kakaoInfo.address);
                const masterId = uuidv5(`PRESTIGE|${getCleanString(kakaoInfo.name)}|${getCleanString(normAddr)}`, MY_NAMESPACE);
                const prestigeId = uuidv5(`PL|${item.tier}|${item.sigungu}|${item.name}`, MY_NAMESPACE);

                return {
                    master: {
                        id: masterId,
                        api_source: item.source,
                        category: 'SPOT',
                        name: kakaoInfo.name,
                        description: `${item.source === 'TOURISM_100' ? '한국관광 100선 공식 선정' : '지역 8경/10경 선정 명소'}`,
                        address: normAddr,
                        lat: kakaoInfo.lat,
                        lng: kakaoInfo.lng,
                        trust_score: item.tier === 1 ? 100 : 80,
                        is_protected: true,
                        is_active: true,
                        raw_data: { kakao_info: kakaoInfo, tier: item.tier }
                    },
                    prestige: {
                        id: prestigeId,
                        master_id: masterId,
                        tier: item.tier,
                        source: item.source,
                        sido: item.sido,
                        sigungu: item.sigungu,
                        name: kakaoInfo.name,
                        address: normAddr,
                        lat: kakaoInfo.lat,
                        lng: kakaoInfo.lng,
                        metadata: { kakao_info: kakaoInfo, original_name: item.name }
                    }
                };
            } catch (e) {
                return null;
            }
        }));

        results.filter(r => r).forEach(r => {
            masterEntries.push(r.master);
            prestigeEntries.push(r.prestige);
        });

        // Bulk Upsert every CHUNK_SIZE
        if (masterEntries.length >= CHUNK_SIZE || i + CONCURRENCY >= prestigeList.length) {
            if (masterEntries.length > 0) {
                await supabase.from('master_places').upsert(masterEntries, { onConflict: 'id' });
                await supabase.from('prestige_landmarks').upsert(prestigeEntries, { onConflict: 'id' });
                masterEntries.length = 0;
                prestigeEntries.length = 0;
            }
        }
    }

    console.log('\n✅ High-Velocity Prestige Sync Completed.');
}

syncPrestige().catch(console.error);

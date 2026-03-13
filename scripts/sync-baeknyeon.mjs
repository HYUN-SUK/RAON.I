#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_KEY = process.env.PUBLIC_DATA_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !PUBLIC_KEY) {
    console.error('Missing required env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 1) 최신 uddi path 자동 탐색 (사용자 가이드 Plan A)
async function getLatestOdcloudPath(namespace = "15102255/v1") {
    const specUrl = `https://infuser.odcloud.kr/oas/docs?namespace=${encodeURIComponent(namespace)}`;
    const res = await fetch(specUrl);
    const spec = await res.json();
    const paths = Object.keys(spec.paths || {});
    if (!paths.length) throw new Error("ODcloud swagger paths empty");
    return paths[0]; // "/15102255/v1/uddi:...."
}

async function geocodeAddress(address) {
    if (!KAKAO_KEY || !address) return null;
    try {
        const res = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, {
            headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
        });
        const data = await res.json();
        if (data.documents?.length > 0) {
            return { lat: parseFloat(data.documents[0].y), lng: parseFloat(data.documents[0].x) };
        }
        return null;
    } catch { return null; }
}

async function syncBaeknyeon() {
    console.log('🚀 [START] Baeknyeon Recovery (UDDI Auto-Discovery)');
    try {
        const path = await getLatestOdcloudPath("15102255/v1");
        console.log(`  [INFO] Latest UDDI Path: ${path}`);

        let page = 1, totalStored = 0;
        const perPage = 100;

        while (page <= 50) { // Max 5000 items
            const url = `https://api.odcloud.kr/api${path}?page=${page}&perPage=${perPage}&serviceKey=${PUBLIC_KEY}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`ODcloud failed ${res.status}`);
            
            const data = await res.json();
            const items = data.data || [];
            if (items.length === 0) break;

            console.log(`  Page ${page}: Processing ${items.length} items...`);
            
            const processed = [];
            let geocodeFail = 0;
            for (const i of items) {
                const name = i['업체명'] || '';
                const addr = i['기본주소'] || '';
                if (!name || !addr) continue;

                const coords = await geocodeAddress(addr);
                if (!coords) {
                    geocodeFail++;
                    continue;
                }

                processed.push({
                    api_source: 'SBA_BAEKNYEON',
                    category: 'RESTAURANT',
                    name,
                    description: `백년가게 공식 지정 (${i['업종'] || '식당'})`,
                    address: addr,
                    lat: coords.lat,
                    lng: coords.lng,
                    trust_score: 80,
                    raw_data: i
                    // location 컬럼은 DB 트리거에서 자동 생성되도록 유도 (null 명시 전송 방지)
                });
            }

            console.log(`    [GEO] Success: ${processed.length}, Fail: ${geocodeFail}`);

            if (processed.length > 0) {
                const { data, error } = await supabase.from('master_places').upsert(processed, { onConflict: 'name, address' });
                if (error) {
                    console.error('    [DB] Upsert error total:', JSON.stringify(error));
                    console.error(`    [DB] Error message: ${error.message}`);
                } else {
                    totalStored += processed.length;
                    console.log(`    [DB] Stored ${processed.length} items successfully.`);
                }
            }

            page++;
            if (items.length < perPage) break;
            await new Promise(r => setTimeout(r, 200)); // Rate limiting
        }
        console.log(`\n🏁 [FINISH] Baeknyeon Recovery: ${totalStored} items stored.`);
    } catch (e) {
        console.error('  [FATAL] Baeknyeon Error:', e.message);
    }
}

syncBaeknyeon();

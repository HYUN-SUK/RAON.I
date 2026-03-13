#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPINET_KEY = process.env.OPINET_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPINET_KEY) {
    console.error('Missing required env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const geocodeCache = new Map();

async function geocodeAddress(address) {
    if (!KAKAO_KEY || !address) return null;
    if (geocodeCache.has(address)) return geocodeCache.get(address);
    try {
        const res = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, {
            headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
        });
        const data = await res.json();
        if (data.documents?.length > 0) {
            const coords = { lat: parseFloat(data.documents[0].y), lng: parseFloat(data.documents[0].x) };
            geocodeCache.set(address, coords); return coords;
        }
        return null;
    } catch { return null; }
}

async function getAreaCodes(area = '') {
    const url = `http://www.opinet.co.kr/api/areaCode.do?out=json&code=${OPINET_KEY}&area=${area}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return data.RESULT?.OIL || [];
    } catch (e) {
        console.error(`  [ERR] Failed to fetch area codes for ${area}: ${e.message}`);
        return [];
    }
}

async function syncOpinetNational() {
    console.log('🚀 [START] Opinet National Recovery (ETL 4.1 - Admin Center Based)');
    try {
        const sidos = await getAreaCodes();
        console.log(`  [INFO] Found ${sidos.length} SIDO codes.`);

        let totalStored = 0;

        for (const sido of sidos) {
            console.log(`\n  Processing SIDO: ${sido.AREA_NM}`);
            const sigungus = await getAreaCodes(sido.AREA_CD);
            
            for (const sigungu of sigungus) {
                const targetName = `${sido.AREA_NM} ${sigungu.AREA_NM}청`; 
                console.log(`    Scraping: ${targetName}...`);
                
                try {
                    // 1. Geocode to WGS84
                    const addrRes = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(targetName)}`, {
                        headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
                    });
                    const addrData = await addrRes.json();
                    if (!addrData.documents?.[0]) {
                        console.log(`      [!] Center not found: ${targetName}`);
                        continue;
                    }
                    const lon = addrData.documents[0].x;
                    const lat = addrData.documents[0].y;

                    // 2. WGS84 -> WTM (EPSG:5181)
                    const transUrl = `https://dapi.kakao.com/v2/local/geo/transcoord.json?x=${lon}&y=${lat}&input_coord=WGS84&output_coord=WTM`;
                    const transRes = await fetch(transUrl, {
                        headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
                    });
                    const transData = await transRes.json();
                    if (!transData.documents?.[0]) continue;

                    const x = Math.round(transData.documents[0].x);
                    const y = Math.round(transData.documents[0].y);

                    // 3. Opinet aroundAll.do
                    const url = `http://www.opinet.co.kr/api/aroundAll.do?out=json&code=${OPINET_KEY}&x=${x}&y=${y}&radius=10000&prodcd=C004`;
                    const opRes = await fetch(url);
                    const opData = await opRes.json();
                    const items = opData.RESULT?.OIL || [];
                    
                    if (items.length > 0) {
                        const processed = items.map(i => ({
                            api_source: 'OPINET',
                            category: 'GAS_STATION',
                            name: i.OS_NM,
                            address: i.VAN_ADR || i.NEW_ADR,
                            lat: parseFloat(lat),
                            lng: parseFloat(lon),
                            trust_score: 95,
                            raw_data: i
                        }));

                        const { error } = await supabase.from('master_places_gas').upsert(processed, { onConflict: 'name, address' });
                        if (error) console.error(`      [DB] Error: ${error.message}`);
                        else {
                            totalStored += processed.length;
                            console.log(`      [DB] Stored ${processed.length} stations.`);
                        }
                    }
                } catch (innerE) {
                    console.error(`      [ERR] ${sigungu.AREA_NM}: ${innerE.message}`);
                }
                await new Promise(r => setTimeout(r, 200)); 
            }
        }
        console.log(`\n🏁 [FINISH] Opinet National Recovery: ${totalStored} items stored.`);
    } catch (e) {
        console.error('  [FATAL] Opinet Error:', e.message);
    }
}

syncOpinetNational();

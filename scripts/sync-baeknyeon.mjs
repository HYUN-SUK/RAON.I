#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import crypto from 'crypto';

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
            let filterSkip = 0;

            const NON_FOOD_SECTORS = [
                '미용', '이발', '이용', '가발', '피부관리', '헤어',
                '안경', '렌즈', '콘택트',
                '서적', '서점', '문구', '문방사우', '완구', '학원', '교육', '체육', '도서',
                '한복', '양복', '정장', '의류', '의복', '구두', '신발', '주단', '이불', '수예',
                '사진', '스튜디오', '카메라', '인화', '앨범',
                '농약', '종묘', '씨앗', '비료', '원예', '분재', '화원', '생화', '꽃집', '화훼',
                '철물', '건재', '공구', '인테리어', '도배', '장판', '목재', '목공', '유리', '방수',
                '시계', '귀금속', '보석', '주얼리',
                '정비', '카센터', '세차', '타이어', '배터리', '오토바이', '자전거', '부품',
                '가전', '컴퓨터', '가구', '세탁', '의료기', '보청기', '인쇄', '도장', '열쇠'
            ];

            const nameBlacklist = /정비|카센터|공업사|세차|타이어|배터리|공인중개사|부동산|장례|상조|종교|교회|사찰|학원|관리소|사무소|지물포|건재|상사|유통|공구|이발|미용|세탁|철물|사진관|인쇄소|스튜디오|모텔|여관|호텔|약국|의원|병원|디지털|농약|종묘|방앗간|기름집|안경|양복|연구소|화원|서점|서적|스튜디오|스튜디오/;

            for (const i of items) {
                const name = i['업체명'] || i['업체 명'] || '';
                const addr = i['기본주소'] || i['기본 주소'] || '';
                if (!name || !addr) continue;

                // 주요사업 추출
                let sector = '알수없음';
                for (const key of Object.keys(i)) {
                    if (key.trim() === '주요사업' || key.trim() === '주요 사업') {
                        sector = i[key] || '알수없음';
                        break;
                    }
                }

                // 식당 여부 검증 (업종 및 상호명 기준)
                const isNonFoodSector = NON_FOOD_SECTORS.some(kw => sector.includes(kw));
                const isNonFoodName = nameBlacklist.test(name);

                if (isNonFoodSector || isNonFoodName) {
                    filterSkip++;
                    continue;
                }

                const coords = await geocodeAddress(addr);
                if (!coords) {
                    geocodeFail++;
                    continue;
                }

                // name+address 조합으로 고정된 UUID 생성
                const rawKey = `${name}_${addr}`;
                const hash = crypto.createHash('md5').update(rawKey).digest('hex');
                const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;

                processed.push({
                    id: uuid,
                    api_source: 'SMBA_BAEK',
                    category: 'RESTAURANT',
                    name,
                    description: `백년가게 공식 지정 (${sector})`,
                    address: addr,
                    lat: coords.lat,
                    lng: coords.lng,
                    trust_score: 80,
                    raw_data: i
                });
            }

            console.log(`    [GEO] Success: ${processed.length}, Skip(Non-Food): ${filterSkip}, Fail(Geo): ${geocodeFail}`);

            if (processed.length > 0) {
                const { data, error } = await supabase.from('master_places').upsert(processed, { onConflict: 'id' });
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

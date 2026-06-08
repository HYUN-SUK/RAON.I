import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const PUBLIC_KEY = process.env.PUBLIC_DATA_API_KEY;

if (!PUBLIC_KEY) {
    console.error('Missing PUBLIC_DATA_API_KEY');
    process.exit(1);
}

async function getLatestOdcloudPath(namespace = "15102255/v1") {
    const specUrl = `https://infuser.odcloud.kr/oas/docs?namespace=${encodeURIComponent(namespace)}`;
    const res = await fetch(specUrl);
    const spec = await res.json();
    const paths = Object.keys(spec.paths || {});
    if (!paths.length) throw new Error("ODcloud swagger paths empty");
    return paths[0];
}

async function inspect() {
    console.log('🚀 [START] Inspecting Baeknyeon Public Data API (주요사업 Analysis)');
    try {
        const path = await getLatestOdcloudPath("15102255/v1");
        console.log(`  [INFO] Latest UDDI Path: ${path}`);

        let page = 1;
        const perPage = 100;
        const sectors = {};
        const nonFoodStores = [];

        while (page <= 50) {
            const url = `https://api.odcloud.kr/api${path}?page=${page}&perPage=${perPage}&serviceKey=${PUBLIC_KEY}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`ODcloud failed ${res.status}`);
            
            const data = await res.json();
            const items = data.data || [];
            if (items.length === 0) break;

            console.log(`  Page ${page}: Fetched ${items.length} items...`);
            
            for (const i of items) {
                const name = i['업체명'] || '';
                const addr = i['기본주소'] || '';
                const sector = i['주요사업'] || '알수없음';
                if (!name) continue;

                sectors[sector] = (sectors[sector] || 0) + 1;

                const isFood = sector.includes('음식') || 
                               sector.includes('한식') || 
                               sector.includes('중식') || 
                               sector.includes('일식') || 
                               sector.includes('경양식') || 
                               sector.includes('식당') || 
                               sector.includes('제과') || 
                               sector.includes('카페') || 
                               sector.includes('다방') || 
                               sector.includes('분식') || 
                               sector.includes('빵') || 
                               sector.includes('갈비') || 
                               sector.includes('육류') ||
                               sector.includes('회') ||
                               sector.includes('순대') ||
                               sector.includes('탕') ||
                               sector.includes('냉면') ||
                               sector.includes('오리') ||
                               sector.includes('곰탕') ||
                               sector.includes('국밥') ||
                               sector.includes('보리밥') ||
                               sector.includes('해물') ||
                               sector.includes('닭') ||
                               sector.includes('음료') ||
                               sector.includes('요리') ||
                               sector.includes('주점') ||
                               sector.includes('막국수') ||
                               sector.includes('국수') ||
                               sector.includes('제과제빵') ||
                               sector.includes('식사') ||
                               sector.includes('한정식') ||
                               sector.includes('복어');

                if (!isFood) {
                    nonFoodStores.push({ name, address: addr, sector });
                }
            }

            page++;
            if (items.length < perPage) break;
        }

        const resultData = {
            sectors,
            nonFoodStoresCount: nonFoodStores.length,
            nonFoodStores
        };
        fs.writeFileSync('baeknyeon_sectors_result.json', JSON.stringify(resultData, null, 2), 'utf-8');
        console.log('\n🏁 [SUCCESS] Saved results to baeknyeon_sectors_result.json');
    } catch (e) {
        console.error('Error:', e.message);
    }
}

inspect();

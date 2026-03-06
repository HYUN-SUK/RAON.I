const fs = require('fs');

try {
    const envFile = fs.readFileSync('.env.local', 'utf8');
    envFile.split(/\r?\n/).forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let val = match[2].trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
            process.env[key] = val;
        }
    });
} catch (e) {
    console.warn("Could not load .env.local");
}

const kakaoKey = process.env.KAKAO_REST_API_KEY;
const kmaKey = process.env.KMA_SERVICE_KEY || process.env.PUBLIC_DATA_API_KEY;

const report = {};

async function checkRealtimeAPIs() {
    console.log("Checking Real-time APIs...");

    const tests = [
        {
            key: "KAKAO_LOCAL",
            url: `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent('예산 식당')}&x=126.8429&y=36.6719&radius=10000`,
            headers: { 'Authorization': `KakaoAK ${kakaoKey}` }
        },
        {
            key: "KAKAO_NAVI (Directions)",
            url: `https://apis-navi.kakaomobility.com/v1/directions?origin=127.11015314141542,37.39472714688412&destination=126.8429,36.6719&priority=RECOMMEND`,
            headers: { 'Authorization': `KakaoAK ${kakaoKey}` }
        },
        {
            key: "WEATHER (KMA Short-term)",
            url: `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${kmaKey}&pageNo=1&numOfRows=10&dataType=JSON&base_date=20260306&base_time=0500&nx=56&ny=106`,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }
    ];

    for (const api of tests) {
        if (!api.url || api.url.includes("undefined") || api.url.includes("null")) {
            console.log(`❌ ${api.key}: Missing API Key`);
            continue;
        }
        try {
            const start = Date.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const res = await fetch(api.url, { headers: api.headers, signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                console.log(`✅ ${api.key} - OK (${Date.now() - start}ms)`);
            } else {
                console.log(`❌ ${api.key} - HTTP ${res.status}`);
            }
        } catch (e) {
            console.log(`❌ ${api.key} - ERROR: ${e.message}`);
        }
    }
}

checkRealtimeAPIs();

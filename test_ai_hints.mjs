import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PUBLIC_KEY = process.env.PUBLIC_DATA_API_KEY || '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

async function testODcloud() {
    console.log("\n--- 1. ODcloud (Swagger Dynamic Path) ---");
    try {
        const specUrl = `https://infuser.odcloud.kr/oas/docs?namespace=15102255/v1`;
        const specRes = await fetch(specUrl);
        const spec = await specRes.json();
        const paths = Object.keys(spec.paths || {});
        if (!paths.length) throw new Error("Paths empty");
        const latestPath = paths[0];
        console.log(`[INFO] Found latest ODcloud path: ${latestPath}`);

        // Use query serviceKey as suggested
        const url = `https://api.odcloud.kr/api${latestPath}?page=1&perPage=2&serviceKey=${PUBLIC_KEY}`;
        const res = await fetch(url, { headers: { "Accept": "application/json" } });
        const text = await res.text();
        console.log(`[${res.status}] ${text.substring(0, 150).replace(/\n/g, '')}...`);
    } catch (e) {
        console.log(`[ERR] ODcloud failed: ${e.message}`);
    }
}

async function testStandardData() {
    console.log("\n--- 2. Standard Data (Festival) with Browser Headers ---");
    const commonHeaders = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json,text/plain,*/*",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        "Referer": "https://www.data.go.kr/",
        "Connection": "keep-alive",
    };

    // Test 1: Direct http as per doc
    const url1 = `http://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api?serviceKey=${PUBLIC_KEY}&pageNo=1&numOfRows=2&type=json`;
    // Test 2: apis.data.go.kr https
    const url2 = `https://apis.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api?serviceKey=${PUBLIC_KEY}&pageNo=1&numOfRows=2&type=json`;

    try {
        let res = await fetch(url1, { headers: commonHeaders });
        let text = await res.text();
        console.log(`[HTTP ${res.status}] -> ${text.substring(0, 80).replace(/\n/g, '')}...`);

        res = await fetch(url2, { headers: commonHeaders });
        text = await res.text();
        console.log(`[HTTPS apis ${res.status}] -> ${text.substring(0, 80).replace(/\n/g, '')}...`);
    } catch (e) {
        console.log(`[ERR] Standard Data failed: ${e.message}`);
    }
}

async function testTourAPI() {
    console.log("\n--- 3. TourAPI (KorService2 Migration) ---");
    // Test locationBasedList2
    const urlLoc = `http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${PUBLIC_KEY}&numOfRows=2&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&mapX=126.8429&mapY=36.6719&radius=20000`;
    // Test areaBasedList2
    const urlArea = `http://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${PUBLIC_KEY}&numOfRows=2&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&areaCode=34&sigunguCode=14`;

    try {
        let res = await fetch(urlLoc, { headers: { "Accept": "application/json" } });
        let text = await res.text();
        console.log(`[locationBasedList2 ${res.status}] -> ${text.substring(0, 150).replace(/\n/g, '')}...`);

        res = await fetch(urlArea, { headers: { "Accept": "application/json" } });
        text = await res.text();
        console.log(`[areaBasedList2 ${res.status}] -> ${text.substring(0, 150).replace(/\n/g, '')}...`);
    } catch (e) {
        console.log(`[ERR] TourAPI failed: ${e.message}`);
    }
}

async function runAll() {
    await testODcloud();
    await testStandardData();
    await testTourAPI();
}
runAll();

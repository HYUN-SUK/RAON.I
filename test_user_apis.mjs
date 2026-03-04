const KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

async function testApi(name, url) {
    console.log(`\n[TESTING] ${name}`);
    console.log(`[URL] ${url}`);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        console.log(`[STATUS] ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log(`[BODY]\n${text.substring(0, 300)}`);
    } catch (e) {
        console.error(`[FETCH ERROR] ${e.message}`);
    }
}

async function run() {
    // 1. 대규모점포
    await testApi('대규모점포 (행안부)', `https://apis.data.go.kr/1741000/large_scale_retail_stores/getStoreList?serviceKey=${KEY}&pageNo=1&numOfRows=10&type=json`);

    // 1-1. Just the base URL they gave + json
    await testApi('대규모점포 (Base)', `https://apis.data.go.kr/1741000/large_scale_retail_stores?serviceKey=${KEY}&pageNo=1&numOfRows=10&type=json`);

    // 2. 모범음식점
    await testApi('모범음식점 (행안부)', `https://apis.data.go.kr/1741000/excellent_restaurant_info?serviceKey=${KEY}&pageNo=1&numOfRows=10&type=json`);

    // 3. 백년가게 Swagger get
    await testApi('백년가게 (Swagger)', `https://infuser.odcloud.kr/oas/docs?namespace=15102255/v1`);

    // 4. 전국문화축제
    await testApi('전국문화축제', `https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api?serviceKey=${KEY}&pageNo=1&numOfRows=10&type=json`);
}

run();

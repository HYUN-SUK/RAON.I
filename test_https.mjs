const KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

async function testApi(name, url) {
    console.log(`\n===========================================`);
    console.log(`[TESTING] ${name}`);
    console.log(`[URL] ${url}`);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        console.log(`[STATUS] ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log(`[BODY]\n${text.substring(0, 500)}`);
    } catch (e) {
        console.error(`[FETCH ERROR] ${e.message}`);
    }
}

async function run() {
    // 1. HTTPS test for Standard APIs (WAF Bypass)
    await testApi('HTTPS 모범음식점', `https://api.data.go.kr/openapi/tn_pubr_public_gd_rest_api?serviceKey=${KEY}&pageNo=1&numOfRows=10&type=json`);

    // 2. Decode TourAPI key ? Wait, key is hex so %3D etc doesn't matter, but let's test TourAPI with 10 digit Beopjeong-dong code
    await testApi('TourAPI 10-digit RegionCode', `https://apis.data.go.kr/B551011/KorService1/searchFestival1?serviceKey=${KEY}&numOfRows=10&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&eventStartDate=20240101&lDongRegnCd=4400000000&lDongSignguCd=4481000000`);

    // 3. TourAPI without region code to see if it even works
    await testApi('TourAPI No RegionCode', `https://apis.data.go.kr/B551011/KorService1/searchFestival1?serviceKey=${KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&eventStartDate=20240101`);
}

run();

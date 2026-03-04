const KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

async function testApiWithHeaders(url) {
    console.log(`[TESTING] ${url}`);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Connection': 'keep-alive'
            }
        });
        console.log(`[STATUS] ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log(`[BODY]\n${text.substring(0, 500)}`);
    } catch (e) {
        console.error(`[FETCH ERROR] ${e.message}`);
    }
}

async function run() {
    const urls = [
        `http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong?serviceKey=${KEY}&pageNo=1&numOfRows=10&divId=signguCd&key=44810&type=json`,
        `http://api.data.go.kr/openapi/tn_pubr_public_lrg_store_api?serviceKey=${KEY}&pageNo=1&numOfRows=10&type=json`,
        `http://api.data.go.kr/openapi/tn_pubr_public_gd_rest_api?serviceKey=${KEY}&pageNo=1&numOfRows=10&type=json`,
        `http://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api?serviceKey=${KEY}&pageNo=1&numOfRows=10&type=json`,
        `http://apis.data.go.kr/B551011/KorService1/searchFestival1?serviceKey=${KEY}&numOfRows=10&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&eventStartDate=20240101&lDongRegnCd=44&lDongSignguCd=44810`
    ];
    for (const url of urls) {
        await testApiWithHeaders(url);
    }
}

run();

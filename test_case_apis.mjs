const KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

async function testApi(url) {
    console.log(`\n[URL] ${url}`);
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
    // 1. 대규모 - ServiceKey (자본 S) + http
    await testApi(`http://apis.data.go.kr/1741000/large_scale_retail_stores?ServiceKey=${KEY}&pageNo=1&numOfRows=10&type=json`);

    // 2. 모범 - ServiceKey (자본 S) + http
    await testApi(`http://apis.data.go.kr/1741000/excellent_restaurant_info?ServiceKey=${KEY}&pageNo=1&numOfRows=10&type=json`);

    // 3. 백년가게 Swagger fetch
    try {
        const res = await fetch(`https://infuser.odcloud.kr/oas/docs?namespace=15102255/v1`);
        const data = await res.json();
        console.log("\n[SWAGGER PATHS]");
        console.log(Object.keys(data.paths));
    } catch (e) {
        console.error(e);
    }
}

run();

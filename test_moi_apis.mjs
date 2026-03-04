const KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

async function testApi(url) {
    console.log(`[URL] ${url}`);
    try {
        const res = await fetch(url);
        console.log(`[STATUS] ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log(`[BODY]\n${text.substring(0, 300)}`);
    } catch (e) {
        console.error(`[FETCH ERROR] ${e.message}`);
    }
}

async function run() {
    await testApi(`http://apis.data.go.kr/1741000/excellent_restaurant_info?serviceKey=${KEY}&pageNo=1&numOfRows=10&type=json`);
    await testApi(`http://apis.data.go.kr/1741000/large_scale_retail_stores_info?serviceKey=${KEY}&pageNo=1&numOfRows=10&type=json`);
}

run();

const KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

async function testApi(name, url) {
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log(`\n[${name}] DATA STRUCTURE:`);
        if (data?.response?.body?.items) {
            const items = Array.isArray(data.response.body.items) ? data.response.body.items : [data.response.body.items];
            if (items.length > 0) {
                console.log(items[0]);
            } else {
                console.log("Empty items array");
            }
        } else {
            console.log(JSON.stringify(data).substring(0, 300));
        }
    } catch (e) {
        console.error(`[FETCH ERROR] ${e.message}`);
    }
}

async function run() {
    await testApi('모범음식점', `http://apis.data.go.kr/1741000/excellent_restaurant_info/info?serviceKey=${KEY}&pageNo=1&numOfRows=1&returnType=json`);
    await testApi('대규모점포', `http://apis.data.go.kr/1741000/large_scale_retail_stores/info?serviceKey=${KEY}&pageNo=1&numOfRows=1&returnType=json`);
}

run();

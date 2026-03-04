const KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

async function run() {
    const urls = [
        `http://apis.data.go.kr/1741000/large_scale_retail_stores?serviceKey=${KEY}&pageNo=1&numOfRows=10&Type=json`, // uppercase Type
        `http://apis.data.go.kr/1741000/large_scale_retail_stores?serviceKey=${KEY}&page=1&perPage=10&type=json`, // odcloud style
        `http://apis.data.go.kr/1741000/large_scale_retail_stores?serviceKey=${KEY}&pageNo=1&numOfRows=10&type=JSON`, // uppercase JSON
        `http://apis.data.go.kr/1741000/large_scale_retail_stores?serviceKey=${KEY}` // No params
    ];

    for (const url of urls) {
        console.log(`\n[URL] ${url}`);
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            console.log(`[STATUS] ${res.status}`);
            const text = await res.text();
            console.log(`[BODY]\n${text.substring(0, 50)}`);
        } catch (e) { console.error(e); }
    }
}

run();

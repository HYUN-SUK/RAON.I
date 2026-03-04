const KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

async function run() {
    try {
        const swRes = await fetch(`https://infuser.odcloud.kr/oas/docs?namespace=15102255/v1`);
        const swData = await res.json();
        const paths = Object.keys(swData.paths);
        const endpoint = paths[0];

        console.log(`[TESTING 100-YEAR STORE]`);
        const url = `https://api.odcloud.kr/api${endpoint}?serviceKey=${KEY}&page=1&perPage=10`;
        console.log(url);

        const res = await fetch(url, { headers: { 'Authorization': `Infuser ${KEY}` } }); // Sometimes odcloud needs auth header
        const text = await res.text();
        console.log(`[STATUS] ${res.status}`);
        console.log(`[BODY]\n${text.substring(0, 300)}`);
    } catch (e) { console.error(e); }

    try {
        console.log(`\n[TESTING 행안부 XML]`);
        const url = `http://apis.data.go.kr/1741000/large_scale_retail_stores?serviceKey=${KEY}&pageNo=1&numOfRows=10`; // no type=json
        console.log(url);
        const res = await fetch(url);
        const text = await res.text();
        console.log(`[STATUS] ${res.status}`);
        console.log(`[BODY]\n${text.substring(0, 300)}`);
    } catch (e) { console.error(e); }
}

run();

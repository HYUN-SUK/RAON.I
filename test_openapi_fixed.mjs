const KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

async function run() {
    try {
        const swRes = await fetch(`https://infuser.odcloud.kr/oas/docs?namespace=15102255/v1`);
        const swData = await swRes.json();
        const paths = Object.keys(swData.paths);
        const endpoint = paths[0];

        console.log(`[TESTING 100-YEAR STORE]`);
        const url = `https://api.odcloud.kr/api${endpoint}?serviceKey=${KEY}&page=1&perPage=10`;
        console.log(url);

        const res = await fetch(url);
        console.log(`[STATUS] ${res.status}`);
        const text = await res.text();
        console.log(`[BODY]\n${text.substring(0, 300)}`);
    } catch (e) { console.error(e); }
}

run();

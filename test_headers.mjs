const KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

async function testApi(name, url, headers) {
    console.log(`\n[TESTING] ${name}`);
    try {
        const res = await fetch(url, { headers });
        console.log(`[STATUS] ${res.status}`);
        const text = await res.text();
        console.log(`[BODY]\n${text.substring(0, 100)}`);
    } catch (e) {
        console.error(`[FETCH ERROR] ${e.message}`);
    }
}

async function run() {
    const url = `https://apis.data.go.kr/1741000/large_scale_retail_stores?pageNo=1&numOfRows=10&type=json`;

    await testApi('Header Auth Bearer', url, {
        'User-Agent': 'Mozilla/5.0',
        'Authorization': `Bearer ${KEY}`
    });

    await testApi('Header Auth Key', url, {
        'User-Agent': 'Mozilla/5.0',
        'Authorization': `${KEY}`
    });

    await testApi('Header serviceKey', url, {
        'User-Agent': 'Mozilla/5.0',
        'serviceKey': KEY
    });

    await testApi('Header ServiceKey', url, {
        'User-Agent': 'Mozilla/5.0',
        'ServiceKey': KEY
    });
}

run();

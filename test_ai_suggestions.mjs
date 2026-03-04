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
    // 1. 모범음식점 /info 추가 및 returnType=json 테스트
    await testApi('모범음식점 최소호출 (/info)', `http://apis.data.go.kr/1741000/excellent_restaurant_info/info?serviceKey=${KEY}&pageNo=1&numOfRows=10&returnType=json`);

    // 2. 대규모점포 /info 추가 (유추)
    await testApi('대규모점포 유추호출 (/info)', `http://apis.data.go.kr/1741000/large_scale_retail_stores/info?serviceKey=${KEY}&pageNo=1&numOfRows=10&returnType=json`);

    // 3. 대규모점포 로컬데이터 원천 파일(CSV) 다운로드 테스트
    await testApi('대규모점포 LocalData CSV', `https://file.localdata.go.kr/file/large_scale_retail_stores/info`);
}

run();

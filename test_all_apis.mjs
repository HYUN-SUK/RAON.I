const KEY = '03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2';

async function testApi(name, url) {
    console.log(`\n===========================================`);
    console.log(`[TESTING] ${name}`);
    console.log(`[URL] ${url}`);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        console.log(`[STATUS] ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log(`[BODY]\n${text.substring(0, 1000)}`);
    } catch (e) {
        console.error(`[FETCH ERROR] ${e.message}`);
    }
}

async function run() {
    // 1. 병원
    let doNm = encodeURIComponent('충청남도');
    let siNm = encodeURIComponent('예산군');
    await testApi('1. NMC (병원)', `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${KEY}&STAGE1=${doNm}&STAGE2=${siNm}&pageNo=1&numOfRows=10&_type=json`);

    // 2. 마트 (대규모점포 표준데이터)
    await testApi('2. 대규모점포 (마트)', `http://api.data.go.kr/openapi/tn_pubr_public_lrg_store_api?serviceKey=${KEY}&pageNo=1&numOfRows=10&type=json`);

    // 3. 식당
    await testApi('3-1. 모범음식점 (표준데이터)', `http://api.data.go.kr/openapi/tn_pubr_public_gd_rest_api?serviceKey=${KEY}&pageNo=1&numOfRows=10&type=json`);
    await testApi('3-2. 백년가게 (소상공인)', `http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong?serviceKey=${KEY}&pageNo=1&numOfRows=10&divId=signguCd&key=44810&type=json`);

    // 안심식당은 다른 키 사용

    // 5. 축제/행사
    await testApi('5-1. 문화축제 (표준)', `http://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api?serviceKey=${KEY}&pageNo=1&numOfRows=10&type=json`);
    await testApi('5-2. 공연행사 (표준)', `http://api.data.go.kr/openapi/tn_pubr_public_prmn_fesvl_api?serviceKey=${KEY}&pageNo=1&numOfRows=10&type=json`);
    await testApi('5-3. 관광공사 지역기반 축제', `http://apis.data.go.kr/B551011/KorService1/searchFestival1?serviceKey=${KEY}&numOfRows=10&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&eventStartDate=20240101&lDongRegnCd=44&lDongSignguCd=44810`);

    // 6. 관광지
    await testApi('6. 관광공사 명소', `http://apis.data.go.kr/B551011/KorService1/areaBasedList1?serviceKey=${KEY}&numOfRows=10&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=12&lDongRegnCd=44&lDongSignguCd=44810`);
}

run();

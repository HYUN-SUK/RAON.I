import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const PUBLIC_KEY = process.env.PUBLIC_DATA_API_KEY;
const SAFE_KEY = process.env.SAFE_RESTAURANT_API_KEY;
const OPINET_KEY = process.env.OPINET_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

async function checkAPI(name, url, options = {}) {
    console.log(`\n🔍 Checking ${name}...`);
    try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const text = await res.text();
        const isSuccess = text.includes('SUCCESS') || text.includes('NORMAL') || text.includes('OIL') || text.includes('item');
        if (isSuccess) {
            console.log(`✅ ${name}: SUCCESS`);
            // console.log('Preview:', text.substring(0, 100));
        } else {
            console.warn(`⚠️ ${name}: Response received but might be an error.`);
            console.log('Body:', text.substring(0, 200));
        }
    } catch (e) {
        console.error(`❌ ${name}: FAILED - ${e.message}`);
    }
}

async function runTests() {
    console.log("🚀 Starting API Connectivity Check...");

    // 1. Mart: 행정안전부_생활_대규모점포
    await checkAPI('MART (MOIS)', `http://apis.data.go.kr/B552061/largeStore/getLargeStoreList?serviceKey=${PUBLIC_KEY}&numOfRows=1&pageNo=1&type=json`);

    // 2. Restaurant: 행정안전부_모범음식점
    await checkAPI('RESTAURANT (MOIS)', `http://apis.data.go.kr/B552061/goodRestaurant/getGoodRestaurantList?serviceKey=${PUBLIC_KEY}&numOfRows=1&pageNo=1&type=json`);

    // 3. Restaurant: 백년가게 (SBA - ODCloud)
    await checkAPI('RESTAURANT (SBA)', `https://api.odcloud.kr/api/15102255/v1/uddi:636034f4-5f15-46f8-95a7-93e9ad54890c?serviceKey=${PUBLIC_KEY}&page=1&perPage=1`);

    // 4. Restaurant: 안심식당
    if (SAFE_KEY) {
        await checkAPI('RESTAURANT (SAFE)', `http://211.237.50.150:7080/openapi/${SAFE_KEY}/json/Grid_20200713000000000605_1/1/1`);
    }

    // 5. Gas Station: 오피넷
    if (OPINET_KEY) {
        await checkAPI('GAS (OPINET)', `http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_KEY}&x=175658&y=341695&radius=1000&sort=1&prodcd=C004&out=json`);
    }

    // 6. Spot: 관광공사 TourAPI
    await checkAPI('SPOT (TOUR_SPOT)', `http://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${PUBLIC_KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=12`);

    // 7. Kakao Geocoding (Shared)
    await checkAPI('KAKAO (GEOCODE)', `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent('서울시청')}`, {
        headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
    });

    console.log("\n🏁 API Check Completed.");
}

runTests();

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// route.ts의 getMidTermForecast 로직 테스트
const MID_TEMP_STATIONS = [
    { name: '서울', code: '11B10101', lat: 37.5665, lng: 126.9780 },
    { name: '인천', code: '11B20201', lat: 37.4563, lng: 126.7052 },
    { name: '수원', code: '11B20601', lat: 37.2636, lng: 127.0286 },
    { name: '춘천', code: '11D10301', lat: 37.8813, lng: 127.7298 },
    { name: '원주', code: '11D10401', lat: 37.3422, lng: 127.9202 },
    { name: '강릉', code: '11D20501', lat: 37.7519, lng: 128.8761 },
    { name: '청주', code: '11C10301', lat: 36.6424, lng: 127.4890 },
    { name: '충주', code: '11C10101', lat: 36.9910, lng: 127.9260 },
    { name: '제천', code: '11C10201', lat: 37.1326, lng: 128.1910 },
    { name: '대전', code: '11C20401', lat: 36.3504, lng: 127.3845 },
    { name: '전주', code: '11F10201', lat: 35.8242, lng: 127.1480 },
    { name: '광주', code: '11F20501', lat: 35.1595, lng: 126.8526 },
    { name: '대구', code: '11H10701', lat: 35.8714, lng: 128.6014 },
    { name: '부산', code: '11H20201', lat: 35.1796, lng: 129.0756 },
    { name: '울산', code: '11H20101', lat: 35.5384, lng: 129.3114 },
    { name: '제주', code: '11G00201', lat: 33.4996, lng: 126.5312 },
];

async function testKmaWeather() {
    const lat = 36.8431718657393;
    const lng = 128.093788354676;
    const serviceKey = process.env.DATA_GO_KR_API_KEY || process.env.KMA_SERVICE_KEY;

    console.log('--- 닷돈재 기상청 중기예보 API 호출 테스트 ---');
    console.log('Service Key 존재:', !!serviceKey);

    // KMA 단기예보 / 중기예보 날짜 계산 (오늘 KST 기준: 2026-08-16)
    // 2026-08-16 기준 D+5(8/21), D+6(8/22), D+7(8/23)
    const tempStation = MID_TEMP_STATIONS.find(s => s.name === '충주' || s.name === '제천');
    console.log('매핑된 기온 관측소:', tempStation);

    // tmFc (발표시각): 오늘 06:00
    const now = new Date();
    const tmFc = '202608160600';

    const tempUrl = `http://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa?serviceKey=${serviceKey}&numOfRows=10&pageNo=1&dataType=JSON&regId=${tempStation.code}&tmFc=${tmFc}`;
    
    try {
        const res = await fetch(tempUrl);
        const json = await res.json();
        console.log('기상청 중기기온 응답 item:', json?.response?.body?.items?.item?.[0]);
    } catch (e) {
        console.error('KMA fetch error:', e.message);
    }
}

testKmaWeather();

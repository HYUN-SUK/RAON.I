import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;
const OPINET_API_KEY = process.env.OPINET_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

async function testHospital() {
    console.log('--- Testing Hospital API (NMC) with Short Name ---');
    const doNm = '서울특별시';
    const sigunguNm = '종로구';
    const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${PUBLIC_API_KEY}&STAGE1=${encodeURIComponent(doNm)}&STAGE2=${encodeURIComponent(sigunguNm)}&pageNo=1&numOfRows=10&_type=json`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log('Result:', JSON.stringify(data.response.header, null, 2));
        const items = data.response?.body?.items?.item;
        console.log('Items Count:', Array.isArray(items) ? items.length : (items ? 1 : 0));
    } catch (e) {
        console.error('Hospital Error:', e.message);
    }
}

async function testFestival() {
    console.log('--- Testing Festival API (TourAPI) ---');
    const lat = 37.5665, lng = 126.9780; // Seoul City Hall
    const url = `http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${PUBLIC_API_KEY}&numOfRows=10&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=15&mapX=${lng}&mapY=${lat}&radius=20000`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log('Festival Data:', data.response?.header?.resultMsg || 'No Msg');
        console.log('Items Count:', data.response?.body?.items?.item?.length || 0);
    } catch (e) {
        console.error('Festival Error:', e.message);
    }
}

async function testGasStation() {
    console.log('--- Testing Gas Station API (Opinet) ---');
    // Using dummy WTM coords or skipping projection for simple verify
    const url = `http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_API_KEY}&x=314682&y=544837&radius=5000&sort=1&prodcd=C004&out=json`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log('Gas Station Data:', data.RESULT?.OIL ? 'Success' : 'Fail');
        console.log('Items Count:', data.RESULT?.OIL?.length || 0);
    } catch (e) {
        console.error('Gas Station Error:', e.message);
    }
}

async function run() {
    await testHospital();
    await testFestival();
    await testGasStation();
}

run();

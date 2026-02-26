require('dotenv').config({ path: '.env.local' });
const publicApiKey = process.env.PUBLIC_DATA_API_KEY;

async function test() {
    try {
        console.log('Testing TourAPI...');
        const r1 = await fetch(`http://apis.data.go.kr/B551011/KorService1/searchFestival1?serviceKey=${publicApiKey}&numOfRows=5&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&eventStartDate=20240101`);
        const text1 = await r1.text();
        console.log('TourAPI Response:', text1.substring(0, 300));

        console.log('Testing SMBA...');
        const r2 = await fetch(`http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong?serviceKey=${publicApiKey}&pageNo=1&numOfRows=5&divId=indutyCd&key=Q&type=json`);
        const text2 = await r2.text();
        console.log('SMBA Response:', text2.substring(0, 300));

        console.log('Testing ADMIN_MART...');
        const r3 = await fetch(`http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong?serviceKey=${publicApiKey}&pageNo=1&numOfRows=5&divId=indsLclsCd&key=D&type=json`);
        const text3 = await r3.text();
        console.log('ADMIN_MART Response:', text3.substring(0, 300));

    } catch (e) {
        console.error(e);
    }
}
test();

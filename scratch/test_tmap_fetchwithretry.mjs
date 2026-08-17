import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testFetchRetry() {
    const key = process.env.PUBLIC_DATA_API_KEY;
    const baseYm = '202504'; // findLatestBaseYm이 반환한 값 확인
    const areaCd = '29';
    const signguCd = '29170';

    const tmapUrl = `https://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?serviceKey=${key}&areaCd=${areaCd}&signguCd=${signguCd}&baseYm=${baseYm}&numOfRows=1000&_type=json&MobileOS=ETC&MobileApp=RAONAI`;
    
    console.log('요청 URL:', tmapUrl);
    const res = await fetch(tmapUrl);
    const text = await res.text();
    console.log('응답 본문 첫 300자:', text.slice(0, 300));
}

testFetchRetry();

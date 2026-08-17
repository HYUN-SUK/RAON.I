import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const key = process.env.PUBLIC_DATA_API_KEY;

async function testTmap() {
    console.log('--- 한국관광공사 데이터랩 TMAP API 테스트 ---');
    console.log('PUBLIC_DATA_API_KEY 길이:', key?.length);

    const ymList = ['202606', '202605', '202604', '202603', '202512', '202504', '202412'];

    for (const ym of ymList) {
        const url = `https://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?serviceKey=${key}&areaCd=11&signguCd=11110&baseYm=${ym}&numOfRows=5&_type=json&MobileOS=ETC&MobileApp=RAONAI`;
        try {
            const res = await fetch(url);
            const text = await res.text();
            console.log(`[baseYm=${ym}] status: ${res.status} | text: ${text.slice(0, 150)}`);
        } catch (e) {
            console.log(`[baseYm=${ym}] 에러: ${e.message}`);
        }
    }
}

testTmap();

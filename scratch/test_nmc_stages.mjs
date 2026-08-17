import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const key = process.env.PUBLIC_DATA_API_KEY;

async function testStages() {
    const list = [
        '서울특별시', '서울', 
        '경기도', '경기', 
        '광주광역시', '광주', 
        '전라남도', '전남', 
        '전남광주통합특별시'
    ];

    for (const s of list) {
        const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${key}&STAGE1=${encodeURIComponent(s)}&STAGE2=&pageNo=1&numOfRows=5&_type=json`;
        const res = await fetch(url);
        const data = await res.json();
        const count = data?.response?.body?.totalCount || 0;
        console.log(`[STAGE1='${s}'] -> totalCount: ${count}`);
    }
}

testStages();

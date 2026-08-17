import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const MOIS_API_KEY = process.env.MOIS_API_KEY;

async function testNmcAll() {
    const sidos = ['서울특별시', '경기도', '부산광역시', '강원특별자치도', '충청북도', ''];
    for (const s of sidos) {
        const stageParam = s ? `&STAGE1=${encodeURIComponent(s)}` : '';
        const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${MOIS_API_KEY}${stageParam}&STAGE2=&pageNo=1&numOfRows=10&_type=json`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            const total = data.response?.body?.totalCount || 0;
            console.log(`[${s || '전체'}] totalCount: ${total} | resultCode: ${data.response?.header?.resultCode} | resultMsg: ${data.response?.header?.resultMsg}`);
        } catch (e) {
            console.log(`[${s}] 실패: ${e.message}`);
        }
    }
}

testNmcAll();

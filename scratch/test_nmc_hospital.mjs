import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const MOIS_API_KEY = process.env.MOIS_API_KEY;

async function testNmcHospital() {
    console.log('--- NMC 응급의료기관 API 테스트 ---');
    const stages = ['광주광역시', '전라남도', '전남광주통합특별시', '광주', '전남'];

    for (const st of stages) {
        const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${MOIS_API_KEY}&STAGE1=${encodeURIComponent(st)}&STAGE2=&pageNo=1&numOfRows=10&_type=json`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            const total = data.response?.body?.totalCount || 0;
            const items = data.response?.body?.items?.item;
            const first = Array.isArray(items) ? items[0]?.dutyName : items?.dutyName;
            console.log(`[STAGE1=${st}] totalCount: ${total} | 첫번째 병원: ${first || 'N/A'}`);
        } catch (e) {
            console.log(`[STAGE1=${st}] 에러: ${e.message}`);
        }
    }
}

testNmcHospital();

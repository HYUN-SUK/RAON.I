import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const MOIS_API_KEY = process.env.MOIS_API_KEY;

async function inspectNmc() {
    const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${MOIS_API_KEY}&STAGE1=${encodeURIComponent('서울특별시')}&STAGE2=&pageNo=1&numOfRows=10&_type=json`;
    const res = await fetch(url);
    const text = await res.text();
    console.log('NMC 응답 본문:', text);
}

inspectNmc();

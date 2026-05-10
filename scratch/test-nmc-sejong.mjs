
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;

async function testNMC(stage2) {
    const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${PUBLIC_API_KEY}&STAGE1=${encodeURIComponent('세종')}&STAGE2=${encodeURIComponent(stage2)}&pageNo=1&numOfRows=10&_type=json`;
    console.log(`\nTesting with STAGE2: "${stage2}"`);
    try {
        const res = await fetch(url);
        const text = await res.text();
        // console.log('Raw Response:', text);
        const data = JSON.parse(text);
        const items = data.response?.body?.items?.item;
        if (items) {
            const list = Array.isArray(items) ? items : [items];
            list.forEach(it => console.log(`- ${it.dutyName} (${it.dutyAddr})`));
        } else {
            console.log('No data found.');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function run() {
    if (!PUBLIC_API_KEY) {
        console.error('Missing PUBLIC_DATA_API_KEY in .env.local');
        return;
    }
    await testNMC('수목원로'); // 현재 오류 상황 (로 이름이 들어감)
    await testNMC('');         // 세종시 전체 조회
}

run();
